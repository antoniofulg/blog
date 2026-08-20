import "@tanstack/react-start/server-only";
import { execFile, spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import type { Sample } from "#/lib/bench/types";

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
