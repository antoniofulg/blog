#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collectHostMeta } from "#/lib/bench/host.server";
import {
	type MeasuredRun,
	spawnMeasured,
	tailLines,
} from "#/lib/bench/runner.server";
import {
	benchmarkOrder,
	buildE2EBenchmarkRun,
	type E2EBenchmarkPhase,
	type E2EBenchmarkSample,
	type E2EPassOutcome,
	type E2ESessionOutcome,
	type E2ESessionTotal,
	type E2ESmokeArm,
	type E2ESmokeOutcome,
	parseSessionOutcome,
	parseSmokeOutcome,
	renderE2EBenchmark,
	writeE2EBenchmark,
} from "#/lib/e2e-bench";
import { startLocalE2EServer } from "./lib/local-e2e-server";

const exec = promisify(execFile);
const ARM_TIMEOUT_MS = 120_000;
const WARM_SESSION_COUNT = 2;

function repetitionsFrom(args: string[]): number {
	let repetitions = 5;
	for (const arg of args) {
		if (!arg.startsWith("--repetitions="))
			throw new Error(`Unknown argument: ${arg}`);
		repetitions = Number.parseInt(arg.slice("--repetitions=".length), 10);
	}
	if (!Number.isInteger(repetitions) || repetitions < 1 || repetitions > 50)
		throw new Error("--repetitions must be an integer between 1 and 50");
	return repetitions;
}

function commandFor(
	arm: E2ESmokeArm,
	baseUrl: string,
	sessionPasses?: number,
): string[] {
	return [
		"bun",
		"scripts/run-e2e-webview.ts",
		"--external-server",
		`--arm=${arm}`,
		`--base-url=${baseUrl}`,
		...(sessionPasses === undefined
			? []
			: [`--session-passes=${sessionPasses}`]),
	];
}

async function runArm(
	arm: E2ESmokeArm,
	baseUrl: string,
	sessionPasses?: number,
): Promise<MeasuredRun> {
	return spawnMeasured(
		commandFor(arm, baseUrl, sessionPasses),
		process.env,
		{
			timeoutMs: ARM_TIMEOUT_MS,
			cwd: process.cwd(),
		},
	);
}

function excerpt(run: MeasuredRun): string {
	return [tailLines(run.stdout, 20), run.stderrTail]
		.filter(Boolean)
		.join("\n");
}

function coldSample(
	arm: E2ESmokeArm,
	repetition: number,
	phase: E2EBenchmarkPhase,
	run: MeasuredRun,
): E2EBenchmarkSample {
	return {
		arm,
		repetition,
		phase,
		ms: run.ms,
		peakRssBytes: run.peakRssBytes,
		exitCode: run.exitCode,
		loadAvg1: run.loadAvg1,
		timedOut: run.timedOut,
		outcome: parseSmokeOutcome(run.stdout),
		...(run.exitCode === 0 && !run.timedOut
			? {}
			: { failureExcerpt: excerpt(run) }),
	};
}

function smokeFromPass(
	session: E2ESessionOutcome,
	pass: E2EPassOutcome,
): E2ESmokeOutcome {
	return {
		schemaVersion: 1,
		arm: session.arm,
		runtime: session.runtime,
		runtimeVersion: session.runtimeVersion,
		automationVersion: session.automationVersion,
		browserExecutable: session.browserExecutable,
		viewport: session.viewport,
		...pass,
	};
}

function sessionSample(input: {
	arm: E2ESmokeArm;
	sessionNumber: number;
	repetition: number;
	phase: E2EBenchmarkPhase;
	pass: E2EPassOutcome;
	outcome: E2ESessionOutcome;
	run: MeasuredRun;
}): E2EBenchmarkSample {
	return {
		arm: input.arm,
		session: input.sessionNumber,
		repetition: input.repetition,
		phase: input.phase,
		ms: input.pass.durationMs,
		peakRssBytes: input.pass.browserRssBytes,
		exitCode: input.run.exitCode,
		loadAvg1: input.run.loadAvg1,
		timedOut: input.run.timedOut,
		outcome: smokeFromPass(input.outcome, input.pass),
		...(input.run.exitCode === 0 && !input.run.timedOut
			? {}
			: { failureExcerpt: excerpt(input.run) }),
	};
}

