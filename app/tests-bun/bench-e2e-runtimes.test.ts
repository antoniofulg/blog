import { describe, expect, test } from "bun:test";
import type { MeasuredRun } from "#/lib/bench/runner.server";
import {
	commandEnvironment,
	commandForRuntime,
	DEFAULT_REPETITIONS,
	type E2EBenchDeps,
	parseE2EBenchArgs,
	parsePlaywrightOutcome,
	RUNTIME_ARMS,
	renderE2EBenchmark,
	runE2EBenchmark,
	runtimeDeltas,
} from "../../scripts/bench-e2e-runtimes";

const report = JSON.stringify({
	stats: { expected: 10, skipped: 0, unexpected: 0, flaky: 0 },
});

function measured(overrides: Partial<MeasuredRun> = {}): MeasuredRun {
	return {
		ms: 100,
		peakRssBytes: 100,
		exitCode: 0,
		loadAvg1: 0.1,
		stdout: "",
		stderrTail: "",
		timedOut: false,
		pgid: 42,
		...overrides,
	};
}

function deps(
	spawn: E2EBenchDeps["spawn"],
	overrides: Partial<E2EBenchDeps> = {},
): E2EBenchDeps {
	return {
		spawn,
		host: async () => ({
			host: "test-host",
			cpuModel: "test-cpu",
			cores: 4,
			totalMemBytes: 8 * 1024 * 1024 * 1024,
			loadAvg1: 0.1,
			powerSource: "ac",
			startedAt: "2026-08-23T00:00:00.000Z",
		}),
		commit: async () => "abc123",
		now: () => "2026-08-23T00:00:00.000Z",
		runnerVersion: "1.60.0",
		cwd: "/repo",
		sleep: async () => {},
		nowMs: () => 0,
		loadAvg: () => 0.1,
		ambientLoadPollIntervalMs: 1,
		validateRuntime: async (arm) => (arm.id === "node" ? "24.5.0" : "1.4.0"),
		cleanupProcessGroup: async () => true,
		makeJsonOutputFile: async () => ({
			directory: "/tmp/e2e",
			file: "/tmp/e2e/results.json",
		}),
		readJson: async () => report,
		removeJsonOutput: async () => {},
		...overrides,
	};
}

