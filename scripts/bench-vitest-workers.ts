#!/usr/bin/env bun
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { collectHostMeta } from "#/lib/bench/host.server";
import { spawnMeasured, WORKLOAD_TIMEOUT_MS } from "#/lib/bench/runner.server";
import { aggregate } from "#/lib/bench/stats";
import type { Aggregate, HostMeta, Sample } from "#/lib/bench/types";
import { parseVitestSummary } from "#/lib/test-bench/runner.server";
import type { TestOutcome } from "#/lib/test-bench/types";

export const WORKER_PROFILE_IDS = ["1", "2", "4", "auto"] as const;
export type WorkerProfileId = (typeof WORKER_PROFILE_IDS)[number];
export const DEFAULT_REPETITIONS = 5;
export const MAX_REPETITIONS = 20;
export const WARMUP_COUNT = 1;
export const LOAD_PER_CORE_LIMIT = 1;
export const WORKER_BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/vitest-workers",
);

export type WorkerProfile = {
	id: WorkerProfileId;
	maxWorkers?: number;
};

export const WORKER_PROFILES: WorkerProfile[] = [
	{ id: "1", maxWorkers: 1 },
	{ id: "2", maxWorkers: 2 },
	{ id: "4", maxWorkers: 4 },
	{ id: "auto" },
];

export type WorkerBenchArgs = {
	profiles: WorkerProfileId[];
	repetitions: number;
	help: boolean;
};

export type WorkerSample = {
	durationMs: number;
	peakRssBytes: number;
	loadAvg1: number;
	exitCode: number | null;
	timedOut: boolean;
	command: string[];
	runtimeVersion: string;
	runnerVersion: string;
	outcome: TestOutcome | null;
	failureExcerpt?: string;
};

export type WorkerProfileResult = {
	profile: WorkerProfileId;
	command: string[];
	warmups: number;
	warmupSamples: WorkerSample[];
	samples: WorkerSample[];
	totalWallTimeMs: number;
	aggregate: Aggregate | null;
};

export type WorkerBenchRun = {
	schemaVersion: 1;
	commit: string;
	timestamp: string;
	host: HostMeta;
	runtime: "bun";
	runtimeVersion: string;
	runner: "vitest";
	runnerVersion: string;
	repetitions: number;
	warmupsPerProfile: number;
	loadValidity: {
		perCoreLimit: number;
		absoluteLimit: number;
	};
	profiles: WorkerProfileResult[];
	validComparison: boolean;
	invalidReasons: string[];
	winner: WorkerProfileId | null;
};

export type WorkerBenchDeps = {
	spawn: typeof spawnMeasured;
	host: () => Promise<HostMeta>;
	commit: () => Promise<string>;
	now: () => string;
	runnerVersion: string;
	cwd: string;
};

function parsePositiveInt(value: string, option: string): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${option} must be a positive integer`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${option} must be a positive integer`);
	}
	if (parsed > MAX_REPETITIONS) {
		throw new Error(`${option} must be at most ${MAX_REPETITIONS}`);
	}
	return parsed;
}

function parseProfiles(value: string): WorkerProfileId[] {
	const values = value.split(",").filter(Boolean);
	if (values.length === 0) throw new Error("--only must name at least one profile");
	const unknown = values.filter(
		(profile): profile is string =>
			!WORKER_PROFILE_IDS.includes(profile as WorkerProfileId),
	);
	if (unknown.length > 0) {
		throw new Error(`--only has unknown profile(s): ${unknown.join(", ")}`);
	}
	return [...new Set(values)] as WorkerProfileId[];
}

export function parseWorkerBenchArgs(args: string[]): WorkerBenchArgs {
	const parsed: WorkerBenchArgs = {
		profiles: [...WORKER_PROFILE_IDS],
		repetitions: DEFAULT_REPETITIONS,
		help: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--help" || arg === "-h") {
			parsed.help = true;
			continue;
		}
		if (arg === "--only" || arg === "--repetitions") {
			const value = args[++index];
			if (!value) throw new Error(`${arg} requires a value`);
			if (arg === "--only") parsed.profiles = parseProfiles(value);
			else parsed.repetitions = parsePositiveInt(value, arg);
			continue;
		}
		if (arg.startsWith("--only=")) {
			parsed.profiles = parseProfiles(arg.slice("--only=".length));
			continue;
		}
		if (arg.startsWith("--repetitions=")) {
			parsed.repetitions = parsePositiveInt(
				arg.slice("--repetitions=".length),
				"--repetitions",
			);
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}
	return parsed;
}

