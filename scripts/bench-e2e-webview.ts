#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collectHostMeta } from "#/lib/bench/host.server";
import {
	spawnMeasured,
	tailLines,
} from "#/lib/bench/runner.server";
import {
	benchmarkOrder,
	buildE2EBenchmarkRun,
	type E2EBenchmarkSample,
	type E2ESmokeArm,
	parseSmokeOutcome,
	renderE2EBenchmark,
	writeE2EBenchmark,
} from "#/lib/e2e-bench";
import { startLocalE2EServer } from "./lib/local-e2e-server";

const exec = promisify(execFile);
const ARM_TIMEOUT_MS = 60_000;

function repetitionsFrom(args: string[]): number {
	let repetitions = 5;
	for (const arg of args) {
		if (!arg.startsWith("--repetitions=")) {
			throw new Error(`Unknown argument: ${arg}`);
		}
		repetitions = Number.parseInt(arg.slice("--repetitions=".length), 10);
	}
	if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 50) {
		throw new Error("--repetitions must be an integer between 1 and 50");
	}
	return repetitions;
}

function commandFor(arm: E2ESmokeArm, baseUrl: string): string[] {
	return [
		"bun",
		"scripts/run-e2e-webview.ts",
		"--external-server",
		`--arm=${arm}`,
		`--base-url=${baseUrl}`,
	];
}

async function warmUp(arm: E2ESmokeArm, baseUrl: string): Promise<void> {
	const run = await spawnMeasured(commandFor(arm, baseUrl), process.env, {
		timeoutMs: ARM_TIMEOUT_MS,
		cwd: process.cwd(),
	});
	const outcome = parseSmokeOutcome(run.stdout);
	if (
		run.timedOut ||
		run.exitCode !== 0 ||
		!outcome ||
		outcome.scenarios.some((scenario) => !scenario.passed)
	) {
		throw new Error(
			`${arm} warm-up failed\n${tailLines(run.stdout, 20)}\n${run.stderrTail}`,
		);
	}
}

async function measuredSample(
	arm: E2ESmokeArm,
	repetition: number,
	baseUrl: string,
): Promise<E2EBenchmarkSample> {
	const run = await spawnMeasured(commandFor(arm, baseUrl), process.env, {
		timeoutMs: ARM_TIMEOUT_MS,
		cwd: process.cwd(),
	});
	const excerpt = [tailLines(run.stdout, 20), run.stderrTail]
		.filter(Boolean)
		.join("\n");
	return {
		arm,
		repetition,
		ms: run.ms,
		peakRssBytes: run.peakRssBytes,
		exitCode: run.exitCode,
		loadAvg1: run.loadAvg1,
		timedOut: run.timedOut,
		outcome: parseSmokeOutcome(run.stdout),
		...(run.exitCode === 0 && !run.timedOut
			? {}
			: { failureExcerpt: excerpt }),
	};
}

async function commit(): Promise<string> {
	try {
		return (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
	} catch {
		return "unknown";
	}
}

async function main(): Promise<void> {
	const repetitions = repetitionsFrom(process.argv.slice(2));
	const server = await startLocalE2EServer({ quiet: true });
	try {
		console.log("Warm-up: Bun + Playwright");
		await warmUp("playwright", server.baseUrl);
		console.log("Warm-up: Bun.WebView");
		await warmUp("webview", server.baseUrl);

		const samples: E2EBenchmarkSample[] = [];
		for (const item of benchmarkOrder(repetitions)) {
			const sample = await measuredSample(
				item.arm,
				item.repetition,
				server.baseUrl,
			);
			samples.push(sample);
			console.log(
				`${item.repetition}/${repetitions} ${item.arm}: ${(sample.ms / 1000).toFixed(2)}s, ${(sample.peakRssBytes / (1024 * 1024)).toFixed(1)} MiB, exit ${sample.exitCode}`,
			);
		}

		const run = buildE2EBenchmarkRun({
			timestamp: new Date().toISOString(),
			commit: await commit(),
			host: await collectHostMeta(),
			repetitions,
			samples,
		});
		const paths = await writeE2EBenchmark(run);
		console.log("");
		console.log(renderE2EBenchmark(run));
		console.log(`JSON: ${paths.jsonPath}`);
		console.log(`Markdown: ${paths.markdownPath}`);
		if (!run.validComparison) process.exitCode = 1;
	} finally {
		await server.stop();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