describe("Playwright runtime benchmark", () => {
	test("parses bounded repetitions and forces the shared browser configuration", () => {
		expect(parseE2EBenchArgs([]).repetitions).toBe(DEFAULT_REPETITIONS);
		expect(parseE2EBenchArgs(["--repetitions=3"]).repetitions).toBe(3);
		expect(() => parseE2EBenchArgs(["--repetitions=0"])).toThrow(
			"--repetitions must be a positive integer",
		);
		expect(commandForRuntime(RUNTIME_ARMS[0])).toEqual([
			"node",
			"node_modules/@playwright/test/cli.js",
			"test",
			"--config=playwright.config.ts",
			"--project=chromium",
			"--workers=1",
			"--retries=0",
			"--reporter=json",
		]);
		expect(commandForRuntime(RUNTIME_ARMS[1])[0]).toBe("bunx");
		expect(commandEnvironment("/tmp/result.json")).toMatchObject({
			PLAYWRIGHT_JSON_OUTPUT_FILE: "/tmp/result.json",
		});
		expect(commandEnvironment("/tmp/result.json").CI).toBeUndefined();
	});

	test("parses Playwright outcomes and rejects malformed reports", () => {
		expect(parsePlaywrightOutcome(report)).toEqual({
			expected: 10,
			skipped: 0,
			unexpected: 0,
			flaky: 0,
			inventory: 10,
		});
		expect(
			parsePlaywrightOutcome(JSON.stringify({ stats: { expected: 10 } })),
		).toBeNull();
		expect(parsePlaywrightOutcome("not json")).toBeNull();
	});

	test("validates both runtimes before warmup, interleaves samples, and cleans every group", async () => {
		const calls: string[][] = [];
		const validations: string[] = [];
		const cleanups: number[] = [];
		let invocation = 0;
		const run = await runE2EBenchmark(
			2,
			deps(
				async (argv, _env) => {
					calls.push(argv);
					invocation += 1;
					return measured({ ms: invocation <= 2 ? 7 : 100, pgid: invocation });
				},
				{
					validateRuntime: async (arm) => {
						validations.push(arm.id);
						return arm.id === "node" ? "24.5.0" : "1.4.0";
					},
					cleanupProcessGroup: async (pgid) => {
						cleanups.push(pgid);
						return true;
					},
				},
			),
		);
		expect(validations).toEqual(["node", "bun"]);
		expect(calls).toHaveLength(6);
		expect(calls.slice(2).map((call) => call[0])).toEqual([
			"node",
			"bunx",
			"bunx",
			"node",
		]);
		expect(cleanups).toHaveLength(6);
		expect(run.arms.map((arm) => arm.samples)).toHaveLength(2);
		expect(run.arms.every((arm) => arm.samples.length === 2)).toBe(true);
		expect(run.arms[0].warmupSamples[0].durationMs).toBe(7);
		expect(run.arms[0].aggregate?.medianMs).toBe(100);
		expect(run.arms[0].totalWallTimeMs).toBe(207);
		expect(run.arms[0].samples[0]).toMatchObject({
			loadStart: 0.1,
			loadMax: 0.1,
			loadEnd: 0.1,
			runtimeVersion: "24.5.0",
			browser: "chromium",
			cleanupVerified: true,
		});
		expect(run.validComparison).toBe(true);
	});

	test("cleans failed sample output and propagates spawn errors", async () => {
		const removed: string[] = [];
		const spawnError = new Error("spawn failed");

		await expect(
			runE2EBenchmark(
				1,
				deps(
					async () => {
						throw spawnError;
					},
					{
						makeJsonOutputFile: async () => ({
							directory: "/tmp/e2e-failed",
							file: "/tmp/e2e-failed/results.json",
						}),
						removeJsonOutput: async (directory) => {
							removed.push(directory);
						},
					},
				),
			),
		).rejects.toThrow("spawn failed");
		expect(removed).toEqual(["/tmp/e2e-failed"]);
	});

	test("invalidates failed, skipped, and orphaned samples without a winner", async () => {
		let invocation = 0;
		const run = await runE2EBenchmark(
			1,
			deps(
				async (argv) => {
					invocation += 1;
					return measured(
						argv[0] === "bunx"
							? { exitCode: 1, stdout: "failed", pgid: invocation }
							: { pgid: invocation },
					);
				},
				{
					readJson: async (file) =>
						file.includes("results")
							? JSON.stringify({
									stats: { expected: 9, skipped: 1, unexpected: 0, flaky: 0 },
								})
							: report,
					cleanupProcessGroup: async (pgid) => pgid !== 2,
				},
			),
		);
		expect(run.arms.find((arm) => arm.runtime === "bun")?.memoryValid).toBe(
			false,
		);
		expect(run.validMemoryComparison).toBe(false);
		expect(run.winner).toBeNull();
		expect(run.invalidReasons.join(" ")).toContain("skipped tests");
		expect(run.invalidReasons.join(" ")).toContain("exit code 1");
		expect(run.invalidReasons.join(" ")).toContain("orphan process group");
	});

	test("renders the shared server, browser, raw warmup, and validity evidence", async () => {
		const run = await runE2EBenchmark(
			1,
			deps(async () => measured()),
		);
		const markdown = renderE2EBenchmark(run);
		expect(markdown).toContain("same Bun application server");
		expect(markdown).toContain("warmup retained but excluded");
		expect(markdown).toContain(
			"Derived deltas (Bun − Node; calculated from raw samples)",
		);
		expect(markdown).toContain("Total wall time including warmup: 0.00 ms");
		expect(markdown).toContain("Load start");
		expect(markdown).toContain("chromium");
		expect(runtimeDeltas(run)).toMatchObject({
			medianDurationMs: 0,
			medianPeakRssBytes: 0,
			totalWallTimeMs: 0,
		});
	});
});
