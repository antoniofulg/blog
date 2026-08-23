#!/usr/bin/env bun
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { loadavg } from "node:os";
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
export const LOAD_GATE_POLL_INTERVAL_MS = 1_000;
export const LOAD_GATE_TIMEOUT_MS = 5 * 60_000;
export const AMBIENT_LOAD_POLL_INTERVAL_MS = 1_000;
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
	loadGateTimedOut: boolean;
	ambientLoadStart: number;
	ambientLoadMax: number;
	ambientLoadEnd: number;
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
	memoryValid: boolean;
	memoryInvalidReasons: string[];
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
	validMemoryComparison: boolean;
	validTimingComparison: boolean;
	invalidReasons: string[];
	memoryInvalidReasons: string[];
	timingInvalidReasons: string[];
	memoryWinner: WorkerProfileId | null;
	winner: WorkerProfileId | null;
};

export type WorkerBenchDeps = {
	spawn: typeof spawnMeasured;
	host: () => Promise<HostMeta>;
	commit: () => Promise<string>;
	now: () => string;
	runnerVersion: string;
	cwd: string;
	sleep: (milliseconds: number) => Promise<void>;
	nowMs: () => number;
	loadAvg: () => number;
	ambientLoadPollIntervalMs: number;
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
		memoryValid: false,
		memoryInvalidReasons: [],
	};
}

async function waitForLoad(deps: WorkerBenchDeps): Promise<boolean> {
	const startedAt = deps.nowMs();
	while (true) {
		const host = await deps.host();
		const limit = LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1);
		if (host.loadAvg1 <= limit) return false;
		if (deps.nowMs() - startedAt >= LOAD_GATE_TIMEOUT_MS) return true;
		await deps.sleep(LOAD_GATE_POLL_INTERVAL_MS);
	}
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

type ProfileMemoryValidity = {
	valid: boolean;
	reasons: string[];
};