export function commandForProfile(profile: WorkerProfile): string[] {
	return [
		"bun",
		"run",
		"test:vitest:bun",
		"--",
		...(profile.maxWorkers ? [`--maxWorkers=${profile.maxWorkers}`] : []),
	];
}

function installedVitestVersion(): string {
	try {
		const packageJson = JSON.parse(
			readFileSync(
				new URL("../node_modules/vitest/package.json", import.meta.url),
				"utf8",
			),
		) as { version?: unknown };
		return typeof packageJson.version === "string" ? packageJson.version : "unknown";
	} catch {
		return "unknown";
	}
}

function failureExcerpt(stdout: string, stderrTail: string): string | undefined {
	const excerpt = [stdout.trim(), stderrTail.trim()].filter(Boolean).join("\n");
	return excerpt || undefined;
}

function outcomeEqual(a: TestOutcome | null, b: TestOutcome | null): boolean {
	if (!a || !b) return a === b;
	return (
		a.filesPassed === b.filesPassed &&
		a.filesFailed === b.filesFailed &&
		a.testsPassed === b.testsPassed &&
		a.testsFailed === b.testsFailed &&
		a.testsSkipped === b.testsSkipped &&
		a.leafTestsSkipped === b.leafTestsSkipped &&
		a.testFileCount === b.testFileCount
	);
}

function profileResult(
	profile: WorkerProfile,
	warmupSamples: WorkerSample[],
	samples: WorkerSample[],
): WorkerProfileResult {
	const timedSamples: Sample[] = samples.map((sample) => ({
		ms: sample.durationMs,
		peakRssBytes: sample.peakRssBytes,
		exitCode: sample.exitCode ?? -1,
		loadAvg1: sample.loadAvg1,
	}));
	return {
		profile: profile.id,
		command: commandForProfile(profile),
		warmups: WARMUP_COUNT,
		warmupSamples,
		samples,
		totalWallTimeMs: [...warmupSamples, ...samples].reduce(
			(total, sample) => total + sample.durationMs,
			0,
		),
		aggregate: aggregate(timedSamples),
	};
}

function winnerFor(profiles: WorkerProfileResult[]): WorkerProfileId | null {
	return (
		[...profiles]
			.filter((profile) => profile.aggregate)
			.sort((a, b) => {
				const rss =
					a.aggregate!.medianPeakRssBytes - b.aggregate!.medianPeakRssBytes;
				return rss || a.aggregate!.medianMs - b.aggregate!.medianMs;
			})[0]?.profile ?? null
	);
}

