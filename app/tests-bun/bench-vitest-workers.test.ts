import { describe, expect, test } from "bun:test";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { MeasuredRun } from "#/lib/bench/runner.server";
import {
	commandForProfile,
	LOAD_GATE_TIMEOUT_MS,
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
		sleep: async () => {},
		nowMs: () => 0,
		loadAvg: () => 0.1,
		ambientLoadPollIntervalMs: 1,
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
		let runs = 0;
		const run = await runWorkerBenchmark(
			["1", "2"],
			5,
			deps(async (argv) => {
				calls.push(argv);
				runs += 1;
				return measured(runs === 1 ? { ms: 7, peakRssBytes: 999 } : {});
			}, {}),
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
		expect(run.profiles[0].warmupSamples).toHaveLength(1);
		expect(run.profiles[0].warmupSamples[0].durationMs).toBe(7);
		expect(run.profiles[0].aggregate?.medianMs).toBe(100);
		expect(run.profiles[0].totalWallTimeMs).toBe(507);
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

	test("excludes one failed profile while selecting among valid profiles", async () => {
		const profileRuns = new Map<string, number>();
		const run = await runWorkerBenchmark(
			["1", "2", "4", "auto"],
			5,
			deps(async (argv) => {
				const id =
					argv.find((arg) => arg.startsWith("--maxWorkers="))?.slice(13) ??
					"auto";
				const count = (profileRuns.get(id) ?? 0) + 1;
				profileRuns.set(id, count);
				if (id === "2" && count > 1) {
					return measured({
						exitCode: 1,
						peakRssBytes: 1,
						stdout: "Test Files  1 failed (1)\nTests  1 failed (1)",
					});
				}
				return measured({
					peakRssBytes: id === "1" ? 100 : id === "4" ? 150 : 200,
				});
			}),
		);
		const profile2 = run.profiles.find((profile) => profile.profile === "2");
		expect(profile2?.memoryValid).toBe(false);
		expect(profile2?.memoryInvalidReasons.join(" ")).toContain("exit code 1");
		expect(
			run.profiles
				.filter((profile) => profile.profile !== "2")
				.every((profile) => profile.memoryValid),
		).toBe(true);
		expect(run.validMemoryComparison).toBe(true);
		expect(run.memoryWinner).toBe("1");
		expect(run.validTimingComparison).toBe(false);
		expect(run.winner).toBeNull();
		expect(renderWorkerBenchmark(run)).toContain("Profile 2: memory invalid");
	});

	test("suppresses winner for failure and load-invalid samples", async () => {
		let calls = 0;
		const run = await runWorkerBenchmark(
			["1", "2"],
			1,
			deps(
				async (argv) => {
					calls += 1;
					return argv.at(-1) === "--maxWorkers=2"
						? measured({
								exitCode: 1,
								stdout: "Test Files  1 failed (1)\nTests  1 failed (1)",
							})
						: measured({ loadAvg1: calls > 2 ? 5 : 0.1 });
				},
				{
					loadAvg: () => (calls > 1 ? 5 : 0.1),
				},
			),
		);
		expect(run.validComparison).toBe(false);
		expect(run.winner).toBeNull();
		expect(run.invalidReasons.join(" ")).toContain("exit code 1");
		expect(run.invalidReasons.join(" ")).toContain("Vitest outcome changed");
		expect(run.invalidReasons.join(" ")).toContain("ambient load 5.00");
	});

	test("waits for load cooldown before starting each run", async () => {
		let hostCalls = 0;
		let sleepCalls = 0;
		const run = await runWorkerBenchmark(
			["1"],
			1,
			deps(async () => measured(), {
				host: async () => ({
					host: "test-host",
					cpuModel: "test-cpu",
					cores: 4,
					totalMemBytes: 100,
					loadAvg1: hostCalls++ === 0 ? 5 : 0.1,
					powerSource: "ac",
					startedAt: "2026-08-23T00:00:00.000Z",
				}),
				sleep: async () => {
					sleepCalls += 1;
				},
			}),
		);
		expect(sleepCalls).toBe(1);
		expect(run.profiles[0].warmupSamples[0].loadGateTimedOut).toBe(false);
	});

	test("executes and invalidates runs when load never cools down", async () => {
		let nowMs = 0;
		const run = await runWorkerBenchmark(
			["1"],
			1,
			deps(async () => measured(), {
				host: async () => ({
					host: "test-host",
					cpuModel: "test-cpu",
					cores: 4,
					totalMemBytes: 100,
					loadAvg1: 5,
					powerSource: "ac",
					startedAt: "2026-08-23T00:00:00.000Z",
				}),
				sleep: async () => {
					nowMs += LOAD_GATE_TIMEOUT_MS;
				},
				nowMs: () => nowMs,
			}),
		);
		expect(run.profiles[0].warmupSamples[0].loadGateTimedOut).toBe(true);
		expect(run.profiles[0].samples[0].loadGateTimedOut).toBe(true);
		expect(run.validComparison).toBe(false);
		expect(run.invalidReasons.join(" ")).toContain("load gate timed out");
	});

	test("keeps the memory winner when ambient load invalidates timing", async () => {
		let runs = 0;
		let activeLoad = 0.1;
		const run = await runWorkerBenchmark(
			["1"],
			1,
			deps(
				async () => {
					runs += 1;
					activeLoad = runs === 2 ? 5 : 0.1;
					await new Promise((resolve) => setTimeout(resolve, 10));
					return measured({ peakRssBytes: 50 });
				},
				{
					loadAvg: () => activeLoad,
					ambientLoadPollIntervalMs: 1,
				},
			),
		);
		expect(run.validMemoryComparison).toBe(false);
		expect(run.validTimingComparison).toBe(false);
		expect(run.memoryWinner).toBe("1");
		expect(run.winner).toBeNull();
		expect(run.timingInvalidReasons.join(" ")).toContain("ambient load 5.00");
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
		expect(renderWorkerBenchmark(run)).toContain(
			"Warmups (excluded from aggregate)",
		);
		expect(renderWorkerBenchmark(run)).toContain(
			"total wall time 200.00 ms including warmup",
		);
	});
});
