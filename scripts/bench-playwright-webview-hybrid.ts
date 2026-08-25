#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { mkdir, open, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import {
	BROWSER_SMOKE_ROUTE_IDS,
	normalizeBrowserSmokeOutcome,
	type BrowserSmokeObservation,
} from "#/lib/browser-bench/contract";
import { collectHostMeta } from "#/lib/bench/host.server";
import { spawnMeasured, type MeasuredRun } from "#/lib/bench/runner.server";
import { classifyDelta } from "#/lib/bench/stats";
import type { Aggregate, HostMeta } from "#/lib/bench/types";
import {
	ANTCLIPS_LOCK_PATH,
	CRM_LOCK_PATH,
	detectBrowserContamination,
} from "./bench-browser-runtimes";
import { startLocalE2EServer } from "./lib/local-e2e-server";
import {
	HYBRID_DRIVER_PROFILES,
	HYBRID_RESULT_PREFIX,
	HYBRID_TEARDOWN_PREFIX,
} from "../tests/e2e-webview/fixtures/browser-smoke";

const exec = promisify(execFile);
const LOCK_ENV = "PLAYWRIGHT_WEBVIEW_LOCKS_HELD";
const LOCK_MARKER = "playwright-webview-hybrid";
const LOCK_WAIT_SECONDS = 3 * 60 * 60;
const SAMPLE_TIMEOUT_MS = 5 * 60_000;
const DEFAULT_REPETITIONS = 5;
const BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/playwright-webview-hybrid/runs",
);

export const HYBRID_PHASES = ["cold", "warm"] as const;
export type HybridPhase = (typeof HYBRID_PHASES)[number];
export type HybridProfile = (typeof HYBRID_DRIVER_PROFILES)[number]["project"];
export type SampleKind = "warmup" | "measured";

export type HybridHarnessResult = {
	schemaVersion: 1;
	profile: HybridProfile;
	phase: HybridPhase;
	startupMs: number;
	driverSetupMs: number;
	warmupMs: number | null;
	actionMs: number;
	routes: BrowserSmokeObservation[];
	passed: boolean;
	runtimeVersion: string;
	browserVersion: string;
};

export type HybridHarnessTeardown = {
	profile: HybridProfile;
	teardownMs: number;
};

export type HybridHarnessOutput = {
	result: unknown;
	teardown: unknown;
};

export type HybridScheduleEntry = {
	profile: string;
	kind: SampleKind;
	run: number;
};

export type HybridSample = {
	profile: HybridProfile;
	phase: HybridPhase;
	kind: SampleKind;
	run: number;
	command: string[];
	startedAt: string;
	finishedAt: string;
	wallMs: number;
	peakRssBytes: number;
	rssTimeGiBSeconds: number;
	loadAvg1: number;
	exitCode: number;
	timedOut: boolean;
	cleanupVerified: boolean;
	startupMs?: number;
	driverSetupMs?: number;
	internalWarmupMs?: number | null;
	actionMs?: number;
	teardownMs?: number;
	runnerOverheadMs?: number;
	runtimeVersion?: string;
	browserVersion?: string;
	routes?: BrowserSmokeObservation[];
	valid: boolean;
	invalidReasons: string[];
	stderrTail?: string;
};

export type MetricSummary = {
	median: number;
	min: number;
	max: number;
	sampleCount: number;
};

export type HybridProfileSummary = {
	profile: HybridProfile;
	phase: HybridPhase;
	valid: boolean;
	invalidReasons: string[];
	warmupCommandWallMs: number | null;
	sampleCount: number;
	wall: MetricSummary | null;
	startup: MetricSummary | null;
	driverSetup: MetricSummary | null;
	internalWarmup: MetricSummary | null;
	action: MetricSummary | null;
	teardown: MetricSummary | null;
	runnerOverhead: MetricSummary | null;
	peakRss: MetricSummary | null;
	rssTime: MetricSummary | null;
};

export type HybridComparison = {
	phase: HybridPhase;
	profile: HybridProfile;
	scope: "engine-matched" | "cross-engine";
	valid: boolean;
	wall: ReturnType<typeof classifyDelta> | null;
	action: ReturnType<typeof classifyDelta> | null;
	peakRssDeltaPct: number | null;
	rssTimeDeltaPct: number | null;
};

