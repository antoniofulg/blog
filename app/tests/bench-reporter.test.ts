import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	formatBytes,
	renderReport,
	writeReport,
} from "#/lib/bench/reporter.server";
import type { Aggregate, RunResult } from "#/lib/bench/types";

function agg(medianMs: number, minMs: number, maxMs: number): Aggregate {
	return {
		medianMs,
		minMs,
		maxMs,
		medianPeakRssBytes: 100 * 1024 * 1024,
		sampleCount: 5,
	};
}

function run(over: Partial<RunResult> = {}): RunResult {
	return {
		schemaVersion: 1,
		host: {
			host: "mac",
			cpuModel: "Apple M3",
			cores: 12,
			totalMemBytes: 32 * 1024 * 1024 * 1024,
			loadAvg1: 0.4,
			powerSource: "ac",
			startedAt: "2026-08-20T12:00:00.000Z",
		},
		versions: ["1.3.14", "1.4.0"],
		workloads: [
			{
				id: "lint",
				version: "1.3.14",
				samples: [],
				aggregate: agg(1000, 990, 1010),
			},
			{
				id: "lint",
				version: "1.4.0",
				samples: [],
				aggregate: agg(500, 495, 505),
			},
		],
		runtime: [],
		findings: [],
		...over,
	};
}

describe("bench report rendering", () => {
	it("emits one row per workload with both medians and the delta", () => {
		const md = renderReport(run());
		expect(md).toContain(
			"| `lint` | 1.00 s | 500 ms | -50.0% | faster | 100.0 MB | 100.0 MB | +0.0% |",
		);
	});

	it("names both compared versions in the heading", () => {
		expect(renderReport(run())).toContain("# Bun 1.3.14 vs 1.4.0");
	});

	it("records the host provenance so the numbers stay interpretable", () => {
		const md = renderReport(run());
		expect(md).toContain("Apple M3");
		expect(md).toContain("2026-08-20T12:00:00.000Z");
		expect(md).toContain("power: ac");
	});

	it("renders a delta inside the noise band as within noise, not as a change", () => {
		const md = renderReport(
			run({
				workloads: [
					{
						id: "build",
						version: "1.3.14",
						samples: [],
						aggregate: agg(1000, 800, 1200),
					},
					{
						id: "build",
						version: "1.4.0",
						samples: [],
						aggregate: agg(950, 850, 1150),
					},
				],
			}),
		);
		expect(md).toContain("within noise");
		expect(md).not.toContain("| faster |");
	});

	it("states that no comparison is available for a single-version run", () => {
		const md = renderReport(
			run({
				versions: ["1.4.0"],
				workloads: [
					{
						id: "lint",
						version: "1.4.0",
						samples: [],
						aggregate: agg(500, 495, 505),
					},
				],
			}),
		);
		expect(md).toContain("no comparison is available");
		expect(md).toContain("| Workload | Median | Min | Max | Median peak RSS |");
	});

	it("reports no findings explicitly when every workload completed", () => {
		expect(renderReport(run())).toContain(
			"None — every workload completed under every version.",
		);
	});

	it("names the workload, version and exit code of a compat finding", () => {
		const md = renderReport(
			run({
				findings: [
					{
						kind: "compat",
						version: "1.4.0",
						workloadId: "test-e2e",
						exitCode: 1,
						stderrTail: "TypeError: boom",
					},
				],
			}),
		);
		expect(md).toContain("| `test-e2e` | 1.4.0 | compat | 1 | unknown |");
		expect(md).toContain("TypeError: boom");
	});

	it("prefers the stdout excerpt, where the test runners print their failures", () => {
		// Playwright and Vitest write their failure summary to stdout; stderr
		// holds server log noise. Rendering stderr made a passing negative-path
		// test ("Invalid password") read as the cause of a compat finding.
		const md = renderReport(
			run({
				findings: [
					{
						kind: "compat",
						version: "1.4.0",
						workloadId: "test-e2e",
						exitCode: 1,
						stderrTail: "[WebServer] Invalid password",
						stdoutTail: "1 failed\n  locale switcher: modal cancel",
					},
				],
			}),
		);
		expect(md).toContain("locale switcher: modal cancel");
		expect(md).not.toContain("[WebServer] Invalid password");
	});

	it("falls back to stderr when the workload printed nothing to stdout", () => {
		const md = renderReport(
			run({
				findings: [
					{
						kind: "compat",
						version: "1.4.0",
						workloadId: "check",
						exitCode: 2,
						stderrTail: "TS2345: argument of type",
						stdoutTail: "   ",
					},
				],
			}),
		);
		expect(md).toContain("TS2345: argument of type");
	});

	it("shows a timeout finding as killed rather than as exit code zero", () => {
		const md = renderReport(
			run({
				findings: [
					{
						kind: "timeout",
						version: "1.3.14",
						workloadId: "build",
						exitCode: null,
						stderrTail: "",
					},
				],
			}),
		);
		expect(md).toContain("| `build` | 1.3.14 | timeout | killed | unknown |");
	});

	it("renders the runtime table with boot, memory and latency for each version", () => {
		const md = renderReport(
			run({
				runtime: [
					{
						version: "1.4.0",
						bootMs: 320,
						idleRssBytes: 90 * 1024 * 1024,
						peakRssBytes: 150 * 1024 * 1024,
						postLoadRssBytes: 110 * 1024 * 1024,
						latency: { p50: 12, p95: 40, p99: 80 },
						totalRequests: 5000,
						nonOk: [],
					},
				],
			}),
		);
		expect(md).toContain(
			"| 1.4.0 | 320 ms | 90.0 MB | 150.0 MB | 110.0 MB | 12 ms | 40 ms | 80 ms | 5000 |",
		);
		expect(md).toContain("sampled every 100 ms");
	});

	it("writes REPORT.md into the given directory and returns its path", async () => {
		const dir = await mkdtemp(join(tmpdir(), "bench-report-"));
		const path = await writeReport(run(), dir);
		expect(path).toBe(join(dir, "REPORT.md"));
		expect(await readFile(path, "utf-8")).toContain("# Bun 1.3.14 vs 1.4.0");
	});

	it("reports the peak RSS delta alongside the timing delta", () => {
		const md = renderReport(
			run({
				workloads: [
					{
						id: "install-warm",
						version: "1.3.14",
						samples: [],
						aggregate: {
							...agg(2000, 1990, 2010),
							medianPeakRssBytes: 158 * 1024 * 1024,
						},
					},
					{
						id: "install-warm",
						version: "1.4.0",
						samples: [],
						aggregate: {
							...agg(1280, 1270, 1290),
							medianPeakRssBytes: 66 * 1024 * 1024,
						},
					},
				],
			}),
		);
		expect(md).toContain("158.0 MB");
		expect(md).toContain("66.0 MB");
		expect(md).toContain("-58.2%");
	});

	it("states that the noise verdict does not cover the memory columns", () => {
		expect(renderReport(run())).toContain("RSS columns carry no verdict");
	});

	it("separates a flaky workload from an incompatible one by the failure ratio", () => {
		const md = renderReport(
			run({
				findings: [
					{
						kind: "compat",
						version: "1.4.0",
						workloadId: "test-e2e",
						exitCode: 1,
						stderrTail: "Invalid password",
						failedAttempts: 1,
						totalAttempts: 6,
					},
				],
			}),
		);
		expect(md).toContain("| `test-e2e` | 1.4.0 | compat | 1 | 1 of 6 |");
	});

	it("formats byte counts as megabytes", () => {
		expect(formatBytes(1024 * 1024 * 3)).toBe("3.0 MB");
	});
});
