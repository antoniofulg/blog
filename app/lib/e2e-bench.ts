import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { aggregate, classifyDelta } from "#/lib/bench/stats";
import type { Aggregate, HostMeta, Sample } from "#/lib/bench/types";

export type E2ESmokeArm = "playwright" | "webview";
export type E2EBenchmarkMode = "cold" | "warm-session";
export type E2EBenchmarkPhase = "warmup" | "measured";

export type E2ESmokeScenario = {
	id: string;
	path: string;
	expectedLang?: string;
	expectedHeading?: string;
	expectedText?: string;
	expectedCanonicalPath?: string;
};

export type E2EPageSnapshot = {
	readyState: string;
	lang: string;
	headings: string[];
	bodyText: string;
	canonical: string | null;
};

export type E2EScenarioResult = {
	id: string;
	passed: boolean;
	error?: string;
};

export type E2EPassOutcome = {
	durationMs: number;
	browserRssBytes: number;
	scenarios: E2EScenarioResult[];
};

type E2EOutcomeProvenance = {
	schemaVersion: 1;
	arm: E2ESmokeArm;
	runtime: "bun";
	runtimeVersion: string;
	automationVersion: string;
	browserExecutable: string;
	viewport: { width: number; height: number };
};

export type E2ESmokeOutcome = E2EOutcomeProvenance & E2EPassOutcome;

export type E2ESessionOutcome = E2EOutcomeProvenance & {
	warmup: E2EPassOutcome;
	passes: E2EPassOutcome[];
};

export type E2EBenchmarkSample = Sample & {
	repetition: number;
	arm: E2ESmokeArm;
	phase: E2EBenchmarkPhase;
	session?: number;
	timedOut: boolean;
	outcome: E2ESmokeOutcome | null;
	failureExcerpt?: string;
};

export type E2ESessionTotal = Sample & {
	arm: E2ESmokeArm;
	session: number;
	timedOut: boolean;
};

export type E2EBenchmarkRun = {
	schemaVersion: 2;
	mode: E2EBenchmarkMode;
	timestamp: string;
	commit: string;
	host: HostMeta;
	repetitions: number;
	warmupsPerArm: number;
	sessionsPerArm: number;
	scenarios: E2ESmokeScenario[];
	warmups: E2EBenchmarkSample[];
	samples: E2EBenchmarkSample[];
	sessionTotals: E2ESessionTotal[];
	validComparison: boolean;
	invalidReasons: string[];
};

export const E2E_VIEWPORT = { width: 1280, height: 720 } as const;

export const E2E_SMOKE_SCENARIOS: E2ESmokeScenario[] = [
	{
		id: "en-post",
		path: "/e2e-public-fixture",
		expectedLang: "en",
		expectedHeading: "E2E Public Fixture",
		expectedText: "English body",
	},
	{
		id: "pt-br-post",
		path: "/pt-br/e2e-public-fixture",
		expectedLang: "pt-BR",
		expectedHeading: "E2E Fixture Público",
		expectedText: "português",
	},
	{
		id: "en-index",
		path: "/",
		expectedLang: "en",
		expectedCanonicalPath: "/",
	},
	{
		id: "pt-br-index",
		path: "/pt-br/",
		expectedLang: "pt-BR",
		expectedCanonicalPath: "/pt-br/",
	},
	{
		id: "not-found",
		path: "/this-slug-does-not-exist-e2e-99999",
		expectedHeading: "Post not found",
	},
];

export const E2E_SMOKE_RESULT_PREFIX = "E2E_SMOKE_RESULT ";
export const E2E_SESSION_RESULT_PREFIX = "E2E_SESSION_RESULT ";

export const PAGE_SNAPSHOT_EXPRESSION = `(() => ({
  readyState: document.readyState,
  lang: document.documentElement.lang,
  headings: [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean),
  bodyText: document.body.innerText,
  canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
}))()`;

function canonicalPath(value: string | null): string | null {
	if (!value) return null;
	try {
		return new URL(value).pathname;
	} catch {
		return null;
	}
}