export type HybridBenchmarkRun = {
	schemaVersion: 1;
	commit: string;
	timestamp: string;
	host: HostMeta;
	repetitions: number;
	warmupCommandsPerProfilePhase: 1;
	internalWarmupPassesPerWarmSample: 1;
	serverExcludedFromSamples: true;
	routeIds: readonly string[];
	profiles: readonly HybridProfile[];
	phases: readonly HybridPhase[];
	schedule: Array<HybridScheduleEntry & { phase: HybridPhase; sequence: number }>;
	samples: HybridSample[];
	summaries: HybridProfileSummary[];
	comparisons: HybridComparison[];
	locks: string[];
};

function finiteNonNegative(value: unknown): value is number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function objectValue(value: unknown): value is object {
	return typeof value === "object" && value !== null;
}

function profileValue(value: unknown): value is HybridProfile {
	return HYBRID_DRIVER_PROFILES.some((profile) => profile.project === value);
}

function phaseValue(value: unknown): value is HybridPhase {
	return value === "cold" || value === "warm";
}

function isHarnessResult(value: unknown): value is HybridHarnessResult {
	if (!objectValue(value)) return false;
	const normalized = normalizeBrowserSmokeOutcome({ routes: Reflect.get(value, "routes") });
	return (
		Reflect.get(value, "schemaVersion") === 1 &&
		profileValue(Reflect.get(value, "profile")) &&
		phaseValue(Reflect.get(value, "phase")) &&
		finiteNonNegative(Reflect.get(value, "startupMs")) &&
		finiteNonNegative(Reflect.get(value, "driverSetupMs")) &&
		(Reflect.get(value, "warmupMs") === null ||
			finiteNonNegative(Reflect.get(value, "warmupMs"))) &&
		finiteNonNegative(Reflect.get(value, "actionMs")) &&
		Boolean(normalized) &&
		typeof Reflect.get(value, "passed") === "boolean" &&
		typeof Reflect.get(value, "runtimeVersion") === "string" &&
		typeof Reflect.get(value, "browserVersion") === "string"
	);
}

function isHarnessTeardown(value: unknown): value is HybridHarnessTeardown {
	return (
		objectValue(value) &&
		profileValue(Reflect.get(value, "profile")) &&
		finiteNonNegative(Reflect.get(value, "teardownMs"))
	);
}

