import { mkdir, open, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { aggregate, classifyDelta } from "#/lib/bench/stats";
import type { Sample } from "#/lib/bench/types";
import type { TestArmSample, TestComparisonRun } from "#/lib/test-bench/types";

export const TEST_BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/bun-test",
);

function samplesForArm(run: TestComparisonRun, arm: string): TestArmSample[] {
	return run.samples.filter((sample) => sample.arm === arm);
}

function aggregateForArm(
	run: TestComparisonRun,
	arm: string,
): ReturnType<typeof aggregate> {
	const samples: Sample[] = samplesForArm(run, arm).map((sample) => ({
		ms: sample.durationMs,
		peakRssBytes: sample.peakRssBytes,
		exitCode: sample.exitCode ?? -1,
		loadAvg1: sample.loadAvg1,
	}));
	return aggregate(samples);
}

function bytes(value: number): string {
	return `${Math.round(value / (1024 * 1024))} MiB`;
}

function armMarkdown(run: TestComparisonRun, arm: "A" | "B" | "C"): string {
	const sample = samplesForArm(run, arm)[0];
	const aggregateResult = aggregateForArm(run, arm);
	if (!sample || !aggregateResult) return `- ${arm}: no timed samples`;
	const outcome = sample.outcome;
	const provenance = sample.provenance;
	return [
		`- ${arm}: median ${aggregateResult.medianMs.toFixed(2)} ms, RSS ${bytes(aggregateResult.medianPeakRssBytes)}, load ${aggregateResult.medianLoadAvg1.toFixed(2)}`,
		`  - provenance: ${provenance.runtime} ${provenance.runtimeVersion}, ${provenance.runner} ${provenance.runnerVersion}, executable \`${provenance.execPath}\``,
		`  - outcomes: ${outcome ? `${outcome.testsPassed} passed, ${outcome.testsFailed} failed, ${outcome.testsSkipped} skipped across ${outcome.testFileCount} files` : "missing"}`,
	].join("\n");
}

function deltaMarkdown(
	run: TestComparisonRun,
	before: "A" | "B" | "C",
	after: "A" | "B" | "C",
): string {
	const beforeAggregate = aggregateForArm(run, before);
	const afterAggregate = aggregateForArm(run, after);
	if (!beforeAggregate || !afterAggregate)
		return `- ${before} → ${after}: unavailable`;
	const delta = classifyDelta(beforeAggregate, afterAggregate);
	return `- ${before} → ${after}: ${delta.deltaMs.toFixed(2)} ms (${delta.deltaPct.toFixed(2)}%), ${delta.verdict}`;
}

export function renderTestComparison(run: TestComparisonRun): string {
	const lines = [
		"# Bun Test A/B/C comparison",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`,
		"",
	];
	if (!run.validComparison) {
		lines.push("## Comparison invalid", "");
		for (const reason of run.invalidReasons) lines.push(`- ${reason}`);
		lines.push("", "No performance conclusion is reported.");
		return `${lines.join("\n")}\n`;
	}

	lines.push(
		"## Measurements",
		"",
		armMarkdown(run, "A"),
		armMarkdown(run, "B"),
		armMarkdown(run, "C"),
		"",
		"## Deltas",
		"",
		deltaMarkdown(run, "A", "B"),
		deltaMarkdown(run, "B", "C"),
		"",
		"A = Vitest on Node 24. B = Vitest on Bun 1.4.0. C = Bun Test on Bun 1.4.0.",
		"",
	);
	return `${lines.join("\n")}\n`;
}

async function reserveStem(dir: string, timestamp: string): Promise<string> {
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `comparison-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		const jsonPath = join(dir, `${stem}.json`);
		try {
			const handle = await open(jsonPath, "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve a unique comparison report name");
}

export async function writeTestComparison(
	run: TestComparisonRun,
	dir = TEST_BENCHMARK_DIR,
): Promise<{ jsonPath: string; markdownPath: string }> {
	await mkdir(dir, { recursive: true });
	const stem = await reserveStem(dir, run.timestamp);
	const jsonPath = join(dir, `${stem}.json`);
	const markdownPath = join(dir, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, renderTestComparison(run), "utf8");
	return { jsonPath, markdownPath };
}

export async function readTestComparison(
	path: string,
): Promise<TestComparisonRun> {
	return JSON.parse(await readFile(path, "utf8")) as TestComparisonRun;
}