export function assessScenario(
	scenario: E2ESmokeScenario,
	snapshot: E2EPageSnapshot,
): E2EScenarioResult {
	const errors: string[] = [];
	if (snapshot.readyState !== "complete")
		errors.push(`readyState=${snapshot.readyState}`);
	if (scenario.expectedLang && snapshot.lang !== scenario.expectedLang)
		errors.push(`lang expected ${scenario.expectedLang}, got ${snapshot.lang}`);
	if (
		scenario.expectedHeading &&
		!snapshot.headings.includes(scenario.expectedHeading)
	)
		errors.push(`heading not found: ${scenario.expectedHeading}`);
	if (
		scenario.expectedText &&
		!snapshot.bodyText.includes(scenario.expectedText)
	)
		errors.push(`text not found: ${scenario.expectedText}`);
	if (
		scenario.expectedCanonicalPath &&
		canonicalPath(snapshot.canonical) !== scenario.expectedCanonicalPath
	)
		errors.push(
			`canonical expected ${scenario.expectedCanonicalPath}, got ${canonicalPath(snapshot.canonical) ?? "missing"}`,
		);
	return {
		id: scenario.id,
		passed: errors.length === 0,
		...(errors.length === 0 ? {} : { error: errors.join("; ") }),
	};
}

export function benchmarkOrder(
	repetitions: number,
): Array<{ repetition: number; arm: E2ESmokeArm }> {
	return Array.from({ length: repetitions }, (_, repetition) =>
		repetition % 2 === 0
			? (["playwright", "webview"] as const)
			: (["webview", "playwright"] as const),
	).flatMap((arms, repetition) =>
		arms.map((arm) => ({ repetition: repetition + 1, arm })),
	);
}

function parsePrefixed<T>(stdout: string, prefix: string): T | null {
	for (const line of stdout.split("\n").reverse()) {
		if (!line.startsWith(prefix)) continue;
		try {
			return JSON.parse(line.slice(prefix.length)) as T;
		} catch {
			return null;
		}
	}
	return null;
}

export function parseSmokeOutcome(stdout: string): E2ESmokeOutcome | null {
	return parsePrefixed(stdout, E2E_SMOKE_RESULT_PREFIX);
}

export function parseSessionOutcome(stdout: string): E2ESessionOutcome | null {
	return parsePrefixed(stdout, E2E_SESSION_RESULT_PREFIX);
}

function expectedScenarioIds(): string[] {
	return E2E_SMOKE_SCENARIOS.map((scenario) => scenario.id);
}

function sampleReasons(sample: E2EBenchmarkSample): string[] {
	const reasons: string[] = [];
	if (sample.timedOut) reasons.push(`${sample.arm}: timed out`);
	if (sample.exitCode !== 0)
		reasons.push(`${sample.arm}: exit code ${sample.exitCode}`);
	if (!sample.outcome) return [...reasons, `${sample.arm}: outcome missing`];
	if (sample.outcome.arm !== sample.arm)
		reasons.push(`${sample.arm}: outcome arm mismatch`);
	if (sample.outcome.runtime !== "bun")
		reasons.push(`${sample.arm}: runtime is not Bun`);
	if (JSON.stringify(sample.outcome.viewport) !== JSON.stringify(E2E_VIEWPORT))
		reasons.push(`${sample.arm}: viewport mismatch`);
	const ids = sample.outcome.scenarios.map((scenario) => scenario.id);
	if (JSON.stringify(ids) !== JSON.stringify(expectedScenarioIds()))
		reasons.push(`${sample.arm}: scenario inventory mismatch`);
	for (const scenario of sample.outcome.scenarios) {
		if (!scenario.passed)
			reasons.push(
				`${sample.arm}: ${scenario.id} failed${scenario.error ? ` (${scenario.error})` : ""}`,
			);
	}
	return reasons;
}