function markerValue(stdout: string, prefix: string): unknown {
	for (const line of stdout.split("\n").reverse()) {
		const index = line.indexOf(prefix);
		if (index < 0) continue;
		const raw = line
			.slice(index + prefix.length)
			.replaceAll(/\u001B\[[0-?]*[ -/]*[@-~]/g, "")
			.trim();
		try {
			return JSON.parse(raw);
		} catch {
			return undefined;
		}
	}
	return undefined;
}

export function parseHybridHarnessOutput(stdout: string): HybridHarnessOutput {
	return {
		result: markerValue(stdout, HYBRID_RESULT_PREFIX),
		teardown: markerValue(stdout, HYBRID_TEARDOWN_PREFIX),
	};
}

export function validateHybridHarnessResult(
	output: HybridHarnessOutput,
	profile: HybridProfile,
	phase: HybridPhase,
): string[] {
	const reasons: string[] = [];
	if (!objectValue(output.result)) return ["missing result marker"];
	const normalized = normalizeBrowserSmokeOutcome({
		routes: Reflect.get(output.result, "routes"),
	});
	if (!normalized || !normalized.passed) reasons.push("invalid five-route outcome");
	if (!isHarnessResult(output.result)) reasons.push("invalid lifecycle result marker");
	if (Reflect.get(output.result, "profile") !== profile) reasons.push("profile mismatch");
	if (Reflect.get(output.result, "phase") !== phase) reasons.push("phase mismatch");
	if (!/^1\.4\./.test(String(Reflect.get(output.result, "runtimeVersion")))) {
		reasons.push("runtime is not Bun 1.4");
	}
	const warmup = Reflect.get(output.result, "warmupMs");
	if (phase === "cold" && warmup !== null) reasons.push("cold sample contains warmup");
	if (phase === "warm" && !finiteNonNegative(warmup)) {
		reasons.push("warm sample is missing internal warmup");
	}
	if (!isHarnessTeardown(output.teardown)) {
		reasons.push("missing teardown marker");
	} else if (output.teardown.profile !== profile) {
		reasons.push("teardown profile mismatch");
	}
	return [...new Set(reasons)];
}

export function buildHybridSchedule(
	profiles: readonly { project: string }[],
	repetitions: number,
): HybridScheduleEntry[] {
	const schedule: HybridScheduleEntry[] = profiles.map((profile) => ({
		profile: profile.project,
		kind: "warmup" as const,
		run: 0,
	}));
	for (let run = 1; run <= repetitions; run += 1) {
		const offset = (run - 1) % profiles.length;
		const rotated = [...profiles.slice(offset), ...profiles.slice(0, offset)];
		for (const profile of rotated) {
			schedule.push({ profile: profile.project, kind: "measured", run });
		}
	}
	return schedule;
}

export function commandForHybridProfile(profile: HybridProfile): string[] {
	return [
		"bunx",
		"--bun",
		"playwright",
		"test",
		"--config=playwright.webview.config.ts",
		`--project=${profile}`,
		"--workers=1",
		"--retries=0",
		"--reporter=line",
	];
}

function metricSummary(values: number[]): MetricSummary | null {
	if (values.length === 0) return null;
	const sorted = [...values].sort((left, right) => left - right);
	const middle = Math.floor(sorted.length / 2);
	const median =
		sorted.length % 2 === 1
			? sorted[middle]
			: (sorted[middle - 1] + sorted[middle]) / 2;
	return {
		median,
		min: sorted[0],
		max: sorted.at(-1) ?? sorted[0],
		sampleCount: sorted.length,
	};
}

function deltaAggregate(summary: MetricSummary): Aggregate {
	return {
		medianMs: summary.median,
		minMs: summary.min,
		maxMs: summary.max,
		medianPeakRssBytes: 0,
		sampleCount: summary.sampleCount,
		medianLoadAvg1: 0,
		maxLoadAvg1: 0,
	};
}

function deltaPct(before: number, after: number): number {
	return before === 0 ? 0 : ((after - before) / before) * 100;
}

function summarize(
	profile: HybridProfile,
	phase: HybridPhase,
	samples: HybridSample[],
	repetitions: number,
): HybridProfileSummary {
	const warmup = samples.find(
		(sample) =>
			sample.profile === profile && sample.phase === phase && sample.kind === "warmup",
	);
	const measured = samples.filter(
		(sample) =>
			sample.profile === profile && sample.phase === phase && sample.kind === "measured",
	);
	const valid = Boolean(
		warmup?.valid &&
			measured.length === repetitions &&
			measured.every((sample) => sample.valid),
	);
	const validSamples = valid ? measured : [];
	const invalidReasons = [
		...(warmup?.invalidReasons ?? ["missing discarded command"]),
		...measured.flatMap((sample) => sample.invalidReasons),
		...(measured.length === repetitions
			? []
			: [`expected ${repetitions} measured samples, got ${measured.length}`]),
	];
	return {
		profile,
		phase,
		valid,
		invalidReasons: [...new Set(invalidReasons)],
		warmupCommandWallMs: warmup?.wallMs ?? null,
		sampleCount: validSamples.length,
		wall: metricSummary(validSamples.map((sample) => sample.wallMs)),
		startup: metricSummary(validSamples.flatMap((sample) => sample.startupMs ?? [])),
		driverSetup: metricSummary(
			validSamples.flatMap((sample) => sample.driverSetupMs ?? []),
		),
		internalWarmup: metricSummary(
			validSamples.flatMap((sample) => sample.internalWarmupMs ?? []),
		),
		action: metricSummary(validSamples.flatMap((sample) => sample.actionMs ?? [])),
		teardown: metricSummary(
			validSamples.flatMap((sample) => sample.teardownMs ?? []),
		),
		runnerOverhead: metricSummary(
			validSamples.flatMap((sample) => sample.runnerOverheadMs ?? []),
		),
		peakRss: metricSummary(validSamples.map((sample) => sample.peakRssBytes)),
		rssTime: metricSummary(
			validSamples.map((sample) => sample.rssTimeGiBSeconds),
		),
	};
}

export function buildHybridComparisons(
	summaries: HybridProfileSummary[],
): HybridComparison[] {
	return HYBRID_PHASES.flatMap((phase) => {
		const baseline = summaries.find(
			(summary) => summary.phase === phase && summary.profile === "playwright-page",
		);
		return (["bun-webview-webkit", "bun-webview-chrome"] as const).map(
			(profile) => {
				const candidate = summaries.find(
					(summary) => summary.phase === phase && summary.profile === profile,
				);
				const valid = Boolean(
					baseline?.valid &&
					candidate?.valid &&
					baseline.wall &&
					candidate.wall &&
					baseline.action &&
					candidate.action &&
					baseline.peakRss &&
					candidate.peakRss &&
					baseline.rssTime &&
					candidate.rssTime,
				);
				return {
					phase,
					profile,
					scope: profile === "bun-webview-chrome" ? "engine-matched" : "cross-engine",
					valid,
					wall:
						valid && baseline?.wall && candidate?.wall
							? classifyDelta(
									deltaAggregate(baseline.wall),
									deltaAggregate(candidate.wall),
								)
							: null,
					action:
						valid && baseline?.action && candidate?.action
							? classifyDelta(
									deltaAggregate(baseline.action),
									deltaAggregate(candidate.action),
								)
							: null,
					peakRssDeltaPct:
						valid && baseline?.peakRss && candidate?.peakRss
							? deltaPct(
									baseline.peakRss.median,
									candidate.peakRss.median,
								)
							: null,
					rssTimeDeltaPct:
						valid && baseline?.rssTime && candidate?.rssTime
							? deltaPct(
									baseline.rssTime.median,
									candidate.rssTime.median,
								)
							: null,
				};
			},
		);
	});
}

export function measurementInvalidReasons(
	measured: Pick<
		MeasuredRun,
		"cleanupVerified" | "exitCode" | "timedOut"
	>,
): string[] {
	const reasons: string[] = [];
	if (measured.exitCode !== 0) reasons.push(`exit code ${measured.exitCode}`);
	if (measured.timedOut) reasons.push("timed out");
	if (!measured.cleanupVerified) reasons.push("process group cleanup failed");
	return reasons;
}

async function externalContamination(): Promise<string | undefined> {
	try {
		const { stdout } = await exec("ps", ["-axo", "pid=,pgid=,command="]);
		return detectBrowserContamination(stdout, process.cwd());
	} catch {
		return undefined;
	}
}

function measuredEnvironment(
	baseUrl: string,
	phase: HybridPhase,
	outputDir: string,
): NodeJS.ProcessEnv {
	const environment: NodeJS.ProcessEnv = {
		...process.env,
		NO_COLOR: "1",
		PLAYWRIGHT_WEBVIEW_EXTERNAL_SERVER: "1",
		PLAYWRIGHT_WEBVIEW_BASE_URL: baseUrl,
		PLAYWRIGHT_WEBVIEW_BENCHMARK_PHASE: phase,
		PLAYWRIGHT_WEBVIEW_OUTPUT_DIR: outputDir,
	};
	delete environment.FORCE_COLOR;
	return environment;
}

async function sample(
	profile: HybridProfile,
	phase: HybridPhase,
	kind: SampleKind,
	run: number,
	baseUrl: string,
): Promise<HybridSample> {
	const command = commandForHybridProfile(profile);
	const outputDir = join(
		tmpdir(),
		`blog-playwright-webview-${process.pid}-${phase}-${profile}-${kind}-${run}`,
	);
	await rm(outputDir, { recursive: true, force: true });
	const startedAt = new Date().toISOString();
	const measured = await spawnMeasured(
		command,
		measuredEnvironment(baseUrl, phase, outputDir),
		{
			timeoutMs: SAMPLE_TIMEOUT_MS,
			cwd: process.cwd(),
		},
	);
	await rm(outputDir, { recursive: true, force: true });
	const finishedAt = new Date().toISOString();
	const output = parseHybridHarnessOutput(measured.stdout);
	const invalidReasons = validateHybridHarnessResult(output, profile, phase);
	invalidReasons.push(...measurementInvalidReasons(measured));
	const contamination = await externalContamination();
	if (contamination) invalidReasons.push(`external browser contamination: ${contamination}`);

	const result = isHarnessResult(output.result) ? output.result : undefined;
	const teardown = isHarnessTeardown(output.teardown) ? output.teardown : undefined;
	const internalWarmupMs = result?.warmupMs;
	const runnerOverheadMs =
		result && teardown
			? Math.max(
					0,
					measured.ms -
						result.startupMs -
						(result.warmupMs ?? 0) -
						result.actionMs -
						teardown.teardownMs,
				)
			: undefined;
	return {
		profile,
		phase,
		kind,
		run,
		command,
		startedAt,
		finishedAt,
		wallMs: measured.ms,
		peakRssBytes: measured.peakRssBytes,
		rssTimeGiBSeconds:
			(measured.ms / 1000) * (measured.peakRssBytes / 1024 ** 3),
		loadAvg1: measured.loadAvg1 ?? 0,
		exitCode: measured.exitCode,
		timedOut: measured.timedOut,
		cleanupVerified: measured.cleanupVerified === true,
		...(result
			? {
					startupMs: result.startupMs,
					driverSetupMs: result.driverSetupMs,
					internalWarmupMs,
					actionMs: result.actionMs,
					runtimeVersion: result.runtimeVersion,
					browserVersion: result.browserVersion,
					routes: result.routes,
				}
			: {}),
		...(teardown ? { teardownMs: teardown.teardownMs } : {}),
		...(runnerOverheadMs === undefined ? {} : { runnerOverheadMs }),
		valid: invalidReasons.length === 0,
		invalidReasons: [...new Set(invalidReasons)],
		...(measured.stderrTail ? { stderrTail: measured.stderrTail } : {}),
	};
}

async function commitSha(): Promise<string> {
	return (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
}

async function reserveStem(timestamp: string): Promise<string> {
	await mkdir(BENCHMARK_DIR, { recursive: true });
	const base = timestamp.replaceAll(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `run-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try {
			const handle = await open(join(BENCHMARK_DIR, `${stem}.json`), "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if (!objectValue(error) || Reflect.get(error, "code") !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve hybrid benchmark report name");
}

function milliseconds(value: MetricSummary | null): string {
	return value ? `${value.median.toFixed(2)} ms` : "—";
}

function megabytes(value: MetricSummary | null): string {
	return value ? `${(value.median / 1024 ** 2).toFixed(1)} MiB` : "—";
}

function percent(value: number | null): string {
	return value === null ? "—" : `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function renderHybridBenchmark(run: HybridBenchmarkRun): string {
	const lines = [
		"# Playwright Test with Bun.WebView hybrid benchmark",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`,
		`- Protocol: one discarded command + ${run.repetitions} measured commands per profile/phase`,
		"- Server: one seeded Bun server outside every measured process tree",
		"- Warm samples: one in-session five-route warmup is reported but excluded from action time",
		"",
		"| Phase | Profile | Valid | Wall incl. warmup | Startup | Driver setup | Internal warmup | Actions | Teardown | Runner residual | Peak RSS | RSS×time |",
		"| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
	];
	for (const summary of run.summaries) {
		lines.push(
			`| ${summary.phase} | ${summary.profile} | ${summary.valid ? "yes" : "no"} | ${milliseconds(summary.wall)} | ${milliseconds(summary.startup)} | ${milliseconds(summary.driverSetup)} | ${milliseconds(summary.internalWarmup)} | ${milliseconds(summary.action)} | ${milliseconds(summary.teardown)} | ${milliseconds(summary.runnerOverhead)} | ${megabytes(summary.peakRss)} | ${summary.rssTime ? `${summary.rssTime.median.toFixed(3)} GiB·s` : "—"} |`,
		);
	}
	lines.push(
		"",
		"| Phase | Candidate | Scope | Wall delta | Action delta | Peak RSS delta | RSS×time delta | Verdict |",
		"| --- | --- | --- | ---: | ---: | ---: | ---: | --- |",
	);
	for (const comparison of run.comparisons) {
		lines.push(
			`| ${comparison.phase} | ${comparison.profile} | ${comparison.scope} | ${comparison.wall ? percent(comparison.wall.deltaPct) : "—"} | ${comparison.action ? percent(comparison.action.deltaPct) : "—"} | ${percent(comparison.peakRssDeltaPct)} | ${percent(comparison.rssTimeDeltaPct)} | ${comparison.valid ? `${comparison.wall?.verdict ?? "invalid"}; action ${comparison.action?.verdict ?? "invalid"}` : "invalid"} |`,
		);
	}
	lines.push(
		"",
		"Negative deltas favor the WebView candidate. WebKit is cross-engine evidence. Only bun-webview-chrome is directly engine-matched with Playwright Page Chromium.",
		"Whole-command warm wall includes the in-session warmup; the Actions column excludes it. Cold and warm rows are never compared to each other.",
		"Bun.WebView remains experimental and local-only. Playwright retains the complete 49-test E2E suite.",
		"",
	);
	return lines.join("\n");
}

export async function runHybridBenchmark(
	repetitions = DEFAULT_REPETITIONS,
): Promise<HybridBenchmarkRun> {
	const contamination = await externalContamination();
	if (contamination) {
		throw new Error(`external browser contamination before benchmark: ${contamination}`);
	}
	const server = await startLocalE2EServer({
		quiet: true,
		env: { E2E_BROWSER_SMOKE: "true" },
	});
	const samples: HybridSample[] = [];
	const schedule: HybridBenchmarkRun["schedule"] = [];
	try {
		for (const phase of HYBRID_PHASES) {
			for (const entry of buildHybridSchedule(HYBRID_DRIVER_PROFILES, repetitions)) {
				const profile = HYBRID_DRIVER_PROFILES.find(
					(candidate) => candidate.project === entry.profile,
				)?.project;
				if (!profile) throw new Error(`unknown scheduled profile: ${entry.profile}`);
				schedule.push({ ...entry, phase, sequence: schedule.length });
				samples.push(
					await sample(profile, phase, entry.kind, entry.run, server.baseUrl),
				);
			}
		}
	} finally {
		await server.stop();
	}

	const summaries = HYBRID_PHASES.flatMap((phase) =>
		HYBRID_DRIVER_PROFILES.map((profile) =>
			summarize(profile.project, phase, samples, repetitions),
		),
	);
	return {
		schemaVersion: 1,
		commit: await commitSha(),
		timestamp: new Date().toISOString(),
		host: await collectHostMeta(),
		repetitions,
		warmupCommandsPerProfilePhase: 1,
		internalWarmupPassesPerWarmSample: 1,
		serverExcludedFromSamples: true,
		routeIds: BROWSER_SMOKE_ROUTE_IDS,
		profiles: HYBRID_DRIVER_PROFILES.map((profile) => profile.project),
		phases: HYBRID_PHASES,
		schedule,
		samples,
		summaries,
		comparisons: buildHybridComparisons(summaries),
		locks: [CRM_LOCK_PATH, ANTCLIPS_LOCK_PATH],
	};
}

function parseRepetitions(args: string[]): number {
	let repetitions = DEFAULT_REPETITIONS;
	for (const arg of args) {
		if (arg.startsWith("--repetitions=")) {
			repetitions = Number(arg.slice("--repetitions=".length));
		} else if (arg === "--help") {
			console.log(
				"Usage: bun run scripts/bench-playwright-webview-hybrid.ts [--repetitions=N]",
			);
			process.exit(0);
		} else {
			throw new Error(`unknown argument: ${arg}`);
		}
	}
	if (!Number.isInteger(repetitions) || repetitions < 1) {
		throw new Error("--repetitions must be a positive integer");
	}
	return repetitions;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (process.env[LOCK_ENV] !== LOCK_MARKER) {
		const result = await exec(
			"lockf",
			[
				"-ks",
				"-t",
				String(LOCK_WAIT_SECONDS),
				CRM_LOCK_PATH,
				"lockf",
				"-ks",
				"-t",
				String(LOCK_WAIT_SECONDS),
				ANTCLIPS_LOCK_PATH,
				process.execPath,
				fileURLToPath(import.meta.url),
				...args,
			],
			{ env: { ...process.env, [LOCK_ENV]: LOCK_MARKER } },
		);
		process.stdout.write(result.stdout);
		process.stderr.write(result.stderr);
		return;
	}

	const run = await runHybridBenchmark(parseRepetitions(args));
	const stem = await reserveStem(run.timestamp);
	const jsonPath = join(BENCHMARK_DIR, `${stem}.json`);
	const markdownPath = join(BENCHMARK_DIR, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, `${renderHybridBenchmark(run)}\n`, "utf8");
	console.log(`JSON: ${jsonPath}`);
	console.log(`Markdown: ${markdownPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
