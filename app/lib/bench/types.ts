// Result shapes produced by the Bun version benchmark harness.
// Written to docs/benchmarks/bun-1-4/<ISO-date>.json and consumed by the
// report renderer. Types only — behavior lives in the sibling modules.

/** One timed repetition of a workload. */
export type Sample = {
	ms: number;
	peakRssBytes: number;
	exitCode: number;
};

/** Summary of a workload's timed repetitions, warm-up already discarded. */
export type Aggregate = {
	medianMs: number;
	minMs: number;
	maxMs: number;
	medianPeakRssBytes: number;
	sampleCount: number;
};

/** Everything measured for one workload under one Bun version. */
export type WorkloadResult = {
	id: string;
	version: string;
	samples: Sample[];
	/** null when every repetition failed, so no honest aggregate exists. */
	aggregate: Aggregate | null;
	extra?: Record<string, unknown>;
};

/** Non-2xx responses seen during the load phase, grouped by route + status. */
export type NonOkResponse = {
	route: string;
	status: number;
	count: number;
};

/** Latency percentiles in milliseconds. */
export type Latency = {
	p50: number;
	p95: number;
	p99: number;
};

/** Result of the load phase alone, independent of how the server was booted. */
export type LoadResult = {
	latency: Latency;
	totalRequests: number;
	nonOk: NonOkResponse[];
};

/** Boot, memory and latency of the production bundle under one Bun version. */
export type RuntimeResult = {
	version: string;
	bootMs: number;
	idleRssBytes: number;
	peakRssBytes: number;
	postLoadRssBytes: number;
	latency: Latency;
	totalRequests: number;
	nonOk: NonOkResponse[];
};

/**
 * A workload that did not produce numbers. `compat` means it exited non-zero,
 * `timeout` means it was killed after exceeding the per-repetition limit.
 * Both are results worth publishing, not reasons to abort the matrix.
 */
export type Finding = {
	kind: "compat" | "timeout";
	version: string;
	workloadId: string;
	exitCode: number | null;
	stderrTail: string;
};

export type PowerSource = "ac" | "battery" | "unknown";

/** Machine provenance, so a result file stays interpretable months later. */
export type HostMeta = {
	host: string;
	cpuModel: string;
	cores: number;
	totalMemBytes: number;
	loadAvg1: number;
	powerSource: PowerSource;
	startedAt: string;
};

export type RunResult = {
	schemaVersion: 1;
	host: HostMeta;
	versions: string[];
	workloads: WorkloadResult[];
	runtime: RuntimeResult[];
	findings: Finding[];
};
