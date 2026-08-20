// Every number the report and the post quote passes through here.
// classifyDelta in particular decides whether we claim an improvement, so it
// is provable by test rather than by inspection.
import type { Aggregate, Sample } from "#/lib/bench/types";

function median(sorted: number[]): number {
	if (sorted.length === 0) return 0;
	const mid = Math.floor(sorted.length / 2);
	return sorted.length % 2 === 1
		? sorted[mid]
		: (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Nearest-rank percentile. Chosen over interpolation because the sample counts
 * here are small and an interpolated value is not a value we actually observed.
 * Returns 0 for an empty set — no requests means no latency to report.
 */
export function percentile(sorted: number[], p: number): number {
	if (sorted.length === 0) return 0;
	const rank = Math.ceil((p / 100) * sorted.length);
	const index = Math.min(Math.max(rank, 1), sorted.length) - 1;
	return sorted[index];
}

/**
 * Summarises timed repetitions. Returns null for an empty set rather than a
 * NaN-filled object, so a workload that never produced a sample cannot be
 * mistaken for one that measured zero.
 */
export function aggregate(samples: Sample[]): Aggregate | null {
	if (samples.length === 0) return null;
	const times = samples.map((s) => s.ms).sort((a, b) => a - b);
	const rss = samples.map((s) => s.peakRssBytes).sort((a, b) => a - b);
	return {
		medianMs: median(times),
		minMs: times[0],
		maxMs: times[times.length - 1],
		medianPeakRssBytes: median(rss),
		sampleCount: samples.length,
	};
}

/**
 * The run's own observed noise, taken as the wider of the two versions'
 * min-to-max spreads. A delta smaller than this is not something five samples
 * can distinguish from scheduling jitter.
 */
export function noiseBand(a: Aggregate, b: Aggregate): number {
	return Math.max(a.maxMs - a.minMs, b.maxMs - b.minMs);
}

export type DeltaVerdict = "faster" | "slower" | "within-noise";

export type Delta = {
	deltaMs: number;
	deltaPct: number;
	verdict: DeltaVerdict;
};

/**
 * Compares `after` against `before`. A negative delta means `after` is faster.
 * Anything inside the noise band is reported as within-noise — never as an
 * improvement — because the published post must not claim what five samples
 * cannot support.
 */
export function classifyDelta(before: Aggregate, after: Aggregate): Delta {
	const deltaMs = after.medianMs - before.medianMs;
	const deltaPct =
		before.medianMs === 0 ? 0 : (deltaMs / before.medianMs) * 100;
	const band = noiseBand(before, after);
	const verdict: DeltaVerdict =
		Math.abs(deltaMs) <= band
			? "within-noise"
			: deltaMs < 0
				? "faster"
				: "slower";
	return { deltaMs, deltaPct, verdict };
}
