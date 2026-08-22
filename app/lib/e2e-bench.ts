import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { aggregate, classifyDelta } from "#/lib/bench/stats";
import type { HostMeta, Sample } from "#/lib/bench/types";

export type E2ESmokeArm = "playwright" | "webview";

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

export type E2ESmokeOutcome = {
	schemaVersion: 1;
	arm: E2ESmokeArm;
	runtime: "bun";
	runtimeVersion: string;
	automationVersion: string;
	browserExecutable: string;
	browserRssBytes: number;
	viewport: { width: number; height: number };
	scenarios: E2EScenarioResult[];
};

export type E2EBenchmarkSample = Sample & {
	repetition: number;
	arm: E2ESmokeArm;
	timedOut: boolean;
	outcome: E2ESmokeOutcome | null;
	failureExcerpt?: string;
};

export type E2EBenchmarkRun = {
	schemaVersion: 1;
	timestamp: string;
	commit: string;
	host: HostMeta;
	repetitions: number;
	warmupsPerArm: number;
	scenarios: E2ESmokeScenario[];
	samples: E2EBenchmarkSample[];
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
	if (snapshot.readyState !== "complete") {
		errors.push(`readyState=${snapshot.readyState}`);
	}
	if (scenario.expectedLang && snapshot.lang !== scenario.expectedLang) {
		errors.push(`lang expected ${scenario.expectedLang}, got ${snapshot.lang}`);
	}
	if (
		scenario.expectedHeading &&
		!snapshot.headings.includes(scenario.expectedHeading)
	) {
		errors.push(`heading not found: ${scenario.expectedHeading}`);
	}
	if (
		scenario.expectedText &&
		!snapshot.bodyText.includes(scenario.expectedText)
	) {
		errors.push(`text not found: ${scenario.expectedText}`);
	}
	if (
		scenario.expectedCanonicalPath &&
		canonicalPath(snapshot.canonical) !== scenario.expectedCanonicalPath
	) {
		errors.push(
			`canonical expected ${scenario.expectedCanonicalPath}, got ${canonicalPath(snapshot.canonical) ?? "missing"}`,
		);
	}
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

export function parseSmokeOutcome(stdout: string): E2ESmokeOutcome | null {
	for (const line of stdout.split("\n").reverse()) {
		if (!line.startsWith(E2E_SMOKE_RESULT_PREFIX)) continue;
		try {
			return JSON.parse(
				line.slice(E2E_SMOKE_RESULT_PREFIX.length),
			) as E2ESmokeOutcome;
		} catch {
			return null;
		}
	}
	return null;
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
	const ids = sample.outcome.scenarios.map((scenario) => scenario.id);
	if (JSON.stringify(ids) !== JSON.stringify(expectedScenarioIds())) {
		reasons.push(`${sample.arm}: scenario inventory mismatch`);
	}
	for (const scenario of sample.outcome.scenarios) {
		if (!scenario.passed)
			reasons.push(
				`${sample.arm}: ${scenario.id} failed${scenario.error ? ` (${scenario.error})` : ""}`,
			);
	}
	return reasons;
}

export function buildE2EBenchmarkRun(input: {
	timestamp: string;
	commit: string;
	host: HostMeta;
	repetitions: number;
	samples: E2EBenchmarkSample[];
}): E2EBenchmarkRun {
	const reasons = input.samples.flatMap(sampleReasons);
	for (const arm of ["playwright", "webview"] as const) {
		const count = input.samples.filter((sample) => sample.arm === arm).length;
		if (count !== input.repetitions) {
			reasons.push(
				`${arm}: expected ${input.repetitions} samples, received ${count}`,
			);
		}
	}
	const executables = new Set(
		input.samples
			.map((sample) => sample.outcome?.browserExecutable)
			.filter((value): value is string => Boolean(value)),
	);
	if (executables.size !== 1) reasons.push("browser executable mismatch");
	return {
		schemaVersion: 1,
		timestamp: input.timestamp,
		commit: input.commit,
		host: input.host,
		repetitions: input.repetitions,
		warmupsPerArm: 1,
		scenarios: E2E_SMOKE_SCENARIOS,
		samples: input.samples,
		validComparison: reasons.length === 0,
		invalidReasons: [...new Set(reasons)],
	};
}

function aggregateArm(run: E2EBenchmarkRun, arm: E2ESmokeArm) {
	return aggregate(
		run.samples
			.filter((sample) => sample.arm === arm)
			.map(({ ms, peakRssBytes, exitCode, loadAvg1 }) => ({
				ms,
				peakRssBytes,
				exitCode,
				loadAvg1,
			})),
	);
}

function mib(value: number): string {
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	if (sorted.length === 0) return 0;
	const middle = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? sorted[middle]
		: (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianBrowserRss(run: E2EBenchmarkRun, arm: E2ESmokeArm): number {
	return median(
		run.samples
			.filter((sample) => sample.arm === arm)
			.map((sample) => sample.outcome?.browserRssBytes ?? 0),
	);
}

export function renderE2EBenchmark(run: E2EBenchmarkRun): string {
	const lines = [
		"# Bun Playwright vs Bun.WebView",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`,
		`- Scenarios: ${run.scenarios.length}`,
		`- Timed repetitions per arm: ${run.repetitions}`,
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
	const playwright = aggregateArm(run, "playwright");
	const webview = aggregateArm(run, "webview");
	if (!playwright || !webview) {
		return `${lines.join("\n")}## Comparison invalid\n\n- aggregate missing\n`;
	}
	const delta = classifyDelta(playwright, webview);
	lines.push(
		"## Results",
		"",
		"| Arm | Median | Min | Max | Median browser RSS | Samples |",
		"| --- | ---: | ---: | ---: | ---: | ---: |",
		`| Bun + Playwright | ${(playwright.medianMs / 1000).toFixed(2)} s | ${(playwright.minMs / 1000).toFixed(2)} s | ${(playwright.maxMs / 1000).toFixed(2)} s | ${mib(medianBrowserRss(run, "playwright"))} | ${playwright.sampleCount} |`,
		`| Bun.WebView | ${(webview.medianMs / 1000).toFixed(2)} s | ${(webview.minMs / 1000).toFixed(2)} s | ${(webview.maxMs / 1000).toFixed(2)} s | ${mib(medianBrowserRss(run, "webview"))} | ${webview.sampleCount} |`,
		"",
		`WebView delta: ${delta.deltaPct.toFixed(2)}% (${delta.verdict}).`,
		"",
	);
	return lines.join("\n");
}

export const E2E_BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/e2e-webview",
);

async function reserveReportStem(
	dir: string,
	timestamp: string,
): Promise<string> {
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `comparison-${base}${suffix === 0 ? "" : `-${suffix}`}`;
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
	const stem = await reserveReportStem(dir, run.timestamp);
	const jsonPath = join(dir, `${stem}.json`);
	const markdownPath = join(dir, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, `${renderE2EBenchmark(run)}\n`, "utf8");
	return { jsonPath, markdownPath };
}

export async function readE2EBenchmark(path: string): Promise<E2EBenchmarkRun> {
	return JSON.parse(await readFile(path, "utf8")) as E2EBenchmarkRun;
}
