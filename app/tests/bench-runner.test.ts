import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	groupRssBytes,
	type MeasuredRun,
	spawnMeasured,
	tailLines,
} from "#/lib/bench/runner.server";
import type { HostMeta } from "#/lib/bench/types";
import {
	externalProcessContamination,
	parseRunnerOutcome,
	type RevalidationArm,
	type RevalidationDeps,
	type RevalidationRun,
	readRevalidationReport,
	renderRevalidationMarkdown,
	runRevalidation,
	writeRevalidationReport,
} from "#/lib/test-bench/revalidation";

const ENV = process.env;
const MB = 1024 * 1024;

describe("bench spawn measurement", () => {
	it("measures wall-clock duration of the spawned command", async () => {
		const result = await spawnMeasured(["bash", "-c", "sleep 0.4"], ENV, {
			timeoutMs: 10_000,
		});
		expect(result.ms).toBeGreaterThan(350);
		expect(result.exitCode).toBe(0);
	});

	it("reports higher peak RSS for a child that allocates than one that does not", async () => {
		const idle = await spawnMeasured(["bash", "-c", "sleep 3.5"], ENV, {
			timeoutMs: 30_000,
		});
		const heavy = await spawnMeasured(
			[
				"bash",
				"-c",
				"bun -e 'const b=Buffer.alloc(300*1024*1024,7);const t=Date.now();while(Date.now()-t<3500){};console.log(b.length)'",
			],
			ENV,
			{ timeoutMs: 30_000 },
		);
		expect(heavy.peakRssBytes).toBeGreaterThan(idle.peakRssBytes);
		expect(heavy.peakRssBytes - idle.peakRssBytes).toBeGreaterThan(32 * MB);
	});

	it("counts a descendant's memory, not only the direct child's", async () => {
		// bash is the direct child; bun is its descendant and holds the memory.
		const idle = await spawnMeasured(
			[
				"bash",
				"-c",
				"bun -e 'const t=Date.now();while(Date.now()-t<3500){}' | cat",
			],
			ENV,
			{ timeoutMs: 30_000 },
		);
		const heavy = await spawnMeasured(
			[
				"bash",
				"-c",
				"bun -e 'const b=Buffer.alloc(300*1024*1024,7);const t=Date.now();while(Date.now()-t<3500){};console.log(b.length)' | cat",
			],
			ENV,
			{ timeoutMs: 30_000 },
		);
		expect(heavy.peakRssBytes).toBeGreaterThan(idle.peakRssBytes);
		expect(heavy.peakRssBytes - idle.peakRssBytes).toBeGreaterThan(32 * MB);
	});

	it("kills a command that exceeds the timeout and leaves no orphan", async () => {
		const result = await spawnMeasured(["bash", "-c", "sleep 30"], ENV, {
			timeoutMs: 700,
		});
		expect(result.timedOut).toBe(true);
		expect(result.exitCode).not.toBe(0);
		expect(result.ms).toBeLessThan(5_000);
		expect(await groupRssBytes(result.pgid)).toBe(0);
	});

	it("returns a non-zero exit as data rather than throwing", async () => {
		const result = await spawnMeasured(["bash", "-c", "exit 3"], ENV, {
			timeoutMs: 10_000,
		});
		expect(result.exitCode).toBe(3);
		expect(result.timedOut).toBe(false);
	});

	it("captures stdout and the tail of stderr", async () => {
		const result = await spawnMeasured(
			["bash", "-c", "echo hello; echo boom >&2"],
			ENV,
			{ timeoutMs: 10_000 },
		);
		expect(result.stdout).toContain("hello");
		expect(result.stderrTail).toContain("boom");
	});

	it("keeps only the last 20 stderr lines", () => {
		const text = Array.from({ length: 50 }, (_, i) => `line${i}`).join("\n");
		const tail = tailLines(text);
		expect(tail.split("\n")).toHaveLength(20);
		expect(tail).toContain("line49");
		expect(tail).not.toContain("line29");
	});

	it("reports zero resident memory for a process group that no longer exists", async () => {
		expect(await groupRssBytes(999_999)).toBe(0);
	});
});

