import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	DEFAULT_TEST_REPETITIONS,
	MAX_TEST_REPETITIONS,
	parseTestBenchArgs,
} from "../../scripts/bench-tests";

describe("test benchmark CLI", () => {
	it("defaults to all arms and one repetition", () => {
		expect(parseTestBenchArgs([])).toMatchObject({
			armIds: ["A", "B", "C"],
			repetitions: DEFAULT_TEST_REPETITIONS,
		});
	});

	it("selects comma-separated arms", () => {
		expect(parseTestBenchArgs(["--only=C,A"]).armIds).toEqual(["C", "A"]);
	});

	it("accepts a bounded positive repetition count", () => {
		expect(parseTestBenchArgs(["--repetitions=3"]).repetitions).toBe(3);
	});

	it("rejects zero repetitions", () => {
		expect(() => parseTestBenchArgs(["--repetitions=0"])).toThrow(
			"--repetitions must be a positive integer",
		);
	});

	it("rejects repetitions above the bound", () => {
		expect(() =>
			parseTestBenchArgs([`--repetitions=${MAX_TEST_REPETITIONS + 1}`]),
		).toThrow(`--repetitions must be at most ${MAX_TEST_REPETITIONS}`);
	});

	it("registers the package command and artifact output", () => {
		const packageJson = JSON.parse(
			readFileSync(new URL("../../package.json", import.meta.url), "utf8"),
		) as { scripts: Record<string, string> };
		const source = readFileSync(
			new URL("../../scripts/bench-tests.ts", import.meta.url),
			"utf8",
		);
		expect(packageJson.scripts["bench:tests"]).toBe(
			"bun run scripts/bench-tests.ts",
		);
		expect(source).toContain("JSON:");
		expect(source).toContain("Markdown:");
	});
});
