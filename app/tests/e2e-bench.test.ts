import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { HostMeta } from "#/lib/bench/types";
import {
	assessScenario,
	benchmarkOrder,
	buildE2EBenchmarkRun,
	E2E_SESSION_RESULT_PREFIX,
	E2E_SMOKE_RESULT_PREFIX,
	E2E_SMOKE_SCENARIOS,
	type E2EBenchmarkSample,
	type E2ESmokeArm,
	type E2ESmokeOutcome,
	parseSessionOutcome,
	parseSmokeOutcome,
	readE2EBenchmark,
	renderE2EBenchmark,
	writeE2EBenchmark,
} from "#/lib/e2e-bench";

const host: HostMeta = {
	host: "test-host",
	cpuModel: "test-cpu",
	cores: 4,
	totalMemBytes: 8_000_000_000,
	loadAvg1: 1,
	powerSource: "ac",
	startedAt: "2026-08-22T00:00:00.000Z",
};

function outcome(
	arm: E2ESmokeArm,
	overrides?: Partial<E2ESmokeOutcome>,
): E2ESmokeOutcome {
	return {
		schemaVersion: 1,
		arm,
		runtime: "bun",
		runtimeVersion: "1.4.0",
		automationVersion: arm === "playwright" ? "1.60.0" : "1.4.0",
		browserExecutable: "/chromium",
		browserRssBytes: arm === "playwright" ? 200 : 150,
		durationMs: arm === "playwright" ? 1_100 : 800,
		viewport: { width: 1280, height: 720 },
		scenarios: E2E_SMOKE_SCENARIOS.map((scenario) => ({
			id: scenario.id,
			passed: true,
		})),
		...overrides,
	};
}

function sample(
	arm: E2ESmokeArm,
	repetition: number,
	overrides?: Partial<E2EBenchmarkSample>,
): E2EBenchmarkSample {
	return {
		arm,
		repetition,
		phase: "measured",
		ms: arm === "playwright" ? 1_200 : 900,
		peakRssBytes: arm === "playwright" ? 200 : 150,
		exitCode: 0,
		loadAvg1: 1,
		timedOut: false,
		outcome: outcome(arm),
		...overrides,
	};
}

function validRun() {
	return buildE2EBenchmarkRun({
		timestamp: "2026-08-22T00:00:00.000Z",
		commit: "abc123",
		host,
		repetitions: 2,
		samples: benchmarkOrder(2).map(({ arm, repetition }) =>
			sample(arm, repetition),
		),
	});
}

