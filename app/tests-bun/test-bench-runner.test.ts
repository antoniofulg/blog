import { describe, expect, test } from "bun:test";
import type { MeasuredRun } from "#/lib/bench/runner.server";
import {
	parseBunTestSummary,
	parseVitestSummary,
	runTestArm,
	runTestComparison,
	type TestRunDeps,
} from "#/lib/test-bench/runner.server";
import { TEST_ARMS } from "#/lib/test-bench/types";

function measured(over: Partial<MeasuredRun> = {}): MeasuredRun {
	return {
		ms: 100,
		peakRssBytes: 4096,
		exitCode: 0,
		loadAvg1: 1.2,
		stdout:
			'{"command":"run","execPath":"/bin/bun","runtime":"bun","runtimeVersion":"1.4.0","runner":"bun:test","runnerVersion":"1.4.0"}\n 1 pass\nRan 1 test across 1 file. [1ms]',
		stderrTail: "",
		timedOut: false,
		pgid: 1,
		...over,
	};
}

const inventory = {
	ok: true,
	valid: true,
	reasons: [],
	reference: [],
	candidate: [],
	missingFiles: [],
	extraFiles: [],
};

function deps(
	responses: MeasuredRun[],
	override: Partial<TestRunDeps> = {},
): TestRunDeps & { calls: string[][] } {
	let index = 0;
	const calls: string[][] = [];
	return {
		calls,
		spawn: async (argv) => {
			calls.push(argv);
			return responses[Math.min(index++, responses.length - 1)];
		},
		host: async () => ({
			host: "test",
			cpuModel: "cpu",
			cores: 1,
			totalMemBytes: 100,
			loadAvg1: 1,
			powerSource: "unknown",
			startedAt: "2026-08-22T00:00:00.000Z",
		}),
		commit: async () => "abc123",
		inventory: async () => inventory,
		env: {},
		cwd: "/repo",
		...override,
	};
}

describe("test comparison result parsing", () => {
	test("parses Vitest passed, skipped, and file counts", () => {
		const result = parseVitestSummary(
			"Test Files  2 passed | 1 skipped (3)\nTests  8 passed | 2 skipped (10)",
		);
		expect(result).toEqual({
			filesPassed: 2,
			filesFailed: 0,
			testsPassed: 8,
			testsFailed: 0,
			testsSkipped: 2,
			testFileCount: 3,
		});
	});

	test("parses Vitest failed counts", () => {
		const result = parseVitestSummary(
			"Test Files  1 failed | 2 passed (3)\nTests  1 failed | 4 passed (5)",
		);
		expect(result?.filesFailed).toBe(1);
		expect(result?.testsFailed).toBe(1);
	});

	test("rejects a Vitest output without both summary lines", () => {
		expect(parseVitestSummary("Tests  1 passed (1)")).toBeNull();
	});

	test("parses Bun pass, fail, skip, and file counts", () => {
		const result = parseBunTestSummary(
			"1 pass\n2 fail\n3 skip\nRan 6 tests across 4 files. [1ms]",
		);
		expect(result).toEqual({
			filesPassed: 0,
			filesFailed: 4,
			testsPassed: 1,
			testsFailed: 2,
			testsSkipped: 3,
			testFileCount: 4,
		});
	});

	test("rejects a Bun output without the Ran summary", () => {
		expect(parseBunTestSummary("1 pass")).toBeNull();
	});

	test("parses a Bun single-file green run", () => {
		const result = parseBunTestSummary(
			"2 pass\nRan 2 tests across 1 file. [1ms]",
		);
		expect(result?.filesPassed).toBe(1);
		expect(result?.testsPassed).toBe(2);
	});
});

describe("test arm orchestration", () => {
	test("records measured timing, RSS, load, provenance, and outcome", async () => {
		const result = await runTestArm(TEST_ARMS.C, {
			...deps([measured()]),
			env: {},
			cwd: "/repo",
		});
		expect(result.durationMs).toBe(100);
		expect(result.peakRssBytes).toBe(4096);
		expect(result.loadAvg1).toBe(1.2);
		expect(result.provenance.execPath).toBe("/bin/bun");
		expect(result.outcome?.testsPassed).toBe(1);
	});

	test("preserves a non-zero arm failure and excerpt", async () => {
		const result = await runTestArm(TEST_ARMS.C, {
			...deps([
				measured({ exitCode: 2, stdout: "1 fail", stderrTail: "boom" }),
			]),
			env: {},
			cwd: "/repo",
		});
		expect(result.exitCode).toBe(2);
		expect(result.failureExcerpt).toContain("boom");
	});

	test("turns a timed-out arm into a null exit result", async () => {
		const result = await runTestArm(TEST_ARMS.C, {
			...deps([measured({ timedOut: true, exitCode: -1 })]),
			env: {},
			cwd: "/repo",
		});
		expect(result.timedOut).toBe(true);
		expect(result.exitCode).toBeNull();
	});

	test("runs arms sequentially and reverses order on the second repetition", async () => {
		const response = measured();
		const testDeps = deps([
			response,
			response,
			response,
			response,
			response,
			response,
		]);
		await runTestComparison(
			[TEST_ARMS.A, TEST_ARMS.B, TEST_ARMS.C],
			2,
			testDeps,
		);
		expect(testDeps.calls.map((argv) => argv[2])).toEqual([
			"test:vitest:node",
			"test:vitest:bun",
			"test:bun",
			"test:bun",
			"test:vitest:bun",
			"test:vitest:node",
		]);
	});

	test("continues remaining arms after a failed arm", async () => {
		const testDeps = deps([
			measured({ exitCode: 1, stdout: "failed" }),
			measured(),
			measured(),
		]);
		const result = await runTestComparison(
			[TEST_ARMS.A, TEST_ARMS.B, TEST_ARMS.C],
			1,
			testDeps,
		);
		expect(testDeps.calls).toHaveLength(3);
		expect(result.samples).toHaveLength(3);
		expect(result.validComparison).toBe(false);
	});

	test("invalidates a comparison when inventory differs", async () => {
		const result = await runTestComparison(
			[TEST_ARMS.A],
			1,
			deps([measured()], {
				inventory: async () => ({
					...inventory,
					ok: false,
					valid: false,
					reasons: ["missing twin"],
				}),
			}),
		);
		expect(result.validComparison).toBe(false);
		expect(result.invalidReasons).toContain("missing twin");
	});

	test("invalidates a comparison when an outcome is missing", async () => {
		const result = await runTestComparison(
			[TEST_ARMS.C],
			1,
			deps([measured({ stdout: "runner output" })]),
		);
		expect(result.validComparison).toBe(false);
		expect(result.invalidReasons).toContain("C: test outcome summary missing");
	});

	test("rejects a non-positive repetition count before spawning", async () => {
		await expect(runTestComparison([TEST_ARMS.C], 0, deps([]))).rejects.toThrow(
			"repetitions must be a positive integer",
		);
	});
});
