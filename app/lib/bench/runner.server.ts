import "@tanstack/react-start/server-only";
import { execFile, spawn } from "node:child_process";
import { rm } from "node:fs/promises";
import { loadavg } from "node:os";
import { join } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { aggregate } from "#/lib/bench/stats";
import type {
	Finding,
	RunResult,
	Sample,
	WorkloadResult,
} from "#/lib/bench/types";
import { envFor, toolchainFor } from "#/lib/bench/versions";
import type { PrepareStep, Workload } from "#/lib/bench/workloads";

const run = promisify(execFile);

/** How often the RSS sampler polls. Coarser than a spike, and symmetric
 * across versions, so the comparison stays valid even though peaks below this
 * granularity are missed. Documented in the report and in the post. */
export const RSS_SAMPLE_INTERVAL_MS = 100;

const STDERR_TAIL_LINES = 20;

export type MeasuredRun = Sample & {
	stdout: string;
	stderrTail: string;
	timedOut: boolean;
	/** Process-group id the command ran in, so a caller can prove it is gone. */
	pgid: number;
};

export function tailLines(text: string, lines = STDERR_TAIL_LINES): string {
	return text.split("\n").slice(-lines).join("\n");
}

/**
 * Total resident memory of a process group, in bytes. `ps -g <pgid>` lists the
 * leader and every descendant that stayed in the group, which is what a
 * spawn with `detached: true` guarantees. Returns 0 once the group is gone.
 */
export async function groupRssBytes(pgid: number): Promise<number> {
	try {
		const { stdout } = await run("ps", ["-o", "rss=", "-g", String(pgid)]);
		return stdout
			.split("\n")
			.map((line) => Number.parseInt(line.trim(), 10))
			.filter((kb) => Number.isFinite(kb))
			.reduce((total, kb) => total + kb * 1024, 0);
	} catch {
		return 0;
	}
}

/**
 * Runs one command in its own process group and measures wall time and peak
 * resident memory of the whole tree. A non-zero exit is returned as data, not
 * thrown: a workload failing under one Bun version is a result worth keeping.
 */
export async function spawnMeasured(
	argv: string[],
	env: NodeJS.ProcessEnv,
	opts: { timeoutMs: number; cwd?: string },
): Promise<MeasuredRun> {
	const started = performance.now();
	const loadAvg1 = loadavg()[0];
	const child = spawn(argv[0], argv.slice(1), {
		detached: true,
		env,
		cwd: opts.cwd,
		stdio: ["ignore", "pipe", "pipe"],
	});
	const pgid = child.pid ?? 0;

	let stdout = "";
	let stderr = "";
	child.stdout?.on("data", (chunk) => {
		stdout += String(chunk);
	});
	child.stderr?.on("data", (chunk) => {
		stderr += String(chunk);
	});

	let peakRssBytes = 0;
	let sampling = false;
	const sampler = setInterval(() => {
		if (sampling || pgid === 0) return;
		sampling = true;
		groupRssBytes(pgid)
			.then((bytes) => {
				if (bytes > peakRssBytes) peakRssBytes = bytes;
			})
			.finally(() => {
				sampling = false;
			});
	}, RSS_SAMPLE_INTERVAL_MS);

	let timedOut = false;
	const timer = setTimeout(() => {
		timedOut = true;
		killGroup(pgid, "SIGKILL");
	}, opts.timeoutMs);

	const exitCode = await new Promise<number>((resolve) => {
		child.on("error", () => resolve(-1));
		child.on("close", (code, signal) => resolve(code ?? (signal ? -1 : 0)));
	});

	clearInterval(sampler);
	clearTimeout(timer);

	return {
		ms: performance.now() - started,
		peakRssBytes,
		exitCode,
		loadAvg1,
		stdout,
		stderrTail: tailLines(stderr),
		timedOut,
		pgid,
	};
}

/** Signals a whole process group, tolerating a group that already exited. */
export function killGroup(pgid: number, signal: NodeJS.Signals): void {
	if (pgid === 0) return;
	try {
		process.kill(-pgid, signal);
	} catch {
		// group already gone
	}
}

/** Per-repetition ceiling. A workload past this is a finding, not a number. */
export const WORKLOAD_TIMEOUT_MS = 15 * 60 * 1000;

/**
 * The single path a prepare step is allowed to delete. Keeping this a pure
 * lookup is what makes "no prepare step can reach the global ~/.bun" a
 * testable property rather than a code-review promise.
 */
export function resolvePreparePath(
	step: PrepareStep,
	version: string,
	cwd: string,
): string {
	switch (step) {
		case "rm-node-modules":
			return join(cwd, "node_modules");
		case "rm-install-cache":
			return toolchainFor(version, cwd).cacheDir;
		case "rm-output":
			return join(cwd, ".output");
		case "rm-vite-cache":
			return join(cwd, "node_modules", ".vite");
	}
}

export async function applyPrepare(
	steps: PrepareStep[],
	version: string,
	cwd: string,
): Promise<void> {
	for (const step of steps) {
		await rm(resolvePreparePath(step, version, cwd), {
			recursive: true,
			force: true,
		});
	}
}

export type RunDeps = {
	spawn: (
		argv: string[],
		env: NodeJS.ProcessEnv,
		opts: { timeoutMs: number; cwd?: string },
	) => Promise<MeasuredRun>;
	prepare: (
		steps: PrepareStep[],
		version: string,
		cwd: string,
	) => Promise<void>;
};

