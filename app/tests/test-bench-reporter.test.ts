import { mkdtemp, readdir, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	renderTestComparison,
	writeTestComparison,
} from "#/lib/test-bench/reporter.server";
import type { TestComparisonRun } from "#/lib/test-bench/types";

function run(validComparison = true): TestComparisonRun {
	return {
		commit: "abc123",
		timestamp: "2026-08-22T01:02:03.000Z",
		host: {
			host: "ci",
			cpuModel: "cpu",
			cores: 4,
			totalMemBytes: 1000,
			loadAvg1: 1,
			powerSource: "ac",
			startedAt: "2026-08-22T01:02:03.000Z",
		},
		samples: [
			...(["A", "B", "C"] as const).map((arm, index) => ({
				arm,
				durationMs: 100 + index * 20,
				peakRssBytes: 10_000 + index * 100,
				exitCode: 0,
				timedOut: false,
				outcome: {
					filesPassed: 1,
					filesFailed: 0,
					testsPassed: 2,
					testsFailed: 0,
					testsSkipped: 0,
					testFileCount: 1,
				},
				provenance: {
					command: `run-${arm}`,
					execPath: `/bin/${arm}`,
					runtime: arm === "A" ? ("node" as const) : ("bun" as const),
					runtimeVersion: arm === "A" ? "24.19.0" : "1.4.0",
					runner: arm === "C" ? ("bun:test" as const) : ("vitest" as const),
					runnerVersion: arm === "C" ? "1.4.0" : "4.1.5",
				},
				loadAvg1: 1,
			})),
		],
		inventory: {
			ok: true,
			valid: true,
			reasons: [],
			reference: [],
			candidate: [],
			missingFiles: [],
			extraFiles: [],
		},
		validComparison,
		invalidReasons: validComparison ? [] : ["C: test outcome summary missing"],
	};
}

describe("test comparison reporter", () => {
	it("renders valid per-arm median timing, RSS, outcomes, and provenance", () => {
		const markdown = renderTestComparison(run());
		expect(markdown).toContain("median 100.00 ms");
		expect(markdown).toContain("RSS 0 MiB");
		expect(markdown).toContain("2 passed");
		expect(markdown).toContain("/bin/C");
	});

	it("renders valid deltas between arms", () => {
		const markdown = renderTestComparison(run());
		expect(markdown).toContain("A → B:");
		expect(markdown).toContain("B → C:");
	});

	it("renders invalid reasons and no performance language", () => {
		const markdown = renderTestComparison(run(false));
		expect(markdown).toContain("Comparison invalid");
		expect(markdown).toContain("C: test outcome summary missing");
		expect(markdown).not.toMatch(/winner|improvement/i);
	});

	it("renders missing samples as unavailable", () => {
		const incomplete = run();
		incomplete.samples = incomplete.samples.filter(
			(sample) => sample.arm !== "C",
		);
		expect(renderTestComparison(incomplete)).toContain("C: no timed samples");
	});

	it("preserves raw failure excerpts in JSON", async () => {
		const dir = await mkdtemp(join(tmpdir(), "test-bench-report-"));
		const failed = run(false);
		failed.samples[2].failureExcerpt = "stack tail";
		const paths = await writeTestComparison(failed, dir);
		const json = await readFile(paths.jsonPath, "utf8");
		expect(json).toContain("stack tail");
	});

	it("writes JSON and Markdown side by side", async () => {
		const dir = await mkdtemp(join(tmpdir(), "test-bench-report-"));
		const paths = await writeTestComparison(run(), dir);
		expect(paths.jsonPath.endsWith(".json")).toBe(true);
		expect(paths.markdownPath.endsWith(".md")).toBe(true);
	});

	it("creates the benchmark directory when absent", async () => {
		const dir = join(
			await mkdtemp(join(tmpdir(), "test-bench-report-")),
			"nested",
		);
		await writeTestComparison(run(), dir);
		expect((await readdir(dir)).length).toBe(2);
	});

	it("uses timestamp in report names", async () => {
		const dir = await mkdtemp(join(tmpdir(), "test-bench-report-"));
		const paths = await writeTestComparison(run(), dir);
		expect(paths.jsonPath).toContain("2026-08-22T01-02-03-000Z");
	});

	it("does not overwrite two writes in the same timestamp", async () => {
		const dir = await mkdtemp(join(tmpdir(), "test-bench-report-"));
		const first = await writeTestComparison(run(), dir);
		const second = await writeTestComparison(run(), dir);
		expect(second.jsonPath).not.toBe(first.jsonPath);
		expect(second.markdownPath).not.toBe(first.markdownPath);
	});

	it("keeps every raw sample in JSON", async () => {
		const dir = await mkdtemp(join(tmpdir(), "test-bench-report-"));
		const paths = await writeTestComparison(run(), dir);
		const json = JSON.parse(
			await readFile(paths.jsonPath, "utf8"),
		) as TestComparisonRun;
		expect(json.samples).toHaveLength(3);
		expect(json.samples.map((sample) => sample.arm)).toEqual(["A", "B", "C"]);
	});
});
