import "@tanstack/react-start/server-only";
import { spawn } from "node:child_process";
import { performance } from "node:perf_hooks";
import { portOwner, RUNTIME_PORT } from "#/lib/bench/preflight.server";
import {
	groupRssBytes,
	killGroup,
	RSS_SAMPLE_INTERVAL_MS,
} from "#/lib/bench/runner.server";
import { percentile } from "#/lib/bench/stats";
import type {
	LoadResult,
	NonOkResponse,
	RuntimeResult,
} from "#/lib/bench/types";
import { toolchainFor } from "#/lib/bench/versions";

/** Fixed load shape, identical for every version so the client never becomes
 * part of the comparison. */
export const LOAD_CONCURRENCY = 20;
export const LOAD_DURATION_MS = 30_000;

export type LoadOpts = {
	concurrency: number;
	durationMs: number;
};

function groupNonOk(raw: { route: string; status: number }[]): NonOkResponse[] {
	const counts = new Map<string, NonOkResponse>();
	for (const { route, status } of raw) {
		const key = `${route}|${status}`;
		const existing = counts.get(key);
		if (existing) existing.count += 1;
		else counts.set(key, { route, status, count: 1 });
	}
	return [...counts.values()];
}

/**
 * Issues requests round-robin across `routes` at fixed concurrency for a fixed
 * duration. Duration-bounded rather than count-bounded so a slower server does
 * proportionally less work instead of taking proportionally longer.
 *
 * Non-2xx responses are counted, never discarded: a version that answers fast
 * because it is erroring must not look like a version that answers fast.
 */
export async function generateLoad(
	baseUrl: string,
	routes: string[],
	opts: LoadOpts,
): Promise<LoadResult> {
	if (routes.length === 0) {
		return { latency: { p50: 0, p95: 0, p99: 0 }, totalRequests: 0, nonOk: [] };
	}

	const durations: number[] = [];
	const failures: { route: string; status: number }[] = [];
	const deadline = performance.now() + opts.durationMs;
	let cursor = 0;

	async function worker(): Promise<void> {
		while (performance.now() < deadline) {
			const route = routes[cursor % routes.length];
			cursor += 1;
			const started = performance.now();
			try {
				const response = await fetch(`${baseUrl}${route}`);
				await response.arrayBuffer();
				durations.push(performance.now() - started);
				if (!response.ok) {
					failures.push({ route, status: response.status });
				}
			} catch {
				durations.push(performance.now() - started);
				failures.push({ route, status: 0 });
			}
		}
	}

	await Promise.all(Array.from({ length: opts.concurrency }, () => worker()));

	const sorted = [...durations].sort((a, b) => a - b);
	return {
		latency: {
			p50: percentile(sorted, 50),
			p95: percentile(sorted, 95),
			p99: percentile(sorted, 99),
		},
		totalRequests: durations.length,
		nonOk: groupNonOk(failures),
	};
}

/** How long to wait for the server to answer before giving up on the boot. */
export const BOOT_TIMEOUT_MS = 30_000;
const BOOT_POLL_INTERVAL_MS = 50;

/** Settle window before idle RSS is read, and cooldown before post-load RSS. */
export const SETTLE_MS = 3_000;
export const COOLDOWN_MS = 10_000;

const PORT_FREE_TIMEOUT_MS = 10_000;
/** Grace between SIGTERM and SIGKILL when shutting the server down. */
const SHUTDOWN_GRACE_MS = 5_000;

export type RuntimeOpts = {
	version: string;
	routes: string[];
	cwd: string;
	port?: number;
	/** Overridable so tests can drive a stub server instead of the real bundle. */
	command?: string[];
	env?: NodeJS.ProcessEnv;
	load?: LoadOpts;
	settleMs?: number;
	cooldownMs?: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function waitForBoot(baseUrl: string): Promise<number | null> {
	const started = performance.now();
	while (performance.now() - started < BOOT_TIMEOUT_MS) {
		try {
			const response = await fetch(baseUrl, { redirect: "manual" });
			await response.arrayBuffer();
			if (response.status < 400) return performance.now() - started;
		} catch {
			// not listening yet
		}
		await sleep(BOOT_POLL_INTERVAL_MS);
	}
	return null;
}

async function waitForPortFree(port: number): Promise<void> {
	const started = performance.now();
	while (performance.now() - started < PORT_FREE_TIMEOUT_MS) {
		if ((await portOwner(port)) === null) return;
		await sleep(BOOT_POLL_INTERVAL_MS);
	}
}

/**
 * Boots the production bundle under one Bun version and measures what a reader
 * feels: how long it takes to answer, how much memory it holds at rest and
 * under load, and how fast it responds while loaded.
 *
 * Every version gets the identical environment, load shape and database state,
 * so the only variable is the runtime itself.
 */
export async function measureRuntime(
	opts: RuntimeOpts,
): Promise<RuntimeResult> {
	const port = opts.port ?? RUNTIME_PORT;
	const baseUrl = `http://127.0.0.1:${port}`;
	const command = opts.command ?? [
		toolchainFor(opts.version, opts.cwd).binary,
		"run",
		".output/server/index.mjs",
	];
	const env = {
		...(opts.env ?? process.env),
		PORT: String(port),
		SITE_URL: baseUrl,
		BETTER_AUTH_URL: baseUrl,
	};

	const child = spawn(command[0], command.slice(1), {
		detached: true,
		cwd: opts.cwd,
		env,
		stdio: ["ignore", "ignore", "ignore"],
	});
	const pgid = child.pid ?? 0;
	// Authoritative shutdown signal. Polling lsof is not: it cannot tell "no
	// owner" from "could not ask", and treating the second as free let a
	// previous version's server answer the next version's boot probe.
	const exited = new Promise<void>((resolve) => {
		child.on("close", () => resolve());
		child.on("error", () => resolve());
	});

	try {
		const bootMs = await waitForBoot(baseUrl);
		if (bootMs === null) {
			throw new Error(
				`server under bun ${opts.version} did not answer on ${baseUrl} within ${BOOT_TIMEOUT_MS}ms`,
			);
		}

		await sleep(opts.settleMs ?? SETTLE_MS);
		const idleRssBytes = await groupRssBytes(pgid);

		let peakRssBytes = idleRssBytes;
		let sampling = false;
		const sampler = setInterval(() => {
			if (sampling) return;
			sampling = true;
			groupRssBytes(pgid)
				.then((bytes) => {
					if (bytes > peakRssBytes) peakRssBytes = bytes;
				})
				.finally(() => {
					sampling = false;
				});
		}, RSS_SAMPLE_INTERVAL_MS);

		const load = await generateLoad(
			baseUrl,
			opts.routes,
			opts.load ?? {
				concurrency: LOAD_CONCURRENCY,
				durationMs: LOAD_DURATION_MS,
			},
		);
		clearInterval(sampler);

		await sleep(opts.cooldownMs ?? COOLDOWN_MS);
		const postLoadRssBytes = await groupRssBytes(pgid);

		return {
			version: opts.version,
			bootMs,
			idleRssBytes,
			peakRssBytes,
			postLoadRssBytes,
			latency: load.latency,
			totalRequests: load.totalRequests,
			nonOk: load.nonOk,
		};
	} finally {
		killGroup(pgid, "SIGTERM");
		const stopped = await Promise.race([
			exited.then(() => true),
			sleep(SHUTDOWN_GRACE_MS).then(() => false),
		]);
		if (!stopped) {
			killGroup(pgid, "SIGKILL");
			await exited;
		}
		await waitForPortFree(port);
	}
}
