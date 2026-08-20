import "@tanstack/react-start/server-only";
import { performance } from "node:perf_hooks";
import { percentile } from "#/lib/bench/stats";
import type { LoadResult, NonOkResponse } from "#/lib/bench/types";

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
