import { describe, expect, it } from "vitest";
import {
	aggregate,
	classifyDelta,
	noiseBand,
	percentile,
} from "#/lib/bench/stats";
import type { Aggregate, Sample } from "#/lib/bench/types";

function samples(times: number[], rss: number[] = []): Sample[] {
	return times.map((ms, i) => ({
		ms,
		peakRssBytes: rss[i] ?? 0,
		exitCode: 0,
		loadAvg1: 1,
	}));
}

function agg(medianMs: number, minMs: number, maxMs: number): Aggregate {
	return {
		medianMs,
		minMs,
		maxMs,
		medianPeakRssBytes: 0,
		sampleCount: 5,
		medianLoadAvg1: 1,
		maxLoadAvg1: 1,
	};
}

describe("bench statistics", () => {
	it("returns null for an empty sample set instead of NaN", () => {
		expect(aggregate([])).toBeNull();
	});

	it("reports median, min, max and sample count over odd counts", () => {
		const result = aggregate(samples([30, 10, 20]));
		expect(result?.medianMs).toBe(20);
		expect(result?.minMs).toBe(10);
		expect(result?.maxMs).toBe(30);
		expect(result?.sampleCount).toBe(3);
	});

	it("averages the two middle values over even counts", () => {
		expect(aggregate(samples([10, 20, 30, 40]))?.medianMs).toBe(25);
	});

	it("reports the median peak RSS independently of the timing order", () => {
		const result = aggregate(samples([30, 10, 20], [300, 100, 200]));
		expect(result?.medianPeakRssBytes).toBe(200);
	});

	it("summarises the load each repetition ran under", () => {
		// Without this the report cannot show whether two versions were
		// measured under comparable conditions, which is the whole substitute
		// for refusing to run on a busy machine.
		const result = aggregate([
			{ ms: 10, peakRssBytes: 0, exitCode: 0, loadAvg1: 2 },
			{ ms: 20, peakRssBytes: 0, exitCode: 0, loadAvg1: 14 },
			{ ms: 30, peakRssBytes: 0, exitCode: 0, loadAvg1: 6 },
		]);
		expect(result?.medianLoadAvg1).toBe(6);
		expect(result?.maxLoadAvg1).toBe(14);
	});

	it("computes p50, p95 and p99 by nearest rank on an odd-length set", () => {
		const sorted = [1, 2, 3, 4, 5];
		expect(percentile(sorted, 50)).toBe(3);
		expect(percentile(sorted, 95)).toBe(5);
		expect(percentile(sorted, 99)).toBe(5);
	});

	it("computes p50, p95 and p99 by nearest rank on an even-length set", () => {
		const sorted = [1, 2, 3, 4];
		expect(percentile(sorted, 50)).toBe(2);
		expect(percentile(sorted, 95)).toBe(4);
		expect(percentile(sorted, 99)).toBe(4);
	});

	it("returns zero latency when no request was recorded", () => {
		expect(percentile([], 95)).toBe(0);
	});

	it("takes the noise band as the wider of the two min-to-max spreads", () => {
		expect(noiseBand(agg(100, 95, 105), agg(50, 30, 70))).toBe(40);
	});

	it("renders a known 2x improvement as -50%", () => {
		const delta = classifyDelta(agg(100, 99, 101), agg(50, 49, 51));
		expect(delta.deltaPct).toBe(-50);
		expect(delta.deltaMs).toBe(-50);
		expect(delta.verdict).toBe("faster");
	});

	it("never reports a delta smaller than the noise band as an improvement", () => {
		const delta = classifyDelta(agg(100, 80, 120), agg(95, 85, 115));
		expect(delta.verdict).toBe("within-noise");
	});

	it("reports a regression larger than the noise band as slower", () => {
		const delta = classifyDelta(agg(100, 99, 101), agg(140, 139, 141));
		expect(delta.verdict).toBe("slower");
		expect(delta.deltaMs).toBe(40);
	});

	it("treats a delta exactly equal to the noise band as within noise", () => {
		const delta = classifyDelta(agg(100, 90, 110), agg(80, 75, 85));
		expect(noiseBand(agg(100, 90, 110), agg(80, 75, 85))).toBe(20);
		expect(delta.verdict).toBe("within-noise");
	});

	it("avoids dividing by zero when the baseline median is zero", () => {
		expect(classifyDelta(agg(0, 0, 0), agg(10, 10, 10)).deltaPct).toBe(0);
	});
});
