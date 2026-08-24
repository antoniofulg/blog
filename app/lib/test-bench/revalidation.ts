import { execFile } from "node:child_process";
import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { collectHostMeta } from "#/lib/bench/host.server";
import { type MeasuredRun, spawnMeasured } from "#/lib/bench/runner.server";
import { aggregate } from "#/lib/bench/stats";
import type { Aggregate, HostMeta, Sample } from "#/lib/bench/types";
import {
	compareRuntimeOutcomes,
	compareTestTrees,
	DEFAULT_VITEST_ONLY_DISPOSITIONS,
	type ParityResult,
	type RuntimeOutcome,
	scanTestTree,
} from "#/lib/test-migration/parity";

export type RevalidationArm = {
	id: string;
	runner: "vitest" | "bun:test";
	runtime: "bun" | "node";
	runnerVersion: string;
	runtimeVersion: string;
	command: string[];
	workerCount: number;
	isolation: "isolated" | "shared";
	timeoutMs: number;
};

export type RevalidationProvenance = {
	command: string;
	execPath: string;
	runtime: string;
	runtimeVersion: string;
	runner: string;
	runnerVersion: string;
};

export type RevalidationOutcome = RuntimeOutcome;

export type RevalidationSample = {
	arm: string;
	repetition: number;
	durationMs: number;
	peakRssBytes: number;
	exitCode: number | null;
	timedOut: boolean;
	loadAvg1: number;
	provenance: RevalidationProvenance;
	outcome: RevalidationOutcome | null;
	excluded: boolean;
	exclusionReason?: string;
	failureExcerpt?: string;
};

export type RevalidationRun = {
	schemaVersion: 1;
	commit: string;
	timestamp: string;
	host: HostMeta;
	arms: RevalidationArm[];
	repetitions: number;
	warmupCount: number;
	armOrderByRepetition: string[][];
	samples: RevalidationSample[];
	aggregates: Record<string, Aggregate | null>;
	inventory: ParityResult;
	validComparison: boolean;
	invalidReasons: string[];
};

export type RevalidationDeps = {
	spawn: (
		argv: string[],
		env: NodeJS.ProcessEnv,
		opts: { timeoutMs: number; cwd?: string },
	) => Promise<MeasuredRun>;
	host: () => Promise<HostMeta>;
	commit: () => Promise<string>;
	inventory: () => Promise<ParityResult>;
	cwd: string;
	env: NodeJS.ProcessEnv;
	contamination?: (
		run: MeasuredRun,
		arm: RevalidationArm,
	) => string | undefined;
};

const PROVENANCE_KEYS = [
	"command",
	"execPath",
	"runtime",
	"runtimeVersion",
	"runner",
	"runnerVersion",
] as const;

const exec = promisify(execFile);

function emptyProvenance(arm: RevalidationArm): RevalidationProvenance {
	return {
		command: arm.command.join(" "),
		execPath: "unknown",
		runtime: arm.runtime,
		runtimeVersion: arm.runtimeVersion,
		runner: arm.runner,
		runnerVersion: arm.runnerVersion,
	};
}

function parseProvenance(
	stdout: string,
	arm: RevalidationArm,
): RevalidationProvenance {
	for (const line of stdout.split("\n")) {
		try {
			const value: unknown = JSON.parse(line);
			if (
				typeof value === "object" &&
				value !== null &&
				PROVENANCE_KEYS.every((key) => key in value)
			) {
				return value as RevalidationProvenance;
			}
		} catch {
			// Runner output contains many non-JSON lines; provenance is optional only
			// until validation marks the sample invalid.
		}
	}
	return emptyProvenance(arm);
}

function numberAfter(text: string, word: string): number {
	return Number.parseInt(
		text.match(new RegExp(`(\\d+)\\s+${word}\\b`, "i"))?.[1] ?? "0",
		10,
	);
}