const arms: RevalidationArm[] = [
	{
		id: "vitest",
		runner: "vitest",
		runtime: "bun",
		runnerVersion: "4.1.5",
		runtimeVersion: "1.4.0",
		command: ["bun", "run", "test:vitest:bun:1"],
		workerCount: 1,
		isolation: "isolated",
		timeoutMs: 1000,
	},
	{
		id: "bun-test",
		runner: "bun:test",
		runtime: "bun",
		runnerVersion: "1.4.0",
		runtimeVersion: "1.4.0",
		command: ["bun", "run", "test:bun:parity"],
		workerCount: 1,
		isolation: "isolated",
		timeoutMs: 1000,
	},
];

const host: HostMeta = {
	host: "fixture",
	cpuModel: "fixture-cpu",
	cores: 2,
	totalMemBytes: 8 * 1024 * 1024 * 1024,
	loadAvg1: 0.1,
	powerSource: "ac",
	startedAt: "2026-08-24T00:00:00.000Z",
};

function provenance(arm: RevalidationArm): string {
	return JSON.stringify({
		command: arm.command.join(" "),
		execPath: "/fixture/bun",
		runtime: arm.runtime,
		runtimeVersion: arm.runtimeVersion,
		runner: arm.runner,
		runnerVersion: arm.runnerVersion,
	});
}

function runResult(
	arm: RevalidationArm,
	overrides: Partial<MeasuredRun> = {},
): MeasuredRun {
	const bunOutput = "2 pass\nRan 2 tests across 1 files.";
	const vitestOutput = "Test Files 1 passed (1)\nTests 2 passed (2)";
	return {
		ms: 20,
		peakRssBytes: 10 * 1024 * 1024,
		exitCode: 0,
		loadAvg1: 0.1,
		stdout: `${provenance(arm)}\n${arm.runner === "vitest" ? vitestOutput : bunOutput}`,
		stderrTail: "",
		timedOut: false,
		pgid: 0,
		...overrides,
	};
}

function depsFor(
	runs: MeasuredRun[],
	overrides: Partial<RevalidationDeps> = {},
): RevalidationDeps {
	return {
		spawn: async () => {
			const next = runs.shift();
			if (!next) throw new Error("fixture runner exhausted");
			return next;
		},
		host: async () => host,
		commit: async () => "fixture-commit",
		inventory: async () => ({
			ok: true,
			valid: true,
			reasons: [],
			reference: [],
			candidate: [],
			missingFiles: [],
			extraFiles: [],
			dispositions: [],
		}),
		cwd: process.cwd(),
		env: { TZ: "UTC" },
		...overrides,
	};
}