function validity(
	profiles: WorkerProfileResult[],
	host: HostMeta,
): { valid: boolean; reasons: string[] } {
	const reasons: string[] = [];
	const limit = LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1);
	const reference = profiles[0]?.samples[0]?.outcome ?? null;
	for (const profile of profiles) {
		for (const [index, sample] of profile.samples.entries()) {
			if (sample.timedOut) reasons.push(`${profile.profile} sample ${index + 1}: timed out`);
			if (sample.exitCode !== 0)
				reasons.push(`${profile.profile} sample ${index + 1}: exit code ${sample.exitCode}`);
			if (!sample.outcome)
				reasons.push(`${profile.profile} sample ${index + 1}: Vitest outcome summary missing`);
			if (sample.loadAvg1 > limit) {
				reasons.push(
					`${profile.profile} sample ${index + 1}: load ${sample.loadAvg1.toFixed(2)} exceeds ${limit.toFixed(2)}`,
				);
			}
			if (reference && sample.outcome && !outcomeEqual(reference, sample.outcome)) {
				reasons.push(`${profile.profile} sample ${index + 1}: Vitest outcome changed`);
			}
		}
	}
	if (!reference) reasons.push("reference Vitest outcome summary missing");
	return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export async function runWorkerBenchmark(
	profileIds: WorkerProfileId[] = [...WORKER_PROFILE_IDS],
	repetitions = DEFAULT_REPETITIONS,
	deps: WorkerBenchDeps = defaultWorkerBenchDeps,
): Promise<WorkerBenchRun> {
	if (!Number.isInteger(repetitions) || repetitions < 1) {
		throw new Error("repetitions must be a positive integer");
	}
	const profiles = profileIds.map((id) => WORKER_PROFILES.find((profile) => profile.id === id));
	if (profiles.some((profile) => !profile)) throw new Error("unknown worker profile");
	const selected = profiles as WorkerProfile[];
	const warmupSamples = new Map<WorkerProfileId, WorkerSample[]>();
	const samples = new Map<WorkerProfileId, WorkerSample[]>();
	for (const profile of selected) {
		warmupSamples.set(profile.id, []);
		samples.set(profile.id, []);
	}
	const runOne = async (profile: WorkerProfile, target: WorkerSample[]) => {
		const command = commandForProfile(profile);
		const run = await deps.spawn(command, process.env, {
			timeoutMs: WORKLOAD_TIMEOUT_MS,
			cwd: deps.cwd,
		});
		target.push({
			durationMs: run.ms,
			peakRssBytes: run.peakRssBytes,
			loadAvg1: run.loadAvg1,
			exitCode: run.timedOut ? null : run.exitCode,
			timedOut: run.timedOut,
			command,
			runtimeVersion: process.versions.bun ?? "unknown",
			runnerVersion: deps.runnerVersion,
			outcome: parseVitestSummary(run.stdout),
			failureExcerpt: failureExcerpt(run.stdout, run.stderrTail),
		});
	};
	for (const profile of selected) {
		await runOne(profile, warmupSamples.get(profile.id)!);
	}
	for (let repetition = 0; repetition < repetitions; repetition += 1) {
		const order = repetition % 2 === 0 ? selected : [...selected].reverse();
		for (const profile of order) await runOne(profile, samples.get(profile.id)!);
	}
	const host = await deps.host();
	const results = selected.map((profile) =>
		profileResult(
			profile,
			warmupSamples.get(profile.id)!,
			samples.get(profile.id)!,
		),
	);
	const checked = validity(results, host);
	return {
		schemaVersion: 1,
		commit: await deps.commit(),
		timestamp: deps.now(),
		host,
		runtime: "bun",
		runtimeVersion: process.versions.bun ?? "unknown",
		runner: "vitest",
		runnerVersion: deps.runnerVersion,
		repetitions,
		warmupsPerProfile: WARMUP_COUNT,
		loadValidity: {
			perCoreLimit: LOAD_PER_CORE_LIMIT,
			absoluteLimit: LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1),
		},
		profiles: results,
		validComparison: checked.valid,
		invalidReasons: checked.reasons,
		winner: checked.valid ? winnerFor(results) : null,
	};
}

