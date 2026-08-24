#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { mkdir, mkdtemp, open, readFile, rm, writeFile } from "node:fs/promises";
import { readFileSync } from "node:fs";
import { loadavg } from "node:os";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { collectHostMeta } from "#/lib/bench/host.server";
import {
	killGroup,
	spawnMeasured,
	WORKLOAD_TIMEOUT_MS,
	type MeasuredRun,
} from "#/lib/bench/runner.server";
import { aggregate } from "#/lib/bench/stats";
import type { Aggregate, HostMeta, Sample } from "#/lib/bench/types";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";

const runCommand = promisify(execFile);

export const E2E_RUNTIME_IDS = ["node", "bun"] as const;
export type E2ERuntimeId = (typeof E2E_RUNTIME_IDS)[number];
export const BROWSER = "chromium" as const;
export const DEFAULT_REPETITIONS = 5;
export const MAX_REPETITIONS = 20;
export const WARMUP_COUNT = 1;
export const DEFAULT_WORKERS = 1;
export const PLAYWRIGHT_WORKER_COUNTS = [1, 2] as const;
export const BROWSER_SMOKE_GREP =
	"en post render|pt-br post render|404:|/pt-br/ renders 200|/ renders 200";
export const LOAD_PER_CORE_LIMIT = 1;
export const LOAD_GATE_POLL_INTERVAL_MS = 1_000;
export const LOAD_GATE_TIMEOUT_MS = 5 * 60_000;
export const AMBIENT_LOAD_POLL_INTERVAL_MS = 1_000;
export const E2E_BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/e2e-runtimes",
);

export type RuntimeArm = {
	id: E2ERuntimeId;
	command: string[];
	version: string;
};

export const RUNTIME_ARMS: RuntimeArm[] = [
	{ id: "node", command: ["node", "node_modules/@playwright/test/cli.js"], version: "24" },
	{ id: "bun", command: ["bunx", "--bun", "playwright"], version: "1.4" },
];

export type E2EOutcome = {
	expected: number;
	skipped: number;
	unexpected: number;
	flaky: number;
	inventory: number;
	smokeRoutes: number;
	setupOverhead: number;
};

export type E2ESample = {
	durationMs: number;
	peakRssBytes: number;
	loadStart: number;
	loadMax: number;
	loadEnd: number;
	exitCode: number | null;
	timedOut: boolean;
	loadGateTimedOut: boolean;
	cleanupVerified: boolean;
	command: string[];
	runtimeVersion: string;
	runnerVersion: string;
	browser: typeof BROWSER;
	outcome: E2EOutcome | null;
	failureExcerpt?: string;
};

export type E2EArmResult = {
	runtime: E2ERuntimeId;
	command: string[];
	warmups: number;
	warmupSamples: E2ESample[];
	samples: E2ESample[];
	totalWallTimeMs: number;
	aggregate: Aggregate | null;
	memoryValid: boolean;
	memoryInvalidReasons: string[];
};

export type E2ERuntimeDeltas = {
	medianDurationMs: number;
	medianDurationPct: number;
	medianPeakRssBytes: number;
	medianPeakRssPct: number;
	totalWallTimeMs: number;
	totalWallTimePct: number;
};

export type E2EBenchRun = {
	schemaVersion: 1;
	commit: string;
	timestamp: string;
	host: HostMeta;
	browser: typeof BROWSER;
	serverRuntime: "bun";
	runner: "playwright";
	runnerVersion: string;
	repetitions: number;
	warmupsPerArm: number;
	workers: number;
	retries: 0;
	loadValidity: {
		perCoreLimit: number;
		absoluteLimit: number;
	};
	arms: E2EArmResult[];
	validComparison: boolean;
	validMemoryComparison: boolean;
	validTimingComparison: boolean;
	invalidReasons: string[];
	memoryInvalidReasons: string[];
	timingInvalidReasons: string[];
	memoryWinner: E2ERuntimeId | null;
	winner: E2ERuntimeId | null;
};