export function buildE2EBenchmarkRun(input: {
	mode?: E2EBenchmarkMode;
	timestamp: string;
	commit: string;
	host: HostMeta;
	repetitions: number;
	warmupsPerArm?: number;
	sessionsPerArm?: number;
	warmups?: E2EBenchmarkSample[];
	samples: E2EBenchmarkSample[];
	sessionTotals?: E2ESessionTotal[];
}): E2EBenchmarkRun {
	const mode = input.mode ?? "cold";
	const warmups = input.warmups ?? [];
	const warmupsPerArm = input.warmupsPerArm ?? 0;
	const sessionsPerArm = input.sessionsPerArm ?? 0;
	const sessionTotals = input.sessionTotals ?? [];
	const reasons = [...warmups, ...input.samples].flatMap(sampleReasons);
	for (const arm of ["playwright", "webview"] as const) {
		const sampleCount = input.samples.filter(
			(sample) => sample.arm === arm,
		).length;
		const warmupCount = warmups.filter((sample) => sample.arm === arm).length;
		const sessionCount = sessionTotals.filter(
			(sample) => sample.arm === arm,
		).length;
		if (sampleCount !== input.repetitions)
			reasons.push(
				`${arm}: expected ${input.repetitions} samples, received ${sampleCount}`,
			);
		if (warmupCount !== warmupsPerArm)
			reasons.push(
				`${arm}: expected ${warmupsPerArm} warmups, received ${warmupCount}`,
			);
		if (sessionCount !== sessionsPerArm)
			reasons.push(
				`${arm}: expected ${sessionsPerArm} session totals, received ${sessionCount}`,
			);
	}
	const executables = new Set(
		[...warmups, ...input.samples]
			.map((sample) => sample.outcome?.browserExecutable)
			.filter((value): value is string => Boolean(value)),
	);
	if (executables.size !== 1) reasons.push("browser executable mismatch");
	return {
		schemaVersion: 2,
		mode,
		timestamp: input.timestamp,
		commit: input.commit,
		host: input.host,
		repetitions: input.repetitions,
		warmupsPerArm,
		sessionsPerArm,
		scenarios: E2E_SMOKE_SCENARIOS,
		warmups,
		samples: input.samples,
		sessionTotals,
		validComparison: reasons.length === 0,
		invalidReasons: [...new Set(reasons)],
	};
}

function samplesFor(
	run: E2EBenchmarkRun,
	arm: E2ESmokeArm,
	includeWarmups = false,
): E2EBenchmarkSample[] {
	return [...(includeWarmups ? run.warmups : []), ...run.samples].filter(
		(sample) => sample.arm === arm,
	);
}

function aggregateSamples(samples: E2EBenchmarkSample[]): Aggregate | null {
	return aggregate(
		samples.map(({ ms, peakRssBytes, exitCode, loadAvg1 }) => ({
			ms,
			peakRssBytes,
			exitCode,
			loadAvg1,
		})),
	);
}

function aggregateArm(
	run: E2EBenchmarkRun,
	arm: E2ESmokeArm,
	includeWarmups = false,
): Aggregate | null {
	return aggregateSamples(samplesFor(run, arm, includeWarmups));
}