describe("E2E WebView benchmark", () => {
	it("uses a stable five-scenario public inventory", () => {
		expect(E2E_SMOKE_SCENARIOS.map((scenario) => scenario.id)).toEqual([
			"en-post",
			"pt-br-post",
			"en-index",
			"pt-br-index",
			"not-found",
		]);
		expect(
			new Set(E2E_SMOKE_SCENARIOS.map((scenario) => scenario.id)).size,
		).toBe(5);
	});

	it("assesses the same DOM snapshot contract for both arms", () => {
		const scenario = E2E_SMOKE_SCENARIOS[0];
		expect(
			assessScenario(scenario, {
				readyState: "complete",
				lang: "en",
				headings: ["E2E Public Fixture"],
				bodyText: "English body",
				canonical: null,
			}),
		).toEqual({ id: "en-post", passed: true });
		expect(
			assessScenario(scenario, {
				readyState: "loading",
				lang: "pt-BR",
				headings: [],
				bodyText: "",
				canonical: null,
			}).passed,
		).toBe(false);
	});

	it("interleaves and reverses arm order", () => {
		expect(benchmarkOrder(3)).toEqual([
			{ repetition: 1, arm: "playwright" },
			{ repetition: 1, arm: "webview" },
			{ repetition: 2, arm: "webview" },
			{ repetition: 2, arm: "playwright" },
			{ repetition: 3, arm: "playwright" },
			{ repetition: 3, arm: "webview" },
		]);
	});

	it("parses only the explicit smoke result line", () => {
		const expected = outcome("webview");
		expect(
			parseSmokeOutcome(
				`noise\n${E2E_SMOKE_RESULT_PREFIX}${JSON.stringify(expected)}\n`,
			),
		).toEqual(expected);
		expect(parseSmokeOutcome("noise only")).toBeNull();
	});

	it("parses a warm-session result with warmup and measured passes", () => {
		const pass = {
			durationMs: 100,
			browserRssBytes: 200,
			scenarios: outcome("webview").scenarios,
		};
		const expected = {
			...outcome("webview"),
			warmup: pass,
			passes: [pass, pass],
		};
		delete (expected as Partial<typeof expected>).durationMs;
		delete (expected as Partial<typeof expected>).browserRssBytes;
		delete (expected as Partial<typeof expected>).scenarios;
		expect(
			parseSessionOutcome(
				`${E2E_SESSION_RESULT_PREFIX}${JSON.stringify(expected)}`,
			),
		).toEqual(expected);
	});

	it("accepts matching successful arms", () => {
		const run = validRun();
		expect(run.validComparison).toBe(true);
		expect(run.invalidReasons).toEqual([]);
		expect(renderE2EBenchmark(run)).toContain("Median browser RSS");
		expect(renderE2EBenchmark(run)).toContain("WebView delta:");
	});

	it("persists cold warmups and renders an inclusive aggregate", () => {
		const run = buildE2EBenchmarkRun({
			timestamp: "2026-08-22T00:00:00.000Z",
			commit: "abc123",
			host,
			repetitions: 2,
			warmupsPerArm: 1,
			warmups: [
				sample("playwright", 0, { phase: "warmup" }),
				sample("webview", 0, { phase: "warmup" }),
			],
			samples: benchmarkOrder(2).map(({ arm, repetition }) =>
				sample(arm, repetition),
			),
		});
		expect(run.validComparison).toBe(true);
		expect(run.warmups).toHaveLength(2);
		expect(renderE2EBenchmark(run)).toContain("Cold result including warm-up");
	});

	it("keeps warm-session pass and whole-process timing separate", () => {
		const run = buildE2EBenchmarkRun({
			mode: "warm-session",
			timestamp: "2026-08-22T00:00:00.000Z",
			commit: "abc123",
			host,
			repetitions: 2,
			warmupsPerArm: 1,
			sessionsPerArm: 1,
			warmups: [
				sample("playwright", 0, { phase: "warmup", session: 1 }),
				sample("webview", 0, { phase: "warmup", session: 1 }),
			],
			samples: benchmarkOrder(2).map(({ arm, repetition }) =>
				sample(arm, repetition, { session: 1 }),
			),
			sessionTotals: [
				{ ...sample("playwright", 1), session: 1 },
				{ ...sample("webview", 1), session: 1 },
			],
		});
		expect(run.validComparison).toBe(true);
		expect(renderE2EBenchmark(run)).toContain("Whole-session process cost");
		expect(renderE2EBenchmark(run)).toContain(
			"Warm-session result including in-session warm-ups",
		);
		expect(renderE2EBenchmark(run)).toContain(
			"Primary warm-session timings measure only",
		);
	});

	it("rejects failures, missing samples, and browser mismatches", () => {
		const run = buildE2EBenchmarkRun({
			timestamp: "2026-08-22T00:00:00.000Z",
			commit: "abc123",
			host,
			repetitions: 2,
			samples: [
				sample("playwright", 1),
				sample("webview", 1, {
					exitCode: 1,
					outcome: outcome("webview", {
						browserExecutable: "/other-chromium",
						scenarios: [{ id: "en-post", passed: false, error: "missing" }],
					}),
				}),
			],
		});
		expect(run.validComparison).toBe(false);
		expect(run.invalidReasons).toContain("webview: exit code 1");
		expect(run.invalidReasons).toContain(
			"webview: scenario inventory mismatch",
		);
		expect(run.invalidReasons).toContain("browser executable mismatch");
		expect(renderE2EBenchmark(run)).toContain("No performance conclusion");
	});

	it("writes unique JSON and Markdown reports", async () => {
		const dir = await mkdtemp(join(tmpdir(), "e2e-webview-bench-"));
		try {
			const first = await writeE2EBenchmark(validRun(), dir);
			const second = await writeE2EBenchmark(validRun(), dir);
			expect(first.jsonPath).not.toBe(second.jsonPath);
			expect(first.markdownPath).not.toBe(second.markdownPath);
			expect(await readE2EBenchmark(first.jsonPath)).toEqual(validRun());
		} finally {
			await rm(dir, { recursive: true, force: true });
		}
	});
});
