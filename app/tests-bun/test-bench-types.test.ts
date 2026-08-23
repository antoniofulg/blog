import { describe, expect, test } from "bun:test";
import {
	TEST_ARM_IDS,
	TEST_ARMS,
	type TestArmId,
	type TestArmSample,
	type TestOutcome,
} from "#/lib/test-bench/types";

describe("test comparison arms", () => {
	test("defines A as Node 24 with Vitest", () => {
		expect(TEST_ARMS.A).toMatchObject({
			runner: "vitest",
			runtime: "node",
			runtimeVersion: "24",
			runnerVersion: "4.1.5",
			testRoot: "app/tests",
		});
	});

	test("defines B as Bun 1.4 with Vitest", () => {
		expect(TEST_ARMS.B).toMatchObject({
			runner: "vitest",
			runtime: "bun",
			runtimeVersion: "1.4.0",
			runnerVersion: "4.1.5",
		});
	});

	test("defines C as Bun 1.4 with Bun Test", () => {
		expect(TEST_ARMS.C).toMatchObject({
			runner: "bun:test",
			runtime: "bun",
			runtimeVersion: "1.4.0",
			runnerVersion: "1.4.0",
			testRoot: "app/tests-bun",
		});
	});

	test("keeps arm order stable for sequential execution", () => {
		expect(TEST_ARM_IDS).toEqual(["A", "B", "C"]);
	});

	test("models every required test outcome count", () => {
		const outcome: TestOutcome = {
			filesPassed: 2,
			filesFailed: 1,
			testsPassed: 3,
			testsFailed: 1,
			testsSkipped: 2,
			testFileCount: 3,
		};
		expect(outcome.testFileCount).toBe(3);
		expect(outcome.testsSkipped).toBe(2);
	});

	test("models provenance, timing, RSS, load, and failure state", () => {
		const sample: TestArmSample = {
			arm: "C" satisfies TestArmId,
			durationMs: 120,
			peakRssBytes: 2048,
			exitCode: 1,
			timedOut: false,
			outcome: null,
			provenance: {
				command: "bun run test:bun",
				execPath: "/usr/local/bin/bun",
				runtime: "bun",
				runtimeVersion: "1.4.0",
				runner: "bun:test",
				runnerVersion: "1.4.0",
			},
			loadAvg1: 1.5,
			failureExcerpt: "timeout",
		};
		expect(sample.provenance.execPath).toBe("/usr/local/bin/bun");
		expect(sample.durationMs).toBe(120);
		expect(sample.peakRssBytes).toBe(2048);
		expect(sample.loadAvg1).toBe(1.5);
		expect(sample.failureExcerpt).toBe("timeout");
	});
});