export type E2EBenchArgs = {
	repetitions: number;
	workers: (typeof PLAYWRIGHT_WORKER_COUNTS)[number];
	help: boolean;
};

export type E2EBenchDeps = {
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
	validateRuntime: (arm: RuntimeArm) => Promise<string>;
	cleanupProcessGroup: (pgid: number) => Promise<boolean>;
	makeJsonOutputFile: () => Promise<{ directory: string; file: string }>;
	readJson: (file: string) => Promise<string>;
	removeJsonOutput: (directory: string) => Promise<void>;
};

function parsePositiveInt(value: string): number {
	if (!/^\d+$/.test(value)) throw new Error("--repetitions must be a positive integer");
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error("--repetitions must be a positive integer");
	}
	if (parsed > MAX_REPETITIONS) {
		throw new Error(`--repetitions must be at most ${MAX_REPETITIONS}`);
	}
	return parsed;
}

export function parseE2EBenchArgs(args: string[]): E2EBenchArgs {
	const parsed: E2EBenchArgs = {
		repetitions: DEFAULT_REPETITIONS,
		workers: DEFAULT_WORKERS,
		help: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--help" || arg === "-h") {
			parsed.help = true;
			continue;
		}
		if (arg === "--repetitions") {
			const value = args[++index];
			if (!value) throw new Error("--repetitions requires a value");
			parsed.repetitions = parsePositiveInt(value);
			continue;
		}
		if (arg.startsWith("--repetitions=")) {
			parsed.repetitions = parsePositiveInt(arg.slice("--repetitions=".length));
			continue;
		}
		if (arg === "--workers") {
			const value = args[++index];
			if (!value) throw new Error("--workers requires a value");
			parsed.workers = parseWorkers(value);
			continue;
		}
		if (arg.startsWith("--workers=")) {
			parsed.workers = parseWorkers(arg.slice("--workers=".length));
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}
	return parsed;
}

function parseWorkers(value: string): (typeof PLAYWRIGHT_WORKER_COUNTS)[number] {
	if (!/^[12]$/.test(value)) {
		throw new Error("--workers must be 1 or 2");
	}
	return Number(value) as (typeof PLAYWRIGHT_WORKER_COUNTS)[number];
}

export function commandForRuntime(
	arm: RuntimeArm,
	workers = DEFAULT_WORKERS,
): string[] {
	return [
		...arm.command,
		"test",
		"--config=playwright.config.ts",
		`--project=${BROWSER}`,
		`--workers=${workers}`,
		"--retries=0",
		"--grep",
		BROWSER_SMOKE_GREP,
		"--reporter=json",
	];
}

export function parsePlaywrightOutcome(raw: string): E2EOutcome | null {
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null) return null;
	const stats = Reflect.get(value, "stats");
	if (typeof stats !== "object" || stats === null) return null;
	const fields = ["expected", "skipped", "unexpected", "flaky"] as const;
	const counts = fields.map((field) => Reflect.get(stats, field));
	if (
		counts.some(
			(count) =>
				typeof count !== "number" ||
				!Number.isSafeInteger(count) ||
				count < 0,
		)
	) {
		return null;
	}
	const [expected, skipped, unexpected, flaky] = counts as number[];
	return {
		expected,
		skipped,
		unexpected,
		flaky,
		inventory: expected + skipped + unexpected + flaky,
		smokeRoutes: BROWSER_SMOKE_ROUTE_IDS.length,
		setupOverhead: Math.max(0, expected - BROWSER_SMOKE_ROUTE_IDS.length),
	};
}

export function outcomesEqual(
	a: E2EOutcome | null,
	b: E2EOutcome | null,
): boolean {
	if (!a || !b) return a === b;
	return (
		a.expected === b.expected &&
		a.skipped === b.skipped &&
		a.unexpected === b.unexpected &&
		a.flaky === b.flaky &&
		a.inventory === b.inventory
	);
}

export function commandEnvironment(jsonFile: string): NodeJS.ProcessEnv {
	const { CI: _ci, ...environment } = process.env;
	return {
		...environment,
		PLAYWRIGHT_JSON_OUTPUT_FILE: jsonFile,
	};
}

