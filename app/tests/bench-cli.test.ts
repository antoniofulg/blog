import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	parseBenchArgs,
	RESULTS_DIR,
	resultFilePath,
	splitRuntimeSelection,
} from "#/lib/bench/cli";

describe("bench cli flags", () => {
	it("defaults to the full matrix with no flags", () => {
		const args = parseBenchArgs([]);
		expect(args.only).toBeUndefined();
		expect(args.versions).toBeUndefined();
		expect(args.reportOnly).toBeUndefined();
		expect(args.allowNoisy).toBe(false);
	});

	it("splits a comma-separated workload list", () => {
		expect(parseBenchArgs(["--only=lint,check"]).only).toEqual([
			"lint",
			"check",
		]);
	});

	it("trims whitespace around list values", () => {
		expect(parseBenchArgs(["--only=lint , check"]).only).toEqual([
			"lint",
			"check",
		]);
	});

	it("splits a comma-separated version list", () => {
		expect(parseBenchArgs(["--versions=1.3.14,1.4.0"]).versions).toEqual([
			"1.3.14",
			"1.4.0",
		]);
	});

	it("treats an empty list value as absent rather than as an empty selection", () => {
		expect(parseBenchArgs(["--only="]).only).toBeUndefined();
	});

	it("enables the noisy-machine escape hatch only when the flag is present", () => {
		expect(parseBenchArgs(["--allow-noisy"]).allowNoisy).toBe(true);
	});

	it("reads the report-only source path", () => {
		expect(
			parseBenchArgs(["--report-only=docs/benchmarks/bun-1-4/2026-08-20.json"])
				.reportOnly,
		).toBe("docs/benchmarks/bun-1-4/2026-08-20.json");
	});
});

describe("bench selection and result paths", () => {
	it("runs every workload and the runtime measurement when nothing is selected", () => {
		expect(splitRuntimeSelection(undefined)).toEqual({
			workloadIds: undefined,
			includeRuntime: true,
		});
	});

	it("separates the runtime pseudo-workload from the spawned workload ids", () => {
		expect(splitRuntimeSelection(["lint", "runtime"])).toEqual({
			workloadIds: ["lint"],
			includeRuntime: true,
		});
	});

	it("excludes the runtime measurement when it was not selected", () => {
		expect(splitRuntimeSelection(["lint"])).toEqual({
			workloadIds: ["lint"],
			includeRuntime: false,
		});
	});

	it("runs only the runtime measurement when it is the sole selection", () => {
		expect(splitRuntimeSelection(["runtime"])).toEqual({
			workloadIds: [],
			includeRuntime: true,
		});
	});

	it("timestamps the result file so a later run never overwrites an earlier one", () => {
		expect(resultFilePath("2026-08-20T12:00:00.000Z")).toBe(
			"docs/benchmarks/bun-1-4/2026-08-20T12-00-00.json",
		);
		expect(resultFilePath("2026-09-01T00:00:00.000Z")).not.toBe(
			resultFilePath("2026-08-20T12:00:00.000Z"),
		);
	});

	it("keeps two runs on the same day in separate files", () => {
		expect(resultFilePath("2026-08-20T22:15:48.216Z")).not.toBe(
			resultFilePath("2026-08-20T22:41:03.900Z"),
		);
	});

	it("produces a filename with no characters that need escaping on disk", () => {
		expect(resultFilePath("2026-08-20T22:15:48.216Z")).not.toContain(":");
	});

	it("commits results outside the gitignored docs/_reports directory", () => {
		expect(RESULTS_DIR).toBe("docs/benchmarks/bun-1-4");
		expect(RESULTS_DIR).not.toContain("_reports");
	});
});

describe("bench entry point registration", () => {
	it("registers `bun run bench` in package.json", async () => {
		const pkg = JSON.parse(
			await readFile(join(process.cwd(), "package.json"), "utf-8"),
		) as { scripts: Record<string, string> };
		expect(pkg.scripts.bench).toBe("bun run scripts/bench.ts");
	});
});