export const defaultRunDeps: RunDeps = {
	spawn: spawnMeasured,
	prepare: applyPrepare,
};

function findingFor(
	workloadId: string,
	version: string,
	run: MeasuredRun,
): Finding {
	return {
		kind: run.timedOut ? "timeout" : "compat",
		version,
		workloadId,
		exitCode: run.timedOut ? null : run.exitCode,
		stderrTail: run.stderrTail,
		stdoutTail: tailLines(run.stdout, 30),
	};
}

/**
 * Runs one workload under one version: an optional preparatory build, one
 * discarded warm-up, then the timed repetitions. The first failure ends this
 * workload and becomes a finding; the caller moves on to the next workload.
 */
export async function runWorkload(
	workload: Workload,
	version: string,
	cwd: string,
	deps: RunDeps = defaultRunDeps,
): Promise<{ result: WorkloadResult; findings: Finding[] }> {
	const env = envFor(version, process.env, cwd);
	const opts = { timeoutMs: WORKLOAD_TIMEOUT_MS, cwd };
	const findings: Finding[] = [];
	const samples: Sample[] = [];
	let lastStdout = "";

	if (workload.needsBundle) {
		// Not sampled: the bundle must exist and must have been produced by the
		// version under measurement, but building it is not this measurement.
		await deps.spawn(["bun", "run", "build"], env, opts);
	}

	let attempts = 0;
	let failures = 0;
	let firstFailure: MeasuredRun | undefined;

	for (let i = 0; i <= workload.reps; i++) {
		await deps.prepare(workload.prepare, version, cwd);
		const run = await deps.spawn(workload.argv, env, opts);
		if (i > 0) attempts += 1;
		if (run.timedOut || run.exitCode !== 0) {
			// Keep going. Aborting on the first failure means one flaky
			// repetition erases the whole workload, and a flake then looks
			// exactly like a genuine incompatibility in the report.
			failures += 1;
			firstFailure ??= run;
			continue;
		}
		lastStdout = run.stdout;
		if (i === 0) continue; // warm-up, deliberately discarded
		samples.push({
			ms: run.ms,
			peakRssBytes: run.peakRssBytes,
			exitCode: run.exitCode,
			loadAvg1: run.loadAvg1,
		});
	}

	if (firstFailure) {
		findings.push({
			...findingFor(workload.id, version, firstFailure),
			failedAttempts: failures,
			totalAttempts: workload.reps + 1,
		});
	}

	const result: WorkloadResult = {
		id: workload.id,
		version,
		samples,
		aggregate: aggregate(samples),
		attempts,
		failures,
	};
	if (workload.parseExtra && samples.length > 0) {
		result.extra = workload.parseExtra(lastStdout);
	}
	return { result, findings };
}

export type MatrixRun = Pick<RunResult, "workloads" | "findings">;

/**
 * Installs dependencies with `version`, so a workload that consumes
 * node_modules runs against a tree that version produced. Not measured.
 */
async function installDepsWith(
	version: string,
	cwd: string,
	deps: RunDeps,
): Promise<MeasuredRun> {
	return deps.spawn(
		["bun", "install", "--frozen-lockfile"],
		envFor(version, process.env, cwd),
		{ timeoutMs: WORKLOAD_TIMEOUT_MS, cwd },
	);
}

/**
 * Walks every version x workload pair, flushing to `sink` after each pair so
 * an interrupted run still leaves usable data on disk.
 *
 * Workload-major and counterbalanced: each workload measures both versions
 * back to back, and the version that goes first alternates between workloads.
 * Running all of one version and then all of the other lets any drift in
 * machine conditions over the run — a laptop still settling after boot, a
 * background job starting — land entirely on one side of the comparison. The
 * first run of this harness did exactly that, and produced a 3x throughput gap
 * that was mostly the second version getting the calmer machine.
 */
export async function runMatrix(
	versions: string[],
	workloads: Workload[],
	cwd: string,
	sink: (partial: MatrixRun) => Promise<void>,
	deps: RunDeps = defaultRunDeps,
): Promise<MatrixRun> {
	const acc: MatrixRun = { workloads: [], findings: [] };
	let installedBy: string | null = null;
	for (const [index, workload] of workloads.entries()) {
		const order = index % 2 === 0 ? versions : [...versions].reverse();
		for (const version of order) {
			if (installedBy !== version) {
				const install = await installDepsWith(version, cwd, deps);
				installedBy = version;
				// A failed dependency install would make every later workload
				// fail for a reason that has nothing to do with the workload.
				// Record it rather than letting it surface as mystery failures.
				if (install.timedOut || install.exitCode !== 0) {
					acc.findings.push(findingFor("install-deps", version, install));
				}
			}
			const { result, findings } = await runWorkload(
				workload,
				version,
				cwd,
				deps,
			);
			acc.workloads.push(result);
			acc.findings.push(...findings);
			await sink(acc);
		}
	}
	return acc;
}

/**
 * Puts node_modules back the way the developer had it. The benchmark installs
 * dependencies with whichever version it is measuring, so this runs on every
 * exit path, including SIGINT.
 */
export async function restoreNodeModules(
	defaultBunBinary: string,
	cwd: string,
	deps: RunDeps = defaultRunDeps,
): Promise<MeasuredRun> {
	return deps.spawn(
		[defaultBunBinary, "install", "--frozen-lockfile"],
		process.env,
		{ timeoutMs: WORKLOAD_TIMEOUT_MS, cwd },
	);
}
