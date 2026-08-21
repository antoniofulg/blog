import "@tanstack/react-start/server-only";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { RSS_SAMPLE_INTERVAL_MS } from "#/lib/bench/runner.server";
import { classifyDelta } from "#/lib/bench/stats";
import type { Aggregate, RunResult, RuntimeResult } from "#/lib/bench/types";

export function formatMs(ms: number): string {
	return ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(0)} ms`;
}

export function formatBytes(bytes: number): string {
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function aggregateFor(
	run: RunResult,
	id: string,
	version: string,
): Aggregate | null {
	return (
		run.workloads.find((w) => w.id === id && w.version === version)
			?.aggregate ?? null
	);
}

function workloadIds(run: RunResult): string[] {
	const seen: string[] = [];
	for (const w of run.workloads) if (!seen.includes(w.id)) seen.push(w.id);
	return seen;
}

function rssDeltaPct(a: Aggregate, b: Aggregate): string {
	if (a.medianPeakRssBytes === 0) return "n/a";
	const pct =
		((b.medianPeakRssBytes - a.medianPeakRssBytes) / a.medianPeakRssBytes) *
		100;
	return `${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%`;
}

function comparisonTable(
	run: RunResult,
	before: string,
	after: string,
): string {
	const rows = workloadIds(run).map((id) => {
		const a = aggregateFor(run, id, before);
		const b = aggregateFor(run, id, after);
		if (!a || !b) {
			return `| \`${id}\` | ${a ? formatMs(a.medianMs) : "n/a"} | ${b ? formatMs(b.medianMs) : "n/a"} | n/a | no result | n/a | n/a | n/a | n/a |`;
		}
		const delta = classifyDelta(a, b);
		const pct = `${delta.deltaPct >= 0 ? "+" : ""}${delta.deltaPct.toFixed(1)}%`;
		const verdict =
			delta.verdict === "within-noise" ? "within noise" : delta.verdict;
		const load = `${a.medianLoadAvg1.toFixed(1)} / ${b.medianLoadAvg1.toFixed(1)}`;
		return `| \`${id}\` | ${formatMs(a.medianMs)} | ${formatMs(b.medianMs)} | ${pct} | ${verdict} | ${formatBytes(a.medianPeakRssBytes)} | ${formatBytes(b.medianPeakRssBytes)} | ${rssDeltaPct(a, b)} | ${load} |`;
	});
	return [
		`| Workload | ${before} median | ${after} median | Time % | Verdict | ${before} peak RSS | ${after} peak RSS | RSS % | Load ${before} / ${after} |`,
		"| -------- | -------------- | ------------- | ------ | ------- | ---------------- | --------------- | ----- | ---- |",
		...rows,
	].join("\n");
}

function singleVersionTable(run: RunResult, version: string): string {
	const rows = workloadIds(run).map((id) => {
		const a = aggregateFor(run, id, version);
		return a
			? `| \`${id}\` | ${formatMs(a.medianMs)} | ${formatMs(a.minMs)} | ${formatMs(a.maxMs)} | ${formatBytes(a.medianPeakRssBytes)} |`
			: `| \`${id}\` | n/a | n/a | n/a | n/a |`;
	});
	return [
		"| Workload | Median | Min | Max | Median peak RSS |",
		"| -------- | ------ | --- | --- | --------------- |",
		...rows,
	].join("\n");
}

function runtimeTable(runtime: RuntimeResult[]): string {
	const rows = runtime.map(
		(r) =>
			`| ${r.version} | ${formatMs(r.bootMs)} | ${formatBytes(r.idleRssBytes)} | ${formatBytes(r.peakRssBytes)} | ${formatBytes(r.postLoadRssBytes)} | ${formatMs(r.latency.p50)} | ${formatMs(r.latency.p95)} | ${formatMs(r.latency.p99)} | ${r.totalRequests} |`,
	);
	return [
		"| Version | Boot | Idle RSS | Peak RSS | Post-load RSS | p50 | p95 | p99 | Requests |",
		"| ------- | ---- | -------- | -------- | ------------- | --- | --- | --- | -------- |",
		...rows,
	].join("\n");
}

/**
 * Renders a result file as markdown. Pure so it can be checked against a
 * fixture, and so `--report-only` can re-render an old run without measuring.
 */
export function renderReport(run: RunResult): string {
	const [before, after] = run.versions;
	const parts: string[] = [
		`# Bun ${run.versions.join(" vs ")} — benchmark report`,
		"",
		`Run started ${run.host.startedAt} on ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores, ${formatBytes(run.host.totalMemBytes)} RAM, power: ${run.host.powerSource}, 1-min load at start: ${run.host.loadAvg1.toFixed(2)}).`,
		"",
		"Medians over the timed repetitions, warm-up discarded. A delta smaller than the run's own min-to-max spread is reported as `within noise` and must not be quoted as an improvement. The noise band is computed from timings only, so the RSS columns carry no verdict: read a small memory delta as unresolved, not as change. The last column is the median 1-minute load average each side was measured under: when the two differ much, the row is comparing conditions as well as versions.",
		"",
		"## Workloads",
		"",
	];

	if (run.versions.length < 2) {
		parts.push(
			singleVersionTable(run, before ?? "unknown"),
			"",
			"Only one version was measured, so no comparison is available.",
			"",
		);
	} else {
		parts.push(comparisonTable(run, before, after), "");
	}

	if (run.runtime.length > 0) {
		parts.push(
			"## Runtime (production bundle)",
			"",
			runtimeTable(run.runtime),
			"",
			`Resident memory is sampled every ${RSS_SAMPLE_INTERVAL_MS} ms, so peaks shorter than that are missed. The bias is identical for both versions.`,
			"",
		);
	}

	parts.push("## Findings", "");
	if (run.findings.length === 0) {
		parts.push("None — every workload completed under every version.", "");
	} else {
		parts.push(
			"| Workload | Version | Kind | Exit code | Failed reps |",
			"| -------- | ------- | ---- | --------- | ----------- |",
			...run.findings.map((f) => {
				const ratio =
					f.failedAttempts !== undefined && f.totalAttempts !== undefined
						? `${f.failedAttempts} of ${f.totalAttempts}`
						: "unknown";
				return `| \`${f.workloadId}\` | ${f.version} | ${f.kind} | ${f.exitCode ?? "killed"} | ${ratio} |`;
			}),
			"",
			"A workload that fails a few of its repetitions is flaky; one that fails all of them is incompatible. The ratio is what separates them — a bare failure count cannot.",
			"",
		);
		for (const f of run.findings) {
			parts.push(
				`### \`${f.workloadId}\` under ${f.version} (${f.kind})`,
				"",
				"```",
				f.stdoutTail?.trim() ? f.stdoutTail : f.stderrTail,
				"```",
				"",
			);
		}
	}

	return parts.join("\n");
}

export async function writeReport(
	run: RunResult,
	dir: string,
): Promise<string> {
	await mkdir(dir, { recursive: true });
	const path = join(dir, "REPORT.md");
	await writeFile(path, renderReport(run), "utf-8");
	return path;
}