function parseVitestOutcome(stdout: string): RevalidationOutcome | null {
	const filesLine = stdout
		.split("\n")
		.find((line) => /^\s*Test Files\s+/i.test(stripAnsi(line)));
	const testsLine = stdout
		.split("\n")
		.find((line) => /^\s*Tests\s+/i.test(stripAnsi(line)));
	if (!filesLine || !testsLine) return null;
	const files = stripAnsi(filesLine);
	const tests = stripAnsi(testsLine);
	return {
		filesPassed: numberAfter(files, "passed"),
		filesFailed: numberAfter(files, "failed"),
		testsPassed: numberAfter(tests, "passed"),
		testsFailed: numberAfter(tests, "failed"),
		testsSkipped: numberAfter(tests, "skipped"),
		testsTodo: numberAfter(tests, "todo"),
		testFileCount: Number.parseInt(files.match(/\((\d+)\)/)?.[1] ?? "0", 10),
	};
}

function parseBunOutcome(stdout: string): RevalidationOutcome | null {
	const ran = stdout.match(/Ran\s+(\d+)\s+tests?\s+across\s+(\d+)\s+files?/i);
	if (!ran) return null;
	const flat = stdout.split("\n").join(" ");
	const unnamedSkippedTests = stdout
		.split("\n")
		.filter((line) => /\(skip\).*?>\s+\(unnamed\)/i.test(line)).length;
	return {
		filesPassed:
			numberAfter(flat, "pass") === 0 ? 0 : Number.parseInt(ran[2], 10),
		filesFailed:
			numberAfter(flat, "fail") === 0 ? 0 : Number.parseInt(ran[2], 10),
		testsPassed: numberAfter(flat, "pass"),
		testsFailed: numberAfter(flat, "fail"),
		testsSkipped: Math.max(0, numberAfter(flat, "skip") - unnamedSkippedTests),
		testsTodo: numberAfter(flat, "todo"),
		testFileCount: Number.parseInt(ran[2], 10),
	};
}

// biome-ignore lint/complexity/useRegexLiterals: escaped control codes stay readable in a string pattern.
const ANSI_ESCAPE = new RegExp(
	"\\u001B(?:\\[[0-?]*[ -/]*[@-~]|\\][^\\u0007]*(?:\\u0007|\\u001B\\\\))",
	"g",
);

function stripAnsi(value: string): string {
	return value.replace(ANSI_ESCAPE, "").trim();
}

export function parseRunnerOutcome(
	stdout: string,
	runner: RevalidationArm["runner"],
): RevalidationOutcome | null {
	return runner === "vitest"
		? parseVitestOutcome(stdout)
		: parseBunOutcome(stdout);
}

function failureExcerpt(run: MeasuredRun): string | undefined {
	const value = [run.stdout.trim(), run.stderrTail.trim()]
		.filter(Boolean)
		.join("\n");
	return value || undefined;
}

function runnerOutput(run: MeasuredRun): string {
	return [run.stdout, run.stderrTail].filter(Boolean).join("\n");
}

function sampleReasons(
	sample: RevalidationSample,
	arm: RevalidationArm,
): string[] {
	const reasons: string[] = [];
	if (sample.timedOut) reasons.push(`${arm.id}: timeout`);
	if (sample.exitCode !== 0)
		reasons.push(`${arm.id}: exit code ${sample.exitCode}`);
	if (!sample.outcome) reasons.push(`${arm.id}: missing runtime outcome`);
	if (sample.provenance.execPath === "unknown")
		reasons.push(`${arm.id}: missing executable provenance`);
	for (const [key, expected] of Object.entries({
		runtime: arm.runtime,
		runtimeVersion: arm.runtimeVersion,
		runner: arm.runner,
		runnerVersion: arm.runnerVersion,
	}))
		if (sample.provenance[key as keyof RevalidationProvenance] !== expected)
			reasons.push(`${arm.id}: provenance ${key} expected ${expected}`);
	return reasons;
}

async function defaultCommit(): Promise<string> {
	try {
		const { stdout } = await exec("git", ["rev-parse", "HEAD"]);
		return stdout.trim() || "unknown";
	} catch {
		return "unknown";
	}
}