describe("Bun Test revalidation harness", () => {
	it("normalizes Bun's unnamed skipped describe wrappers", () => {
		const outcome = parseRunnerOutcome(
			'{"runner":"bun:test"}\n11 pass\n2 skip\n(skip) integration > (unnamed)\n(skip) integration > skipped leaf\nRan 11 tests across 1 files.',
			"bun:test",
		);
		expect(outcome).toMatchObject({
			testsPassed: 11,
			testsSkipped: 1,
		});
	});

	it("ignores lock waiters but detects their actual test children", () => {
		const ps = [
			"python tools/machine-lock.py playwright test",
			"lockf -ks /tmp/creatista-test.lock npx vitest run",
			"node /other/node_modules/.bin/playwright test",
			"node /other/node_modules/vitest/dist/workers/forks.js",
		].join("\n");
		expect(externalProcessContamination(ps, "/blog")).toContain(
			"node /other/node_modules/.bin/playwright test",
		);
		expect(externalProcessContamination(ps, "/blog")).toContain(
			"node /other/node_modules/vitest/dist/workers/forks.js",
		);
		expect(externalProcessContamination(ps, "/blog")).not.toContain(
			"machine-lock.py",
		);
	});
	it("discards one warmup, rotates measured arms, and aggregates valid samples", async () => {
		const runs = [
			...arms.map((arm) => runResult(arm)),
			runResult(arms[0], { ms: 10 }),
			runResult(arms[1], { ms: 20 }),
			runResult(arms[1], { ms: 40 }),
			runResult(arms[0], { ms: 30 }),
		];
		const result = await runRevalidation(arms, 2, depsFor(runs));
		expect(result.validComparison).toBe(true);
		expect(result.warmupCount).toBe(2);
		expect(result.samples.filter((sample) => sample.excluded)).toHaveLength(2);
		expect(result.samples.filter((sample) => !sample.excluded)).toHaveLength(4);
		expect(result.armOrderByRepetition).toEqual([
			["vitest", "bun-test"],
			["bun-test", "vitest"],
		]);
		expect(result.aggregates.vitest?.medianMs).toBe(20);
		expect(result.aggregates["bun-test"]?.medianMs).toBe(30);
	});

	it("retains failed and contaminated samples but invalidates the comparison", async () => {
		const runs = [
			...arms.map((arm) => runResult(arm)),
			runResult(arms[0], { exitCode: 3, stderrTail: "failure" }),
			runResult(arms[1]),
		];
		const result = await runRevalidation(
			arms,
			1,
			depsFor(runs, {
				contamination: (_run, arm) =>
					arm.id === "bun-test" ? "fixture load" : undefined,
			}),
		);
		expect(result.validComparison).toBe(false);
		expect(result.samples.filter((sample) => sample.excluded)).toHaveLength(4);
		expect(result.invalidReasons).toEqual(
			expect.arrayContaining([
				"vitest repetition 1: vitest: exit code 3",
				"bun-test repetition 1: contaminated: fixture load",
			]),
		);
	});

	it("retains timed-out measured samples as invalid evidence", async () => {
		const runs = [
			...arms.map((arm) => runResult(arm)),
			runResult(arms[0], { timedOut: true, exitCode: -9 }),
			runResult(arms[1]),
		];
		const result = await runRevalidation(arms, 1, depsFor(runs));
		expect(result.validComparison).toBe(false);
		expect(
			result.samples.find(
				(sample) => sample.arm === "vitest" && sample.repetition === 1,
			),
		).toMatchObject({
			excluded: true,
			timedOut: true,
			exclusionReason: expect.stringContaining("vitest: timeout"),
		});
		expect(
			result.invalidReasons.some((reason) =>
				reason.startsWith("vitest repetition 1: vitest: timeout"),
			),
		).toBe(true);
	});

	it("invalidates equal-count runs with different outcomes", async () => {
		const mismatch = runResult(arms[1], {
			stdout: `${provenance(arms[1])}\n3 pass\nRan 3 tests across 1 files.`,
		});
		const result = await runRevalidation(
			arms,
			1,
			depsFor([
				...arms.map((arm) => runResult(arm)),
				runResult(arms[0]),
				mismatch,
			]),
		);
		expect(result.validComparison).toBe(false);
		expect(result.invalidReasons).toContain(
			"runtime outcome testsPassed mismatch: reference=2, candidate=3",
		);
	});

	it("writes non-overwriting JSON and Markdown that preserve invalidity evidence", async () => {
		const root = await mkdtemp(join(tmpdir(), "blog-revalidation-report-"));
		try {
			const run = {
				schemaVersion: 1,
				commit: "fixture",
				timestamp: "2026-08-24T00:00:00.000Z",
				host,
				arms,
				repetitions: 1,
				warmupCount: 2,
				armOrderByRepetition: [["vitest", "bun-test"]],
				samples: [],
				aggregates: { vitest: null, "bun-test": null },
				inventory: {
					ok: true,
					valid: true,
					reasons: [],
					reference: [],
					candidate: [],
					missingFiles: [],
					extraFiles: [],
					dispositions: [],
				},
				validComparison: false,
				invalidReasons: ["fixture contamination"],
			} satisfies RevalidationRun;
			const first = await writeRevalidationReport(run, root);
			const second = await writeRevalidationReport(run, root);
			expect(first.jsonPath).not.toBe(second.jsonPath);
			expect(await readRevalidationReport(first.jsonPath)).toMatchObject({
				validComparison: false,
				invalidReasons: ["fixture contamination"],
			});
			expect(renderRevalidationMarkdown(run)).toContain("Warmups discarded: 2");
			expect(renderRevalidationMarkdown(run)).toContain(
				"No performance winner is reported.",
			);
		} finally {
			await rm(root, { recursive: true, force: true });
		}
	});
});
