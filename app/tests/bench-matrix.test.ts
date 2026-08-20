import { homedir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type { MeasuredRun, RunDeps } from "#/lib/bench/runner.server";
import {
	resolvePreparePath,
	restoreNodeModules,
	runMatrix,
	runWorkload,
} from "#/lib/bench/runner.server";
import type { PrepareStep, Workload } from "#/lib/bench/workloads";

const CWD = "/repo";

function measured(over: Partial<MeasuredRun> = {}): MeasuredRun {
	return {
		ms: 100,
		peakRssBytes: 1024,
		exitCode: 0,
		stdout: "",
		stderrTail: "",
		timedOut: false,
		pgid: 1,
		...over,
	};
}

type Call = { argv: string[] };

function stubDeps(
	responses: (call: number) => MeasuredRun,
): RunDeps & { calls: Call[]; prepared: PrepareStep[][] } {
	const calls: Call[] = [];
	const prepared: PrepareStep[][] = [];
	return {
		calls,
		prepared,
		spawn: async (argv) => {
			calls.push({ argv });
			return responses(calls.length - 1);
		},
		prepare: async (steps) => {
			prepared.push(steps);
		},
	};
}

const LINT: Workload = {
	id: "lint",
	argv: ["bun", "run", "lint"],
	reps: 3,
	needsDb: false,
	needsBundle: false,
	prepare: [],
};

describe("bench prepare steps", () => {
	it("never resolves a prepare path into the developer's global bun install", () => {
		const steps: PrepareStep[] = [
			"rm-node-modules",
			"rm-install-cache",
			"rm-output",
			"rm-vite-cache",
		];
		const globalBun = join(homedir(), ".bun");
		for (const step of steps) {
			expect(resolvePreparePath(step, "1.4.0", CWD)).not.toContain(globalBun);
		}
	});

	it("confines every prepare path to the repo or the .bench workspace", () => {
		expect(resolvePreparePath("rm-node-modules", "1.4.0", CWD)).toBe(
			join(CWD, "node_modules"),
		);
		expect(resolvePreparePath("rm-output", "1.4.0", CWD)).toBe(
			join(CWD, ".output"),
		);
		expect(resolvePreparePath("rm-vite-cache", "1.4.0", CWD)).toBe(
			join(CWD, "node_modules", ".vite"),
		);
		expect(resolvePreparePath("rm-install-cache", "1.4.0", CWD)).toBe(
			join(CWD, ".bench", "bun-1.4.0", "install", "cache"),
		);
	});
});

describe("bench workload execution", () => {
	it("discards the first repetition as warm-up", async () => {
		const deps = stubDeps(() => measured());
		const { result } = await runWorkload(LINT, "1.4.0", CWD, deps);
		expect(deps.calls).toHaveLength(4); // 1 warm-up + 3 timed
		expect(result.aggregate?.sampleCount).toBe(3);
	});

	it("aggregates only the timed repetitions", async () => {
		const times = [9999, 10, 20, 30];
		const deps = stubDeps((i) => measured({ ms: times[i] }));
		const { result } = await runWorkload(LINT, "1.4.0", CWD, deps);
		expect(result.aggregate?.medianMs).toBe(20);
		expect(result.aggregate?.maxMs).toBe(30);
	});

	it("records a compat finding on a non-zero exit and stops that workload", async () => {
		const deps = stubDeps((i) =>
			i === 0 ? measured() : measured({ exitCode: 2, stderrTail: "boom" }),
		);
		const { result, findings } = await runWorkload(LINT, "1.4.0", CWD, deps);
		expect(findings).toHaveLength(1);
		expect(findings[0].kind).toBe("compat");
		expect(findings[0].exitCode).toBe(2);
		expect(findings[0].stderrTail).toBe("boom");
		expect(result.aggregate).toBeNull();
	});

	it("records a timeout finding with a null exit code", async () => {
		const deps = stubDeps(() => measured({ timedOut: true, exitCode: -1 }));
		const { findings } = await runWorkload(LINT, "1.4.0", CWD, deps);
		expect(findings[0].kind).toBe("timeout");
		expect(findings[0].exitCode).toBeNull();
	});

	it("builds the bundle first for a bundle-dependent workload and excludes it from the samples", async () => {
		const e2e: Workload = { ...LINT, id: "test-e2e", needsBundle: true };
		const deps = stubDeps(() => measured());
		const { result } = await runWorkload(e2e, "1.4.0", CWD, deps);
		expect(deps.calls[0].argv).toEqual(["bun", "run", "build"]);
		expect(deps.calls).toHaveLength(5); // build + warm-up + 3 timed
		expect(result.aggregate?.sampleCount).toBe(3);
	});

	it("applies the workload's prepare steps before every repetition", async () => {
		const build: Workload = {
			...LINT,
			id: "build",
			prepare: ["rm-output", "rm-vite-cache"],
		};
		const deps = stubDeps(() => measured());
		await runWorkload(build, "1.4.0", CWD, deps);
		expect(deps.prepared).toHaveLength(4);
		expect(deps.prepared[0]).toEqual(["rm-output", "rm-vite-cache"]);
	});

	it("stores parsed extras from the last successful repetition", async () => {
		const e2e: Workload = {
			...LINT,
			id: "test-e2e",
			parseExtra: (stdout) => ({ passed: Number(stdout) }),
		};
		const deps = stubDeps((i) => measured({ stdout: String(i) }));
		const { result } = await runWorkload(e2e, "1.4.0", CWD, deps);
		expect(result.extra).toEqual({ passed: 3 });
	});
});

describe("bench matrix", () => {
	it("covers every version and workload pair", async () => {
		const deps = stubDeps(() => measured());
		const acc = await runMatrix(
			["1.3.14", "1.4.0"],
			[LINT, { ...LINT, id: "check" }],
			CWD,
			async () => {},
			deps,
		);
		expect(acc.workloads.map((w) => `${w.version}/${w.id}`)).toEqual([
			"1.3.14/lint",
			"1.3.14/check",
			"1.4.0/lint",
			"1.4.0/check",
		]);
	});

	it("flushes partial results after every workload so an interrupt keeps data", async () => {
		const deps = stubDeps(() => measured());
		const flushes: number[] = [];
		await runMatrix(
			["1.4.0"],
			[LINT, { ...LINT, id: "check" }],
			CWD,
			async (partial) => {
				flushes.push(partial.workloads.length);
			},
			deps,
		);
		expect(flushes).toEqual([1, 2]);
	});

	it("continues to the next workload after a failure", async () => {
		const deps = stubDeps((i) =>
			i < 1 ? measured({ exitCode: 1 }) : measured(),
		);
		const acc = await runMatrix(
			["1.4.0"],
			[LINT, { ...LINT, id: "check" }],
			CWD,
			async () => {},
			deps,
		);
		expect(acc.workloads).toHaveLength(2);
		expect(acc.findings).toHaveLength(1);
		expect(acc.workloads[1].aggregate?.sampleCount).toBe(3);
	});
});

describe("bench restore", () => {
	it("reinstalls with the developer's default bun binary", async () => {
		const deps = stubDeps(() => measured());
		await restoreNodeModules("/usr/local/bin/bun", CWD, deps);
		expect(deps.calls[0].argv).toEqual([
			"/usr/local/bin/bun",
			"install",
			"--frozen-lockfile",
		]);
	});
});