function failureExcerpt(stdout: string, stderrTail: string): string | undefined {
	const excerpt = [stdout.trim(), stderrTail.trim()].filter(Boolean).join("\n");
	return excerpt || undefined;
}

function measuredSample(
	run: MeasuredRun,
	arm: RuntimeArm,
	runnerVersion: string,
	command: string[],
	loadMax: number,
	loadEnd: number,
	loadGateTimedOut: boolean,
	cleanupVerified: boolean,
	outcome: E2EOutcome | null,
): E2ESample {
	return {
		durationMs: run.ms,
		peakRssBytes: run.peakRssBytes,
		loadStart: run.loadAvg1,
		loadMax,
		loadEnd,
		exitCode: run.timedOut ? null : run.exitCode,
		timedOut: run.timedOut,
		loadGateTimedOut,
		cleanupVerified,
		command,
		runtimeVersion: arm.version,
		runnerVersion,
		browser: BROWSER,
		outcome,
		failureExcerpt: failureExcerpt(run.stdout, run.stderrTail),
	};
}

async function waitForLoad(deps: E2EBenchDeps): Promise<boolean> {
	const startedAt = deps.nowMs();
	while (true) {
		const host = await deps.host();
		const limit = LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1);
		if (host.loadAvg1 <= limit) return false;
		if (deps.nowMs() - startedAt >= LOAD_GATE_TIMEOUT_MS) return true;
		await deps.sleep(LOAD_GATE_POLL_INTERVAL_MS);
	}
}

