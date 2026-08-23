import { describe, expect, it } from "vitest";
import {
	COHORTS,
	classifyTestFile,
	filterCohortInventory,
	parseCohortArgument,
	selectCohortFiles,
} from "../lib/test-migration/cohorts";
import {
	compareTestTrees,
	type TestFileInventory,
} from "../lib/test-migration/parity";

function file(
	relativePath: string,
	cohort: TestFileInventory["cohort"],
): TestFileInventory {
	return {
		relativePath,
		runner: "vitest",
		cohort,
		testCount: 1,
		assertionCount: 1,
		tests: 1,
		assertions: 1,
		fixturePaths: [],
		missingFixtures: [],
		residualVitestApis: [],
		omissionMarkers: [],
		mockExports: [],
	};
}

describe("Bun Test cohorts", () => {
	it("classifies pure source", () => {
		expect(classifyTestFile('test("math", () => expect(1).toBe(1));')).toBe(
			"pure",
		);
	});

	it("classifies DOM source", () => {
		expect(
			classifyTestFile('import { render } from "@testing-library/react";'),
		).toBe("dom");
	});

	it("classifies module mocks and timers", () => {
		expect(
			classifyTestFile(
				'mock.module("./reader", () => ({})); jest.useFakeTimers();',
			),
		).toBe("mocks-timers");
	});

	it("prioritizes integration evidence", () => {
		expect(
			classifyTestFile(
				'mock.module("db", () => ({})); const db = new PGlite();',
			),
		).toBe("integration-infra");
	});

	it("selects a deterministic sorted file list", () => {
		expect(
			selectCohortFiles(
				[
					file("z.test.ts", "pure"),
					file("a.test.ts", "pure"),
					file("dom.test.ts", "dom"),
				],
				"pure",
			),
		).toEqual(["a.test.ts", "z.test.ts"]);
	});

	it("accepts every known cohort argument", () => {
		for (const cohort of COHORTS)
			expect(parseCohortArgument(["--cohort", cohort])).toBe(cohort);
	});

	it("rejects an unknown cohort argument", () => {
		expect(() => parseCohortArgument(["--cohort", "unknown"])).toThrow(
			/pure, dom, mocks-timers, integration-infra/,
		);
	});

	it("rejects an empty cohort argument", () => {
		expect(() => parseCohortArgument(["--cohort"])).toThrow(
			/Unknown or empty cohort/,
		);
	});

	it("parity filter ignores incompatible files from later cohorts", () => {
		const reference = [
			file("pure.test.ts", "pure"),
			file("future.test.ts", "integration-infra"),
		];
		const candidate = [
			file("pure.test.ts", "pure"),
			file("future.test.ts", "integration-infra"),
		];
		candidate[1].omissionMarkers = ["partial mock skipped"];
		const result = compareTestTrees(
			filterCohortInventory(reference, "pure"),
			filterCohortInventory(candidate, "pure"),
		);
		expect(result.ok).toBe(true);
		expect(result.reasons).toEqual([]);
	});

	it("parity filter still catches drift inside the active cohort", () => {
		const reference = [
			file("pure.test.ts", "pure"),
			file("future.test.ts", "integration-infra"),
		];
		const candidate = [
			file("pure.test.ts", "pure"),
			file("future.test.ts", "integration-infra"),
		];
		candidate[0].assertionCount = 0;
		const result = compareTestTrees(
			filterCohortInventory(reference, "pure"),
			filterCohortInventory(candidate, "pure"),
		);
		expect(result.ok).toBe(false);
		expect(result.reasons).toContain("pure.test.ts: assertions 0 != 1");
	});
});