function aggregateSessionTotals(
	run: E2EBenchmarkRun,
	arm: E2ESmokeArm,
): Aggregate | null {
	return aggregate(run.sessionTotals.filter((sample) => sample.arm === arm));
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	if (sorted.length === 0) return 0;
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianBrowserRss(
	run: E2EBenchmarkRun,
	arm: E2ESmokeArm,
	includeWarmups = false,
): number {
	return median(
		samplesFor(run, arm, includeWarmups).map(
			(sample) => sample.outcome?.browserRssBytes ?? 0,
		),
	);
}

function totalMs(samples: E2EBenchmarkSample[]): number {
	return samples.reduce((total, sample) => total + sample.ms, 0);
}

function mib(value: number): string {
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function resultTable(run: E2EBenchmarkRun, includeWarmups = false): string[] {
	const playwright = aggregateArm(run, "playwright", includeWarmups);
	const webview = aggregateArm(run, "webview", includeWarmups);
	if (!playwright || !webview) return ["Aggregate missing."];
	const delta = classifyDelta(playwright, webview);
	return [
		"| Arm | Median | Min | Max | Total | Median browser RSS | Samples |",
		"| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
		`| Bun + Playwright | ${(playwright.medianMs / 1000).toFixed(3)} s | ${(playwright.minMs / 1000).toFixed(3)} s | ${(playwright.maxMs / 1000).toFixed(3)} s | ${(totalMs(samplesFor(run, "playwright", includeWarmups)) / 1000).toFixed(3)} s | ${mib(medianBrowserRss(run, "playwright", includeWarmups))} | ${playwright.sampleCount} |`,
		`| Bun.WebView | ${(webview.medianMs / 1000).toFixed(3)} s | ${(webview.minMs / 1000).toFixed(3)} s | ${(webview.maxMs / 1000).toFixed(3)} s | ${(totalMs(samplesFor(run, "webview", includeWarmups)) / 1000).toFixed(3)} s | ${mib(medianBrowserRss(run, "webview", includeWarmups))} | ${webview.sampleCount} |`,
		"",
		`WebView delta: ${delta.deltaPct.toFixed(2)}% (${delta.verdict}).`,
	];
}

function sessionTotalsTable(run: E2EBenchmarkRun): string[] {
	const playwright = aggregateSessionTotals(run, "playwright");
	const webview = aggregateSessionTotals(run, "webview");
	if (!playwright || !webview) return ["Session totals unavailable."];
	return [
		"| Arm | Median total process time | Min | Max | Sessions |",
		"| --- | ---: | ---: | ---: | ---: |",
		`| Bun + Playwright | ${(playwright.medianMs / 1000).toFixed(3)} s | ${(playwright.minMs / 1000).toFixed(3)} s | ${(playwright.maxMs / 1000).toFixed(3)} s | ${playwright.sampleCount} |`,
		`| Bun.WebView | ${(webview.medianMs / 1000).toFixed(3)} s | ${(webview.minMs / 1000).toFixed(3)} s | ${(webview.maxMs / 1000).toFixed(3)} s | ${webview.sampleCount} |`,
	];
}

export function renderE2EBenchmark(run: E2EBenchmarkRun): string {
	const lines = [
		`# Bun Playwright vs Bun.WebView — ${run.mode}`,
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`,
		`- Scenarios per pass: ${run.scenarios.length}`,
		`- Measured samples per arm: ${run.repetitions}`,
		`- Warm-ups per arm: ${run.warmupsPerArm}`,
		"- Browser: same Chromium executable in both arms",
		"- Server: one shared Bun server, excluded from measured process groups",
		"",
	];
	if (!run.validComparison) {
		lines.push("## Comparison invalid", "");
		for (const reason of run.invalidReasons) lines.push(`- ${reason}`);
		lines.push("", "No performance conclusion is reported.", "");
		return lines.join("\n");
	}
	lines.push("## Primary result", "", ...resultTable(run), "");
	if (run.mode === "cold") {
		lines.push(
			"## Cold result including warm-up",
			"",
			...resultTable(run, true),
			"",
		);
	} else {
		const passesPerSession =
			run.sessionsPerArm === 0 ? 0 : run.repetitions / run.sessionsPerArm;
		lines.push(
			"## Warm-session result including in-session warm-ups",
			"",
			...resultTable(run, true),
			"",
			"## Whole-session process cost",
			"",
			...sessionTotalsTable(run),
			"",
			`Primary warm-session timings measure only each five-scenario pass with the browser already open. Each whole session includes browser startup, one internal warm-up, ${passesPerSession} measured passes, and shutdown.`,
			"",
		);
	}
	return lines.join("\n");
}

export const E2E_BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/e2e-webview",
);

async function reserveReportStem(
	dir: string,
	mode: E2EBenchmarkMode,
	timestamp: string,
): Promise<string> {
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `comparison-${mode}-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try {
			const handle = await open(join(dir, `${stem}.json`), "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve a unique E2E benchmark report name");
}

export async function writeE2EBenchmark(
	run: E2EBenchmarkRun,
	dir = E2E_BENCHMARK_DIR,
): Promise<{ jsonPath: string; markdownPath: string }> {
	await mkdir(dir, { recursive: true });
	const stem = await reserveReportStem(dir, run.mode, run.timestamp);
	const jsonPath = join(dir, `${stem}.json`);
	const markdownPath = join(dir, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, `${renderE2EBenchmark(run)}\n`, "utf8");
	return { jsonPath, markdownPath };
}

export async function readE2EBenchmark(path: string): Promise<E2EBenchmarkRun> {
	return JSON.parse(await readFile(path, "utf8")) as E2EBenchmarkRun;
}
