import { describe, expect, it } from "vitest";
import { parseBenchArgs } from "#/lib/bench/cli";

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
