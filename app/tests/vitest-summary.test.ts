import { describe, expect, it } from "vitest";
import { parseVitestSummary } from "#/lib/bench/vitest-summary";

describe("Vitest summary parser", () => {
	it("parses passed, failed, skipped, and file counts", () => {
		expect(
			parseVitestSummary(
				"Test Files  2 passed | 1 failed (3)\nTests  8 passed | 1 failed | 2 skipped (11)",
			),
		).toEqual({
			filesPassed: 2,
			filesFailed: 1,
			testsPassed: 8,
			testsFailed: 1,
			testsSkipped: 2,
			leafTestsSkipped: 2,
			testFileCount: 3,
		});
	});

	it("strips ANSI colors and indentation", () => {
		expect(
			parseVitestSummary(
				"\u001b[32m  Test Files  2 passed | 1 skipped (3)\u001b[39m\n\u001b[32m    Tests  8 passed | 2 skipped (10)\u001b[39m",
			),
		).toMatchObject({
			filesPassed: 2,
			testsPassed: 8,
			testsSkipped: 2,
			leafTestsSkipped: 2,
			testFileCount: 3,
		});
	});

	it("requires both Vitest summary lines", () => {
		expect(parseVitestSummary("Tests  1 passed (1)")).toBeNull();
	});
});