async function commit(): Promise<string> {
	try {
		return (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
	} catch {
		return "unknown";
	}
}

async function runCold(
	baseUrl: string,
	repetitions: number,
	metadata: { timestamp: string; commit: string; host: Awaited<ReturnType<typeof collectHostMeta>> },
) {
	const warmups: E2EBenchmarkSample[] = [];
	for (const arm of ["playwright", "webview"] as const) {
		const sample = coldSample(arm, 0, "warmup", await runArm(arm, baseUrl));
		warmups.push(sample);
		console.log(
			`cold warm-up ${arm}: ${(sample.ms / 1000).toFixed(2)}s, exit ${sample.exitCode}`,
		);
	}

	const samples: E2EBenchmarkSample[] = [];
	for (const item of benchmarkOrder(repetitions)) {
		const sample = coldSample(
			item.arm,
			item.repetition,
			"measured",
			await runArm(item.arm, baseUrl),
		);
		samples.push(sample);
		console.log(
			`cold ${item.repetition}/${repetitions} ${item.arm}: ${(sample.ms / 1000).toFixed(2)}s, exit ${sample.exitCode}`,
		);
	}
	return buildE2EBenchmarkRun({
		mode: "cold",
		...metadata,
		repetitions,
		warmupsPerArm: 1,
		warmups,
		samples,
	});
}

async function runWarmSessions(
	baseUrl: string,
	passesPerSession: number,
	metadata: { timestamp: string; commit: string; host: Awaited<ReturnType<typeof collectHostMeta>> },
) {
	const warmups: E2EBenchmarkSample[] = [];
	const samples: E2EBenchmarkSample[] = [];
	const sessionTotals: E2ESessionTotal[] = [];
	for (const item of benchmarkOrder(WARM_SESSION_COUNT)) {
		const run = await runArm(item.arm, baseUrl, passesPerSession);
		const outcome = parseSessionOutcome(run.stdout);
		sessionTotals.push({
			arm: item.arm,
			session: item.repetition,
			ms: run.ms,
			peakRssBytes: run.peakRssBytes,
			exitCode: run.exitCode,
			loadAvg1: run.loadAvg1,
			timedOut: run.timedOut,
		});
		if (outcome) {
			warmups.push(
				sessionSample({
					arm: item.arm,
					sessionNumber: item.repetition,
					repetition: 0,
					phase: "warmup",
					pass: outcome.warmup,
					outcome,
					run,
				}),
			);
			for (const [index, pass] of outcome.passes.entries())
				samples.push(
					sessionSample({
						arm: item.arm,
						sessionNumber: item.repetition,
						repetition:
							(item.repetition - 1) * passesPerSession + index + 1,
						phase: "measured",
						pass,
						outcome,
						run,
					}),
				);
		}
		console.log(
			`warm session ${item.repetition}/${WARM_SESSION_COUNT} ${item.arm}: ${(run.ms / 1000).toFixed(2)}s total, ${outcome?.passes.length ?? 0}/${passesPerSession} passes`,
		);
	}
	return buildE2EBenchmarkRun({
		mode: "warm-session",
		...metadata,
		repetitions: passesPerSession * WARM_SESSION_COUNT,
		warmupsPerArm: WARM_SESSION_COUNT,
		sessionsPerArm: WARM_SESSION_COUNT,
		warmups,
		samples,
		sessionTotals,
	});
}

async function main(): Promise<void> {
	const repetitions = repetitionsFrom(process.argv.slice(2));
	const server = await startLocalE2EServer({ quiet: true });
	try {
		const metadata = {
			timestamp: new Date().toISOString(),
			commit: await commit(),
			host: await collectHostMeta(),
		};
		const cold = await runCold(server.baseUrl, repetitions, metadata);
		const warm = await runWarmSessions(server.baseUrl, repetitions, metadata);
		for (const run of [cold, warm]) {
			const paths = await writeE2EBenchmark(run);
			console.log("");
			console.log(renderE2EBenchmark(run));
			console.log(`JSON: ${paths.jsonPath}`);
			console.log(`Markdown: ${paths.markdownPath}`);
		}
		if (!cold.validComparison || !warm.validComparison) process.exitCode = 1;
	} finally {
		await server.stop();
	}
}

main().catch((error) => {
	console.error(error instanceof Error ? error.message : String(error));
	process.exitCode = 1;
});