const defaultInventory = async (): Promise<ParityResult> => {
	const reference = await scanTestTree(
		resolve(process.cwd(), "app/tests"),
		"vitest",
	);
	const candidate = await scanTestTree(
		resolve(process.cwd(), "app/tests-bun"),
		"bun:test",
	);
	return compareTestTrees(
		reference,
		candidate,
		DEFAULT_VITEST_ONLY_DISPOSITIONS,
	);
};

export const defaultRevalidationDeps: RevalidationDeps = {
	spawn: spawnMeasured,
	host: collectHostMeta,
	commit: defaultCommit,
	inventory: defaultInventory,
	cwd: process.cwd(),
	env: { ...process.env, TZ: "UTC" },
};

function sampleToStat(sample: RevalidationSample): Sample {
	return {
		ms: sample.durationMs,
		peakRssBytes: sample.peakRssBytes,
		exitCode: sample.exitCode ?? -1,
		loadAvg1: sample.loadAvg1,
	};
}

export async function runRevalidation(
	arms: RevalidationArm[],
	repetitions = 5,
	deps: RevalidationDeps = defaultRevalidationDeps,
): Promise<RevalidationRun> {
	if (arms.length < 2)
		throw new Error("at least two benchmark arms are required");
	if (!Number.isInteger(repetitions) || repetitions < 1)
		throw new Error("repetitions must be a positive integer");
	const samples: RevalidationSample[] = [];
	const armOrderByRepetition: string[][] = [];
	const armById = new Map(arms.map((arm) => [arm.id, arm]));
	const env = { ...deps.env, TZ: "UTC" };

	for (const arm of arms) {
		const run = await deps.spawn(arm.command, env, {
			timeoutMs: arm.timeoutMs,
			cwd: deps.cwd,
		});
		const sample: RevalidationSample = {
			arm: arm.id,
			repetition: 0,
			durationMs: run.ms,
			peakRssBytes: run.peakRssBytes,
			exitCode: run.timedOut ? null : run.exitCode,
			timedOut: run.timedOut,
			loadAvg1: run.loadAvg1,
			provenance: parseProvenance(run.stdout, arm),
			outcome: parseRunnerOutcome(runnerOutput(run), arm.runner),
			excluded: true,
			exclusionReason: "warmup",
			failureExcerpt: failureExcerpt(run),
		};
		samples.push(sample);
	}

	for (let repetition = 1; repetition <= repetitions; repetition += 1) {
		const order = repetition % 2 === 1 ? arms : [...arms].reverse();
		armOrderByRepetition.push(order.map((arm) => arm.id));
		for (const arm of order) {
			const run = await deps.spawn(arm.command, env, {
				timeoutMs: arm.timeoutMs,
				cwd: deps.cwd,
			});
			const reasons = sampleReasons(
				{
					arm: arm.id,
					repetition,
					durationMs: run.ms,
					peakRssBytes: run.peakRssBytes,
					exitCode: run.timedOut ? null : run.exitCode,
					timedOut: run.timedOut,
					loadAvg1: run.loadAvg1,
					provenance: parseProvenance(run.stdout, arm),
					outcome: parseRunnerOutcome(runnerOutput(run), arm.runner),
					excluded: false,
				},
				arm,
			);
			const contamination = deps.contamination?.(run, arm);
			const sample: RevalidationSample = {
				arm: arm.id,
				repetition,
				durationMs: run.ms,
				peakRssBytes: run.peakRssBytes,
				exitCode: run.timedOut ? null : run.exitCode,
				timedOut: run.timedOut,
				loadAvg1: run.loadAvg1,
				provenance: parseProvenance(run.stdout, arm),
				outcome: parseRunnerOutcome(runnerOutput(run), arm.runner),
				excluded: reasons.length > 0 || contamination !== undefined,
				exclusionReason: contamination
					? `contaminated: ${contamination}`
					: reasons.join("; ") || undefined,
				failureExcerpt: failureExcerpt(run),
			};
			samples.push(sample);
		}
	}

	const inventory = await deps.inventory();
	const invalidReasons = [...inventory.reasons];
	for (const sample of samples) {
		const arm = armById.get(sample.arm);
		if (arm && !sample.excluded)
			invalidReasons.push(...sampleReasons(sample, arm));
		if (sample.excluded && sample.repetition > 0 && sample.exclusionReason)
			invalidReasons.push(
				`${sample.arm} repetition ${sample.repetition}: ${sample.exclusionReason}`,
			);
	}
	const validSamples = samples.filter((sample) => !sample.excluded);
	for (const arm of arms) {
		const count = validSamples.filter((sample) => sample.arm === arm.id).length;
		if (count !== repetitions)
			invalidReasons.push(
				`${arm.id}: expected ${repetitions} valid measured samples, got ${count}`,
			);
	}
	const outcomes = arms
		.map((arm) => validSamples.find((sample) => sample.arm === arm.id)?.outcome)
		.filter(
			(outcome): outcome is RevalidationOutcome =>
				outcome !== undefined && outcome !== null,
		);
	for (const outcome of outcomes.slice(1))
		invalidReasons.push(
			...compareRuntimeOutcomes(outcomes[0], outcome).reasons,
		);
	const aggregates: Record<string, Aggregate | null> = {};
	for (const arm of arms)
		aggregates[arm.id] = aggregate(
			validSamples.filter((sample) => sample.arm === arm.id).map(sampleToStat),
		);
	const host = await deps.host();
	return {
		schemaVersion: 1,
		commit: await deps.commit(),
		timestamp: new Date().toISOString(),
		host,
		arms,
		repetitions,
		warmupCount: arms.length,
		armOrderByRepetition,
		samples,
		aggregates,
		inventory,
		validComparison: invalidReasons.length === 0,
		invalidReasons: [...new Set(invalidReasons)].sort(),
	};
}