function armResult(
	arm: RuntimeArm,
	warmupSamples: E2ESample[],
	samples: E2ESample[],
): E2EArmResult {
	const timedSamples: Sample[] = samples.map((sample) => ({
		ms: sample.durationMs,
		peakRssBytes: sample.peakRssBytes,
		exitCode: sample.exitCode ?? -1,
		loadAvg1: sample.loadStart,
	}));
	return {
		runtime: arm.id,
		command: commandForRuntime(arm),
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

function percentDelta(before: number, after: number): number {
	return before === 0 ? 0 : ((after - before) / before) * 100;
}

function totalWallTimeForArm(arm: E2EArmResult): number {
	if (typeof arm.totalWallTimeMs === "number") return arm.totalWallTimeMs;
	return [...arm.warmupSamples, ...arm.samples].reduce(
		(total, sample) => total + sample.durationMs,
		0,
	);
}

export function runtimeDeltas(run: E2EBenchRun): E2ERuntimeDeltas | null {
	const node = run.arms.find((arm) => arm.runtime === "node");
	const bun = run.arms.find((arm) => arm.runtime === "bun");
	if (!node?.aggregate || !bun?.aggregate) return null;
	return {
		medianDurationMs: bun.aggregate.medianMs - node.aggregate.medianMs,
		medianDurationPct: percentDelta(node.aggregate.medianMs, bun.aggregate.medianMs),
		medianPeakRssBytes:
			bun.aggregate.medianPeakRssBytes - node.aggregate.medianPeakRssBytes,
		medianPeakRssPct: percentDelta(
			node.aggregate.medianPeakRssBytes,
			bun.aggregate.medianPeakRssBytes,
		),
		totalWallTimeMs: totalWallTimeForArm(bun) - totalWallTimeForArm(node),
		totalWallTimePct: percentDelta(
			totalWallTimeForArm(node),
			totalWallTimeForArm(bun),
		),
	};
}

export function armMemoryValidity(
	arm: E2EArmResult,
	expectedSamples: number,
): { valid: boolean; reasons: string[] } {
	const reasons: string[] = [];
	if (arm.samples.length !== expectedSamples) {
		reasons.push(`expected ${expectedSamples} measured samples, got ${arm.samples.length}`);
	}
	for (const [index, sample] of arm.warmupSamples.entries()) {
		if (!sample.cleanupVerified) reasons.push(`warmup ${index + 1}: orphan process group detected`);
	}
	const reference = arm.samples[0]?.outcome ?? null;
	for (const [index, sample] of arm.samples.entries()) {
		if (sample.timedOut) reasons.push(`sample ${index + 1}: timed out`);
		if (sample.exitCode !== 0) reasons.push(`sample ${index + 1}: exit code ${sample.exitCode}`);
		if (!sample.cleanupVerified) reasons.push(`sample ${index + 1}: orphan process group detected`);
		if (!sample.outcome) reasons.push(`sample ${index + 1}: Playwright outcome missing`);
		if (sample.outcome && sample.outcome.skipped > 0)
			reasons.push(`sample ${index + 1}: skipped tests`);
		if (sample.outcome && sample.outcome.flaky > 0)
			reasons.push(`sample ${index + 1}: flaky tests`);
		if (sample.outcome && sample.outcome.unexpected > 0)
			reasons.push(`sample ${index + 1}: unexpected tests`);
		if (sample.outcome && sample.outcome.expected < BROWSER_SMOKE_ROUTE_IDS.length)
			reasons.push(
				`sample ${index + 1}: fewer than ${BROWSER_SMOKE_ROUTE_IDS.length} canonical smoke routes`,
			);
		if (reference && sample.outcome && !outcomesEqual(reference, sample.outcome)) {
			reasons.push(`sample ${index + 1}: Playwright inventory or outcome changed`);
		}
	}
	if (!reference) reasons.push("reference Playwright outcome missing");
	return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

function winnerFor(arms: E2EArmResult[]): E2ERuntimeId | null {
	return (
		[...arms]
			.filter((arm) => arm.memoryValid && arm.aggregate)
			.sort(
				(a, b) =>
					a.aggregate!.medianPeakRssBytes - b.aggregate!.medianPeakRssBytes,
			)[0]?.runtime ?? null
	);
}

export function timingValidity(
	arms: E2EArmResult[],
	host: HostMeta,
): { valid: boolean; reasons: string[] } {
	const reasons: string[] = [];
	const limit = LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1);
	if (arms.some((arm) => !arm.memoryValid)) {
		reasons.push("timing comparison requires every runtime arm to have valid memory samples");
	}
	for (const arm of arms) {
		for (const [index, sample] of [...arm.warmupSamples, ...arm.samples].entries()) {
			if (sample.loadGateTimedOut) reasons.push(`${arm.runtime} sample ${index + 1}: load gate timed out`);
			if (sample.loadMax > limit) {
				reasons.push(
					`${arm.runtime} sample ${index + 1}: ambient load ${sample.loadMax.toFixed(2)} exceeds ${limit.toFixed(2)}`,
				);
			}
		}
	}
	return { valid: reasons.length === 0, reasons: [...new Set(reasons)] };
}

export async function runE2EBenchmark(
	repetitions = DEFAULT_REPETITIONS,
	deps: E2EBenchDeps = defaultE2EBenchDeps,
	workers = DEFAULT_WORKERS,
): Promise<E2EBenchRun> {
	if (!Number.isInteger(repetitions) || repetitions < 1) {
		throw new Error("repetitions must be a positive integer");
	}
	const versions = new Map<E2ERuntimeId, string>();
	for (const arm of RUNTIME_ARMS) versions.set(arm.id, await deps.validateRuntime(arm));
	const warmups = new Map<E2ERuntimeId, E2ESample[]>();
	const samples = new Map<E2ERuntimeId, E2ESample[]>();
	for (const arm of RUNTIME_ARMS) {
		warmups.set(arm.id, []);
		samples.set(arm.id, []);
	}

	const runOne = async (arm: RuntimeArm, target: E2ESample[]) => {
		const command = commandForRuntime(arm, workers);
		const loadGateTimedOut = await waitForLoad(deps);
		const loadStart = deps.loadAvg();
		let loadMax = loadStart;
		const sampler = setInterval(() => {
			loadMax = Math.max(loadMax, deps.loadAvg());
		}, deps.ambientLoadPollIntervalMs);
		let outputDirectory: string | undefined;
		try {
			const output = await deps.makeJsonOutputFile();
			outputDirectory = output.directory;
			const run = await deps.spawn(command, commandEnvironment(output.file), {
				timeoutMs: WORKLOAD_TIMEOUT_MS,
				cwd: deps.cwd,
			});
			let outcome: E2EOutcome | null = null;
			try {
				outcome = parsePlaywrightOutcome(await deps.readJson(output.file));
			} catch {
				outcome = null;
			}
			const cleanupVerified = await deps.cleanupProcessGroup(run.pgid);
			const loadEnd = deps.loadAvg();
			loadMax = Math.max(loadMax, loadEnd);
			target.push(
				measuredSample(
					{ ...run, loadAvg1: loadStart },
					{ ...arm, version: versions.get(arm.id) ?? arm.version },
					deps.runnerVersion,
					command,
					loadMax,
					loadEnd,
					loadGateTimedOut,
					cleanupVerified,
					outcome,
				),
			);
		} finally {
			clearInterval(sampler);
			loadMax = Math.max(loadMax, deps.loadAvg());
			if (outputDirectory !== undefined) await deps.removeJsonOutput(outputDirectory);
		}
	};

	for (const arm of RUNTIME_ARMS) await runOne(arm, warmups.get(arm.id)!);
	for (let repetition = 0; repetition < repetitions; repetition += 1) {
		const order = repetition % 2 === 0 ? RUNTIME_ARMS : [...RUNTIME_ARMS].reverse();
		for (const arm of order) await runOne(arm, samples.get(arm.id)!);
	}

	const host = await deps.host();
	const arms = RUNTIME_ARMS.map((arm) =>
		armResult(arm, warmups.get(arm.id)!, samples.get(arm.id)!),
	);
	const statuses = arms.map((arm) => ({ arm, ...armMemoryValidity(arm, repetitions) }));
	const reference = statuses[0]?.arm.samples[0]?.outcome ?? null;
	for (const status of statuses) {
		if (status.valid && reference && !outcomesEqual(reference, status.arm.samples[0]?.outcome ?? null)) {
			status.valid = false;
			status.reasons.push("Playwright inventory differs from the reference arm");
		}
		status.arm.memoryValid = status.valid;
		status.arm.memoryInvalidReasons = [...new Set(status.reasons)];
	}
	const memoryInvalidReasons = statuses.flatMap((status) =>
		status.valid ? [] : status.reasons.map((reason) => `${status.arm.runtime}: ${reason}`),
	);
	const validMemory = statuses.length === RUNTIME_ARMS.length && statuses.every((status) => status.valid);
	if (!validMemory) memoryInvalidReasons.push("memory comparison requires both runtime arms to have equivalent valid outcomes");
	const timing = timingValidity(arms, host);
	const uniqueMemoryReasons = [...new Set(memoryInvalidReasons)];
	const invalidReasons = [...new Set([...uniqueMemoryReasons, ...timing.reasons])];
	const memoryWinner = validMemory ? winnerFor(arms) : null;
	return {
		schemaVersion: 1,
		commit: await deps.commit(),
		timestamp: deps.now(),
		host,
		browser: BROWSER,
		serverRuntime: "bun",
		runner: "playwright",
		runnerVersion: deps.runnerVersion,
		repetitions,
		warmupsPerArm: WARMUP_COUNT,
		workers,
		retries: 0,
		loadValidity: {
			perCoreLimit: LOAD_PER_CORE_LIMIT,
			absoluteLimit: LOAD_PER_CORE_LIMIT * Math.max(host.cores, 1),
		},
		arms,
		validComparison: validMemory && timing.valid,
		validMemoryComparison: validMemory,
		validTimingComparison: timing.valid,
		invalidReasons,
		memoryInvalidReasons: uniqueMemoryReasons,
		timingInvalidReasons: timing.reasons,
		memoryWinner,
		winner: validMemory && timing.valid ? memoryWinner : null,
	};
}

function bytes(value: number): string {
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function renderE2EBenchmark(run: E2EBenchRun): string {
	const lines = [
		"# Playwright Node 24 vs Bun 1.4 runtime benchmark",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores, ${bytes(run.host.totalMemBytes)} RAM, load ${run.host.loadAvg1.toFixed(2)})`,
		`- Browser: ${run.browser}; server runtime: Bun; Playwright ${run.runnerVersion}`,
		`- Samples: ${run.warmupsPerArm} warmup retained but excluded + ${run.repetitions} interleaved measured per runtime`,
		`- Configuration: ${run.workers} worker(s), zero retries, same \`playwright.config.ts\`, same Bun application server`,
		`- Inventory: ${BROWSER_SMOKE_ROUTE_IDS.length} canonical public outcomes selected with \`--grep\`; Playwright setup-project tests are reported separately as setup overhead`,
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
	if (!run.validTimingComparison) lines.push("Timing is diagnostic only because timing validity failed.", "");
	for (const arm of run.arms) {
		const result = arm.aggregate;
		lines.push(
			result
				? `- ${arm.runtime}: median ${result.medianMs.toFixed(2)} ms, median peak RSS ${bytes(result.medianPeakRssBytes)}, total wall time ${totalWallTimeForArm(arm).toFixed(2)} ms including warmup, max load ${result.maxLoadAvg1.toFixed(2)}`
				: `- ${arm.runtime}: no samples`,
		);
	}
	const deltas = runtimeDeltas(run);
	if (deltas) {
		lines.push(
			"",
			"## Derived deltas (Bun − Node; calculated from raw samples)",
			"",
			`- Median duration: ${deltas.medianDurationMs.toFixed(2)} ms (${deltas.medianDurationPct.toFixed(2)}%)`,
			`- Median peak RSS: ${bytes(deltas.medianPeakRssBytes)} (${deltas.medianPeakRssPct.toFixed(2)}%)`,
			`- Total wall time including warmup: ${deltas.totalWallTimeMs.toFixed(2)} ms (${deltas.totalWallTimePct.toFixed(2)}%)`,
		);
	}
	if (run.winner) lines.push("", `Winner: **${run.winner}**`, "");
	else if (run.memoryWinner) lines.push("", `Memory winner (timing diagnostic): **${run.memoryWinner}**`, "");
	lines.push(
		"",
		"## Raw samples (warmup included; aggregates exclude warmup)",
		"",
		"| Runtime | Kind | Run | Duration (ms) | Peak RSS | Load start | Load max | Load end | Exit | Inventory | Outcome | Cleanup |",
		"| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | --- | --- |",
	);
	for (const arm of run.arms) {
		for (const [index, sample] of arm.warmupSamples.entries()) {
			lines.push(sampleRow(arm.runtime, "warmup", index + 1, sample));
		}
		for (const [index, sample] of arm.samples.entries()) {
			lines.push(sampleRow(arm.runtime, "measured", index + 1, sample));
		}
	}
	return `${lines.join("\n")}\n`;
}

function sampleRow(
	runtime: E2ERuntimeId,
	kind: string,
	index: number,
	sample: E2ESample,
): string {
		const outcome = sample.outcome
		? `${sample.outcome.smokeRoutes} smoke routes / ${sample.outcome.setupOverhead} setup overhead / ${sample.outcome.skipped} skipped / ${sample.outcome.unexpected} unexpected / ${sample.outcome.flaky} flaky`
		: "missing";
	return `| ${runtime} | ${kind} | ${index} | ${sample.durationMs.toFixed(2)} | ${bytes(sample.peakRssBytes)} | ${sample.loadStart.toFixed(2)} | ${sample.loadMax.toFixed(2)} | ${sample.loadEnd.toFixed(2)} | ${sample.exitCode ?? "timeout"} | ${sample.outcome?.inventory ?? "missing"} | ${outcome} | ${sample.cleanupVerified ? "verified" : "orphan"} |`;
}

async function reserveStem(dir: string, timestamp: string): Promise<string> {
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `runtimes-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try {
			const handle = await open(resolve(dir, `${stem}.json`), "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve a unique E2E benchmark report name");
}

export async function writeE2EBenchmark(
	run: E2EBenchRun,
	dir = E2E_BENCHMARK_DIR,
): Promise<{ jsonPath: string; markdownPath: string }> {
	await mkdir(dir, { recursive: true });
	const stem = await reserveStem(dir, run.timestamp);
	const jsonPath = resolve(dir, `${stem}.json`);
	const markdownPath = resolve(dir, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, renderE2EBenchmark(run), "utf8");
	return { jsonPath, markdownPath };
}

function installedPlaywrightVersion(): string {
	try {
		const packageJson = JSON.parse(
			readFileSync(new URL("../node_modules/@playwright/test/package.json", import.meta.url), "utf8"),
		) as { version?: unknown };
		return typeof packageJson.version === "string" ? packageJson.version : "unknown";
	} catch {
		return "unknown";
	}
}

async function detectRuntimeVersion(arm: RuntimeArm): Promise<string> {
	const binary = arm.id === "node" ? "node" : "bun";
	const result = await runCommand(binary, ["--version"]);
	const version = result.stdout.trim().replace(/^v/, "");
	if (arm.id === "node" && version.split(".")[0] !== "24") {
		throw new Error(`Node runtime benchmark requires major 24, detected ${version}`);
	}
	if (arm.id === "bun" && !/^1\.4\./.test(version)) {
		throw new Error(`Bun runtime benchmark requires 1.4.x, detected ${version}`);
	}
	return version;
}

async function defaultCleanupProcessGroup(pgid: number): Promise<boolean> {
	if (pgid === 0) return true;
	killGroup(pgid, "SIGTERM");
	for (let attempt = 0; attempt < 20; attempt += 1) {
		try {
			process.kill(-pgid, 0);
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code === "ESRCH") return true;
		}
		await new Promise((resolvePromise) => setTimeout(resolvePromise, 25));
	}
	killGroup(pgid, "SIGKILL");
	try {
		process.kill(-pgid, 0);
		return false;
	} catch (error) {
		return (error as NodeJS.ErrnoException).code === "ESRCH";
	}
}

export const defaultE2EBenchDeps: E2EBenchDeps = {
	spawn: spawnMeasured,
	host: collectHostMeta,
	commit: async () => {
		try {
			const result = await runCommand("git", ["rev-parse", "HEAD"]);
			return result.stdout.trim();
		} catch {
			return "unknown";
		}
	},
	now: () => new Date().toISOString(),
	runnerVersion: installedPlaywrightVersion(),
	cwd: process.cwd(),
	sleep: (milliseconds) => new Promise((resolvePromise) => setTimeout(resolvePromise, milliseconds)),
	nowMs: () => Date.now(),
	loadAvg: () => loadavg()[0],
	ambientLoadPollIntervalMs: AMBIENT_LOAD_POLL_INTERVAL_MS,
	validateRuntime: detectRuntimeVersion,
	cleanupProcessGroup: defaultCleanupProcessGroup,
	makeJsonOutputFile: async () => {
		const directory = await mkdtemp(join(tmpdir(), "playwright-e2e-runtime-"));
		return { directory, file: join(directory, "results.json") };
	},
	readJson: (file) => readFile(file, "utf8"),
	removeJsonOutput: (directory) => rm(directory, { recursive: true, force: true }),
};

function usage(): string {
	return [
		"Usage: bun run scripts/bench-e2e-runtimes.ts [--repetitions=N] [--workers=1|2]",
		"Compares Node 24 and Bun 1.4 Playwright on the same Bun server and five-route public smoke.",
		`Measured repetitions: 1-${MAX_REPETITIONS}, default ${DEFAULT_REPETITIONS}; one warmup is retained but excluded.`,
	].join("\n");
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const parsed = parseE2EBenchArgs(args);
	if (parsed.help) {
		console.log(usage());
		return;
	}
	const run = await runE2EBenchmark(
		parsed.repetitions,
		defaultE2EBenchDeps,
		parsed.workers,
	);
	const paths = await writeE2EBenchmark(run);
	console.log(`JSON: ${paths.jsonPath}`);
	console.log(`Markdown: ${paths.markdownPath}`);
	if (!run.validComparison) process.exitCode = 2;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