function profileMemoryValidity(
	profile: WorkerProfileResult,
	expectedSamples: number,
): ProfileMemoryValidity {
	const reasons: string[] = [];
	if (profile.samples.length !== expectedSamples) {
		reasons.push(
			`expected ${expectedSamples} measured samples, got ${profile.samples.length}`,
		);
	}
	const reference = profile.samples[0]?.outcome ?? null;
	for (const [index, sample] of profile.samples.entries()) {
		if (sample.timedOut) reasons.push(`sample ${index + 1}: timed out`);
		if (sample.exitCode !== 0)
			reasons.push(`sample ${index + 1}: exit code ${sample.exitCode}`);
		if (!sample.outcome) reasons.push(`sample ${index + 1}: Vitest outcome summary missing`);
		if (reference && sample.outcome && !outcomeEqual(reference, sample.outcome)) {
			reasons.push(`sample ${index + 1}: Vitest outcome changed`);
		}
	}
	if (!reference) reasons.push("reference Vitest outcome summary missing");
	return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function memoryValidity(
	profiles: WorkerProfileResult[],
	expectedSamples: number,
): {
	valid: boolean;
	reasons: string[];
	validProfiles: WorkerProfileResult[];
} {
	const statuses = profiles.map((profile) => ({
		profile,
		...profileMemoryValidity(profile, expectedSamples),
	}));
	const groups: Array<typeof statuses> = [];
	for (const status of statuses.filter((candidate) => candidate.valid)) {
		const outcome = status.profile.samples[0]?.outcome ?? null;
		const group = groups.find((candidateGroup) =>
			outcomeEqual(candidateGroup[0].profile.samples[0]?.outcome ?? null, outcome),
		);
		if (group) group.push(status);
		else groups.push([status]);
	}
	const selectedGroup =
		[...groups].sort((a, b) => b.length - a.length)[0] ?? [];
	const selectedOutcome = selectedGroup[0]?.profile.samples[0]?.outcome ?? null;
	for (const status of statuses) {
		if (status.valid && !selectedGroup.includes(status)) {
			status.valid = false;
			status.reasons.push(
				`Vitest outcome differs from selected profile ${selectedGroup[0]?.profile.profile ?? "none"}`,
			);
		}
		if (selectedOutcome && !selectedGroup.includes(status)) {
			for (const [index, sample] of status.profile.samples.entries()) {
				if (sample.outcome && !outcomeEqual(selectedOutcome, sample.outcome)) {
					status.reasons.push(`sample ${index + 1}: Vitest outcome changed`);
				}
			}
		}
	}
	for (const status of statuses) {
		status.profile.memoryValid = status.valid;
		status.profile.memoryInvalidReasons = [...new Set(status.reasons)];
	}
	const validProfiles = statuses
		.filter((status) => status.valid)
		.map((status) => status.profile);
	const reasons = statuses.flatMap((status) =>
		status.valid
			? []
			: status.reasons.map((reason) => `${status.profile.profile}: ${reason}`),
	);
	if (validProfiles.length < 2) {
		reasons.push(
			"memory comparison requires at least 2 profiles with equivalent valid outcomes",
		);
	}
	return {
		valid: validProfiles.length >= 2,
		reasons: [...new Set(reasons)],
		validProfiles,
	};
}

function timingValidity(
	profiles: WorkerProfileResult[],
	host: HostMeta,
	allProfilesMemoryValid: boolean,
): { valid: boolean; reasons: string[] } {
	const reasons: string[] = [];
	const limit = LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1);
	if (!allProfilesMemoryValid)
		reasons.push("timing comparison requires every profile to have valid memory samples");
	for (const profile of profiles) {
		for (const [index, sample] of profile.warmupSamples.entries()) {
			if (sample.loadGateTimedOut)
				reasons.push(`${profile.profile} warmup ${index + 1}: load gate timed out`);
		}
		for (const [index, sample] of profile.samples.entries()) {
			if (sample.loadGateTimedOut)
				reasons.push(`${profile.profile} sample ${index + 1}: load gate timed out`);
			if (sample.ambientLoadMax > limit) {
				reasons.push(
					`${profile.profile} sample ${index + 1}: ambient load ${sample.ambientLoadMax.toFixed(2)} exceeds ${limit.toFixed(2)}`,
				);
			}
		}
	}
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
		const loadGateTimedOut = await waitForLoad(deps);
		const ambientLoadStart = deps.loadAvg();
		let ambientLoadMax = ambientLoadStart;
		const ambientSampler = setInterval(() => {
			ambientLoadMax = Math.max(ambientLoadMax, deps.loadAvg());
		}, deps.ambientLoadPollIntervalMs);
		const run = await deps.spawn(command, process.env, {
			timeoutMs: WORKLOAD_TIMEOUT_MS,
			cwd: deps.cwd,
		});
		clearInterval(ambientSampler);
		const ambientLoadEnd = deps.loadAvg();
		ambientLoadMax = Math.max(ambientLoadMax, ambientLoadEnd);
		target.push({
			durationMs: run.ms,
			peakRssBytes: run.peakRssBytes,
			loadAvg1: run.loadAvg1,
			exitCode: run.timedOut ? null : run.exitCode,
			timedOut: run.timedOut,
			loadGateTimedOut,
			ambientLoadStart,
			ambientLoadMax,
			ambientLoadEnd,
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
	const memory = memoryValidity(results, repetitions);
	const timing = timingValidity(
		results,
		host,
		results.every((profile) => profile.memoryValid),
	);
	const memoryWinner = winnerFor(memory.validProfiles);
	const invalidReasons = [...new Set([...memory.reasons, ...timing.reasons])];
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
		validComparison: memory.valid && timing.valid,
		validMemoryComparison: memory.valid,
		validTimingComparison: timing.valid,
		invalidReasons,
		memoryInvalidReasons: memory.reasons,
		timingInvalidReasons: timing.reasons,
		memoryWinner,
		winner: memory.valid && timing.valid ? memoryWinner : null,
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
		lines.push(
			"## Comparison invalid",
			"",
			`- Memory comparison: ${run.validMemoryComparison ? "valid" : "invalid"}`,
			`- Timing comparison: ${run.validTimingComparison ? "valid" : "invalid"}`,
			...run.invalidReasons.map((reason) => `- ${reason}`),
			"",
			"No overall winner is reported.",
			"",
		);
	}
	lines.push("## Measurements", "");
	if (!run.validTimingComparison) {
		lines.push("Timing and duration values are diagnostic only because timing validity failed.", "");
	}
	for (const profile of run.profiles) {
		const aggregateResult = profile.aggregate;
		lines.push(
			aggregateResult
				? `- ${profile.profile}: median ${aggregateResult.medianMs.toFixed(2)} ms, median peak RSS ${bytes(aggregateResult.medianPeakRssBytes)}, max measured load ${aggregateResult.maxLoadAvg1.toFixed(2)}, total wall time ${profile.totalWallTimeMs.toFixed(2)} ms including warmup`
				: `- ${profile.profile}: no samples`,
		);
	}
	for (const profile of run.profiles) {
		if (!profile.memoryValid) {
			lines.push(
				`- Profile ${profile.profile}: memory invalid${profile.memoryInvalidReasons.length > 0 ? ` — ${profile.memoryInvalidReasons.join("; ")}` : ""}`,
			);
		}
	}
	if (run.validComparison) lines.push("", `Winner: **${run.winner ?? "none"}**`, "");
	else if (run.memoryWinner) lines.push("", `Memory winner (timing diagnostic): **${run.memoryWinner}**`, "");
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
	sleep: (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds)),
	nowMs: () => Date.now(),
	loadAvg: () => loadavg()[0],
	ambientLoadPollIntervalMs: AMBIENT_LOAD_POLL_INTERVAL_MS,
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
