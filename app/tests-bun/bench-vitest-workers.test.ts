import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MeasuredRun } from "#/lib/bench/runner.server";
import {
	commandForProfile,
	parseWorkerBenchArgs,
	renderWorkerBenchmark,
	runWorkerBenchmark,
	WORKER_PROFILES,
	type WorkerBenchDeps,
	writeWorkerBenchmark,
} from "../../scripts/bench-vitest-workers";

const summary = "Test Files  2 passed (2)\nTests  10 passed (10)";

function measured(over: Partial<MeasuredRun> = {}): MeasuredRun {
	return {
		ms: 100,
		peakRssBytes: 100,
		exitCode: 0,
		loadAvg1: 0.1,
		stdout: summary,
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
	test("defines profiles and parses bounded selection", () => {
		expect(WORKER_PROFILES.map((profile) => profile.id)).toEqual([
			"1",
			"2",
			"4",
			"auto",
		]);
		expect(commandForProfile(WORKER_PROFILES[3])).not.toContain("--maxWorkers");
		expect(
			parseWorkerBenchArgs(["--only=2,auto", "--repetitions=3"]),
		).toMatchObject({
			profiles: ["2", "auto"],
			repetitions: 3,
		});
		expect(() => parseWorkerBenchArgs(["--repetitions=0"])).toThrow(
			"--repetitions must be a positive integer",
		);
	});

	test("discards warmups, persists five samples, and alternates order", async () => {
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
		expect(run.profiles.map((profile) => profile.samples.length)).toEqual([
			5, 5,
		]);
	});

	test("selects lowest RSS profile when outcomes are equivalent", async () => {
		const run = await runWorkerBenchmark(
			["1", "2"],
			2,
			deps(async (argv) =>
				measured({ peakRssBytes: argv.at(-1) === "--maxWorkers=2" ? 50 : 100 }),
			),
		);
		expect(run.validComparison).toBe(true);
		expect(run.winner).toBe("2");
	});

	test("suppresses winner for failure and load-invalid samples", async () => {
		let calls = 0;
		const run = await runWorkerBenchmark(
			["1", "2"],
			1,
			deps(async (argv) => {
				calls += 1;
				return argv.at(-1) === "--maxWorkers=2"
					? measured({
							exitCode: 1,
							stdout: "Test Files  1 failed (1)\nTests  1 failed (1)",
						})
					: measured({ loadAvg1: calls > 2 ? 2 : 0.1 });
			}),
		);
		expect(run.validComparison).toBe(false);
		expect(run.winner).toBeNull();
		expect(run.invalidReasons.join(" ")).toContain("exit code 1");
		expect(run.invalidReasons.join(" ")).toContain("Vitest outcome changed");
		expect(run.invalidReasons.join(" ")).toContain("load 2.00");
	});

	test("writes immutable JSON and metadata-rich Markdown", async () => {
		const run = await runWorkerBenchmark(
			["1"],
			1,
			deps(async () => measured()),
		);
		const dir = await mkdtemp(join(tmpdir(), "vitest-workers-"));
		const first = await writeWorkerBenchmark(run, dir);
		const second = await writeWorkerBenchmark(run, dir);
		expect(second.jsonPath).not.toBe(first.jsonPath);
		expect(renderWorkerBenchmark(run)).toContain(
			"warmup discarded + 1 measured",
		);
	});
});
