import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MeasuredRun } from "#/lib/bench/runner.server";
import {
	commandForProfile,
	DEFAULT_REPETITIONS,
	parseWorkerBenchArgs,
	readWorkerBenchmark,
	renderWorkerBenchmark,
	runWorkerBenchmark,
	WORKER_PROFILES,
	type WorkerBenchDeps,
	writeWorkerBenchmark,
} from "../../scripts/bench-vitest-workers";

const outcome = "Test Files  2 passed (2)\nTests  10 passed (10)";

function measured(over: Partial<MeasuredRun> = {}): MeasuredRun {
	return {
		ms: 100,
		peakRssBytes: 100,
		exitCode: 0,
		loadAvg1: 0.1,
		stdout: outcome,
		stderrTail: "",
		timedOut: false,
		pgid: 1,
		...over,
	};
}

function deps(
	spawn: WorkerBenchDeps["spawn"],
	override: Partial<WorkerBenchDeps> = {},
): WorkerBenchDeps {
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
		runnerVersion: "4.1.5",
		cwd: "/repo",
		...override,
	};
}

describe("Vitest worker benchmark", () => {
	it("defines 1, 2, 4, and omitted auto worker commands", () => {
		expect(WORKER_PROFILES.map((profile) => profile.id)).toEqual([
			"1",
			"2",
			"4",
			"auto",
		]);
		expect(commandForProfile(WORKER_PROFILES[3])).not.toContain("--maxWorkers");
		expect(parseWorkerBenchArgs([]).repetitions).toBe(DEFAULT_REPETITIONS);
		expect(parseWorkerBenchArgs(["--only=2,auto"]).profiles).toEqual([
			"2",
			"auto",
		]);
		expect(parseWorkerBenchArgs(["--repetitions=3"]).repetitions).toBe(3);
		expect(() => parseWorkerBenchArgs(["--repetitions=0"])).toThrow(
			"--repetitions must be a positive integer",
		);
	});

	it("discards one warmup and alternates sequential profile order", async () => {
		const calls: string[][] = [];
		const run = await runWorkerBenchmark(
			["1", "2"],
			5,
			deps(async (argv) => {
				calls.push(argv);
				return measured();
			}),
		);
		expect(calls).toHaveLength(12);
		expect(calls.slice(0, 2).map((argv) => argv.at(-1))).toEqual([
			"--maxWorkers=1",
			"--maxWorkers=2",
		]);
		expect(calls.slice(2).map((argv) => argv.at(-1))).toEqual([
			"--maxWorkers=1",
			"--maxWorkers=2",
			"--maxWorkers=2",
			"--maxWorkers=1",
			"--maxWorkers=1",
			"--maxWorkers=2",
			"--maxWorkers=2",
			"--maxWorkers=1",
			"--maxWorkers=1",
			"--maxWorkers=2",
		]);
		expect(run.profiles.every((profile) => profile.samples)).toBe(true);
		expect(run.profiles.map((profile) => profile.samples.length)).toEqual([
			5, 5,
		]);
		expect(run.warmupsPerProfile).toBe(1);
	});

	it("selects lowest median RSS only when every measured outcome is valid", async () => {
		let calls = 0;
		const run = await runWorkerBenchmark(
			["1", "2"],
			2,
			deps(async (argv) => {
				calls += 1;
				return measured({
					peakRssBytes: argv.at(-1) === "--maxWorkers=2" ? 50 : 100,
					ms: calls,
				});
			}),
		);
		expect(run.validComparison).toBe(true);
		expect(run.winner).toBe("2");
		expect(run.profiles[1].aggregate?.medianPeakRssBytes).toBe(50);
	});

	it("invalidates failed, changed, and overloaded samples and suppresses winner", async () => {
		let calls = 0;
		const run = await runWorkerBenchmark(
			["1", "2"],
			1,
			deps(
				async (argv) => {
					calls += 1;
					if (argv.at(-1) === "--maxWorkers=2") {
						return measured({
							exitCode: 1,
							stdout: "Test Files  1 failed (1)\nTests  1 failed (1)",
						});
					}
					return measured({ loadAvg1: calls > 2 ? 2 : 0.1 });
				},
				{
					host: async () => ({
						host: "test-host",
						cpuModel: "test-cpu",
						cores: 4,
						totalMemBytes: 100,
						loadAvg1: 0.1,
						powerSource: "ac",
						startedAt: "2026-08-23T00:00:00.000Z",
					}),
				},
			),
		);
		expect(run.validComparison).toBe(false);
		expect(run.winner).toBeNull();
		expect(run.invalidReasons.join(" ")).toContain("exit code 1");
		expect(run.invalidReasons.join(" ")).toContain("Vitest outcome changed");
		expect(run.invalidReasons.join(" ")).toContain("load 2.00");
	});

	it("renders required metadata and keeps same-timestamp artifacts immutable", async () => {
		const run = await runWorkerBenchmark(
			["1"],
			1,
			deps(async () => measured()),
		);
		const markdown = renderWorkerBenchmark(run);
		expect(markdown).toContain("warmup discarded + 1 measured");
		expect(markdown).toContain("test:vitest:bun -- --maxWorkers=1");
		expect(markdown).toContain("10 passed / 0 failed / 0 skipped");
		const dir = await mkdtemp(join(tmpdir(), "vitest-workers-"));
		const first = await writeWorkerBenchmark(run, dir);
		const second = await writeWorkerBenchmark(run, dir);
		expect(second.jsonPath).not.toBe(first.jsonPath);
		expect(second.markdownPath).not.toBe(first.markdownPath);
		expect(
			(await readWorkerBenchmark(first.jsonPath)).profiles[0].samples,
		).toHaveLength(1);
		expect(await readFile(first.markdownPath, "utf8")).toContain(
			"# Bun + Vitest worker benchmark",
		);
	});

	it("omits winner language from invalid reports", async () => {
		const run = await runWorkerBenchmark(
			["1"],
			1,
			deps(async () => measured({ exitCode: 1 })),
		);
		const markdown = renderWorkerBenchmark(run);
		expect(markdown).toContain("Comparison invalid");
		expect(markdown).toContain("No winner is reported.");
		expect(markdown).not.toContain("Winner: **");
	});
});