function bytes(value: number): string {
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function renderWorkerBenchmark(run: WorkerBenchRun): string {
	const lines = [
		"# Bun + Vitest worker benchmark",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores, ${bytes(run.host.totalMemBytes)} RAM, load ${run.host.loadAvg1.toFixed(2)})`,
		`- Runtime: ${run.runtime} ${run.runtimeVersion}; runner: ${run.runner} ${run.runnerVersion}`,
		`- Samples: ${run.warmupsPerProfile} warmup discarded + ${run.repetitions} measured per profile`,
		`- Load validity: <= ${run.loadValidity.absoluteLimit.toFixed(2)} (${run.loadValidity.perCoreLimit} per core)`,
		"",
	];
	if (!run.validComparison) {
		lines.push("## Comparison invalid", "", ...run.invalidReasons.map((reason) => `- ${reason}`), "", "No winner is reported.", "");
	} else {
		lines.push("## Measurements", "");
		for (const profile of run.profiles) {
			const aggregateResult = profile.aggregate;
			lines.push(
				aggregateResult
					? `- ${profile.profile}: median ${aggregateResult.medianMs.toFixed(2)} ms, median peak RSS ${bytes(aggregateResult.medianPeakRssBytes)}, max load ${aggregateResult.maxLoadAvg1.toFixed(2)}, total wall time ${profile.totalWallTimeMs.toFixed(2)} ms including warmup`
					: `- ${profile.profile}: no samples`,
			);
		}
		lines.push("", `Winner: **${run.winner ?? "none"}**`, "");
	}
	lines.push("## Warmups (excluded from aggregate)", "", "| Profile | Duration (ms) | Peak RSS | Load | Exit | Outcome | Command |", "| --- | ---: | ---: | ---: | ---: | --- | --- |");
	for (const profile of run.profiles) {
		for (const sample of profile.warmupSamples) {
			const outcome = sample.outcome
				? `${sample.outcome.testsPassed} passed / ${sample.outcome.testsFailed} failed / ${sample.outcome.testsSkipped} skipped`
				: "missing";
			lines.push(`| ${profile.profile} | ${sample.durationMs.toFixed(2)} | ${bytes(sample.peakRssBytes)} | ${sample.loadAvg1.toFixed(2)} | ${sample.exitCode ?? "timeout"} | ${outcome} | \`${sample.command.join(" ")}\` |`);
		}
	}
	lines.push("", "## Raw measured samples", "", "| Profile | Run | Duration (ms) | Peak RSS | Load | Exit | Outcome | Command |", "| --- | ---: | ---: | ---: | ---: | ---: | --- | --- |");
	for (const profile of run.profiles) {
		for (const [index, sample] of profile.samples.entries()) {
			const outcome = sample.outcome
				? `${sample.outcome.testsPassed} passed / ${sample.outcome.testsFailed} failed / ${sample.outcome.testsSkipped} skipped`
				: "missing";
			lines.push(`| ${profile.profile} | ${index + 1} | ${sample.durationMs.toFixed(2)} | ${bytes(sample.peakRssBytes)} | ${sample.loadAvg1.toFixed(2)} | ${sample.exitCode ?? "timeout"} | ${outcome} | \`${sample.command.join(" ")}\` |`);
		}
	}
	return `${lines.join("\n")}\n`;
}

async function reserveStem(dir: string, timestamp: string): Promise<string> {
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `workers-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try {
			const handle = await open(resolve(dir, `${stem}.json`), "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve a unique worker benchmark report name");
}

export async function writeWorkerBenchmark(
	run: WorkerBenchRun,
	dir = WORKER_BENCHMARK_DIR,
): Promise<{ jsonPath: string; markdownPath: string }> {
	await mkdir(dir, { recursive: true });
	const stem = await reserveStem(dir, run.timestamp);
	const jsonPath = resolve(dir, `${stem}.json`);
	const markdownPath = resolve(dir, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, renderWorkerBenchmark(run), "utf8");
	return { jsonPath, markdownPath };
}

export async function readWorkerBenchmark(path: string): Promise<WorkerBenchRun> {
	return JSON.parse(await readFile(path, "utf8")) as WorkerBenchRun;
}

export const defaultWorkerBenchDeps: WorkerBenchDeps = {
	spawn: spawnMeasured,
	host: collectHostMeta,
	commit: async () => {
		const { execFile } = await import("node:child_process");
		const { promisify } = await import("node:util");
		try {
			const result = await promisify(execFile)("git", ["rev-parse", "HEAD"]);
			return result.stdout.trim();
		} catch {
			return "unknown";
		}
	},
	now: () => new Date().toISOString(),
	runnerVersion: installedVitestVersion(),
	cwd: process.cwd(),
};

function usage(): string {
	return [
		"Usage: bun run scripts/bench-vitest-workers.ts [--only=1,2,4,auto] [--repetitions=N]",
		"Profiles run with Bun 1.4 plus Vitest; one warmup is discarded per profile.",
		`Measured repetitions: 1-${MAX_REPETITIONS}, default ${DEFAULT_REPETITIONS}.`,
	].join("\n");
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const parsed = parseWorkerBenchArgs(args);
	if (parsed.help) {
		console.log(usage());
		return;
	}
	const run = await runWorkerBenchmark(parsed.profiles, parsed.repetitions);
	const paths = await writeWorkerBenchmark(run);
	console.log(`JSON: ${paths.jsonPath}`);
	console.log(`Markdown: ${paths.markdownPath}`);
	if (!run.validComparison) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