function bytes(value: number): string {
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function renderRevalidationMarkdown(run: RevalidationRun): string {
	const lines = [
		"# Bun Test revalidation benchmark",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`,
		`- Warmups discarded: ${run.warmupCount}`,
		`- Measured repetitions per arm: ${run.repetitions}`,
		"",
		"## Validity",
		"",
		`- Comparison valid: **${run.validComparison ? "yes" : "no"}**`,
	];
	if (!run.validComparison) {
		lines.push(...run.invalidReasons.map((reason) => `- ${reason}`));
		lines.push("- No performance winner is reported.");
	}
	lines.push("", "## Arms", "");
	for (const arm of run.arms) {
		const aggregateResult = run.aggregates[arm.id];
		lines.push(
			`### ${arm.id}: ${arm.runner} on ${arm.runtime}`,
			"",
			`- Command: \`${arm.command.join(" ")}\``,
			`- Workers: ${arm.workerCount}`,
			`- Isolation: ${arm.isolation}`,
		);
		if (aggregateResult)
			lines.push(
				`- Median: ${aggregateResult.medianMs.toFixed(2)} ms`,
				`- Spread: ${aggregateResult.minMs.toFixed(2)}–${aggregateResult.maxMs.toFixed(2)} ms`,
				`- Median process-tree RSS: ${bytes(aggregateResult.medianPeakRssBytes)}`,
				`- Samples: ${aggregateResult.sampleCount}`,
			);
		else lines.push("- No valid measured samples.");
		lines.push("");
	}
	return `${lines.join("\n")}\n`;
}

export const REVALIDATION_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/bun-test-revalidation",
);

async function reserveStem(dir: string, timestamp: string): Promise<string> {
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10000; suffix += 1) {
		const stem = `run-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try {
			const handle = await open(join(dir, `${stem}.json`), "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve a unique revalidation report name");
}

export async function writeRevalidationReport(
	run: RevalidationRun,
	dir = REVALIDATION_DIR,
): Promise<{ jsonPath: string; markdownPath: string }> {
	await mkdir(dir, { recursive: true });
	const stem = await reserveStem(dir, run.timestamp);
	const jsonPath = join(dir, `${stem}.json`);
	const markdownPath = join(dir, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, renderRevalidationMarkdown(run), "utf8");
	return { jsonPath, markdownPath };
}

export async function readRevalidationReport(
	path: string,
): Promise<RevalidationRun> {
	return JSON.parse(await readFile(path, "utf8")) as RevalidationRun;
}
