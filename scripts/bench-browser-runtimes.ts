#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { mkdir, open, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import { collectHostMeta } from "#/lib/bench/host.server";
import { spawnMeasured, type MeasuredRun } from "#/lib/bench/runner.server";
import { aggregate } from "#/lib/bench/stats";
import type { Aggregate, HostMeta } from "#/lib/bench/types";
import {
	BROWSER_SMOKE_GREP,
	DEFAULT_WORKERS,
	PLAYWRIGHT_WORKER_COUNTS,
} from "./bench-e2e-runtimes";
import { WEBVIEW_RESULT_PREFIX, WEBVIEW_BACKENDS, type WebViewBackend } from "./run-e2e-webview";
import { startLocalE2EServer } from "./lib/local-e2e-server";

const exec = promisify(execFile);
export const DEFAULT_REPETITIONS = 5;
export const WARMUP_COUNT = 1;
export const BENCHMARK_DIR = resolve(
	process.cwd(),
	"docs/benchmarks/browser-runtime-revalidation/runs",
);

export type Profile = {
	id: string;
	arm: "playwright" | "webview";
	runtime: "node" | "bun";
	backend?: WebViewBackend;
	workers?: (typeof PLAYWRIGHT_WORKER_COUNTS)[number];
	phase: "cold" | "warm";
	views: 1 | 2;
	smol: boolean;
	command: string[];
};

export type BrowserSample = {
	profile: string;
	kind: "warmup" | "measured";
	run: number;
	durationMs: number;
	peakRssBytes: number;
	exitCode: number | null;
	timedOut: boolean;
	outcome: { passed: boolean; routeCount: number } | null;
	valid: boolean;
	exclusionReason?: string;
	command: string[];
};

export type BrowserProfileResult = {
	profile: Profile;
	warmup: BrowserSample;
	samples: BrowserSample[];
	aggregate: Aggregate | null;
	valid: boolean;
	invalidReasons: string[];
	nonDominated: boolean;
};

export type BrowserBenchmarkRun = {
	schemaVersion: 1;
	commit: string;
	timestamp: string;
	host: HostMeta;
	repetitions: number;
	warmupsPerProfile: number;
	canonicalRoutes: number;
	profiles: BrowserProfileResult[];
	finalists: string[];
	locks: string[];
};

export const PLAYWRIGHT_PROFILES: readonly Profile[] = PLAYWRIGHT_WORKER_COUNTS.flatMap(
	(workers) =>
		(["node", "bun"] as const).map((runtime) => ({
			id: `playwright:${runtime}:${workers}`,
			arm: "playwright" as const,
			runtime,
			workers,
			phase: "cold" as const,
			views: 1 as const,
			smol: false,
			command:
				runtime === "node"
					? ["node", "node_modules/@playwright/test/cli.js"]
					: ["bunx", "--bun", "playwright"],
		})),
);

const webViewProfiles: Profile[] = [];
for (const backend of WEBVIEW_BACKENDS) {
	for (const phase of ["cold", "warm"] as const) {
		for (const views of [1, 2] as const) {
			for (const smol of [false, true] as const) {
				webViewProfiles.push({
					id: `webview:${backend}:${phase}:${views}view${smol ? ":smol" : ""}`,
					arm: "webview",
					runtime: "bun",
					backend,
					phase,
					views,
					smol,
					command: ["bun", ...(smol ? ["--smol"] : []), "run", "scripts/run-e2e-webview.ts"],
				});
			}
		}
	}
}
export const WEBVIEW_PROFILES: readonly Profile[] = webViewProfiles;

export const ALL_PROFILES: readonly Profile[] = [...PLAYWRIGHT_PROFILES, ...WEBVIEW_PROFILES];

export function commandForProfile(profile: Profile, baseUrl = "http://localhost:4173"): string[] {
	if (profile.arm === "playwright") {
		return [
			...profile.command,
			"test",
			"--config=playwright.config.ts",
			"--project=chromium",
			`--workers=${profile.workers ?? DEFAULT_WORKERS}`,
			"--retries=0",
			"--grep",
			BROWSER_SMOKE_GREP,
			"--reporter=json",
		];
	}
	return [
		...profile.command,
		"--external-server",
		`--backend=${profile.backend}`,
		`--views=${profile.views}`,
		"--passes=1",
		`--base-url=${baseUrl}`,
	];
}

function parseSmokeOutput(stdout: string, arm: Profile["arm"]): BrowserSample["outcome"] {
	if (arm === "webview") {
		for (const line of stdout.split("\n").reverse()) {
			if (!line.startsWith(WEBVIEW_RESULT_PREFIX)) continue;
			try {
				const value = JSON.parse(line.slice(WEBVIEW_RESULT_PREFIX.length)) as {
					passed?: unknown;
					routes?: unknown;
				};
				return {
					passed: value.passed === true,
					routeCount: Array.isArray(value.routes) ? value.routes.length : 0,
				};
			} catch {
				return null;
			}
		}
		return null;
	}
	try {
		const report = JSON.parse(stdout.trim()) as {
			stats?: { unexpected?: unknown; flaky?: unknown; skipped?: unknown };
		};
		const stats = report.stats;
		if (!stats) return null;
		return {
			passed:
				stats.unexpected === 0 && stats.flaky === 0 && stats.skipped === 0,
			routeCount: BROWSER_SMOKE_ROUTE_IDS.length,
		};
	} catch {
		return null;
	}
}

function sampleFromRun(profile: Profile, kind: BrowserSample["kind"], run: number, measured: MeasuredRun, command: string[]): BrowserSample {
	const outcome = parseSmokeOutput(measured.stdout, profile.arm);
	const reasons: string[] = [];
	if (measured.timedOut) reasons.push("timed out");
	if (measured.exitCode !== 0) reasons.push(`exit code ${measured.exitCode}`);
	if (!outcome) reasons.push("missing smoke outcome");
	if (outcome && (!outcome.passed || outcome.routeCount !== BROWSER_SMOKE_ROUTE_IDS.length)) {
		reasons.push("canonical route outcome mismatch");
	}
	return {
		profile: profile.id,
		kind,
		run,
		durationMs: measured.ms,
		peakRssBytes: measured.peakRssBytes,
		exitCode: measured.timedOut ? null : measured.exitCode,
		timedOut: measured.timedOut,
		outcome,
		valid: reasons.length === 0,
		...(reasons.length === 0 ? {} : { exclusionReason: reasons.join("; ") }),
		command,
	};
}

export function selectNonDominated(results: BrowserProfileResult[]): string[] {
	const valid = results.filter((result) => result.valid && result.aggregate);
	return valid
		.filter((candidate) =>
			!valid.some((other) => {
				if (other === candidate) return false;
				const candidateAggregate = candidate.aggregate!;
				const otherAggregate = other.aggregate!;
				const noWorse =
					otherAggregate.medianMs <= candidateAggregate.medianMs &&
					otherAggregate.medianPeakRssBytes <= candidateAggregate.medianPeakRssBytes;
				const strictlyBetter =
					otherAggregate.medianMs < candidateAggregate.medianMs ||
					otherAggregate.medianPeakRssBytes < candidateAggregate.medianPeakRssBytes;
				return noWorse && strictlyBetter;
			}),
		)
		.map((result) => result.profile.id);
}

async function runProfile(profile: Profile, repetitions: number, baseUrl: string): Promise<BrowserProfileResult> {
	const command = commandForProfile(profile, baseUrl);
	const warmup = sampleFromRun(profile, "warmup", 0, await spawnMeasured(command, process.env, { timeoutMs: 15 * 60_000, cwd: process.cwd() }), command);
	const samples: BrowserSample[] = [];
	let attempt = 0;
	const maxAttempts = repetitions + 5;
	while (samples.filter((sample) => sample.valid).length < repetitions && attempt < maxAttempts) {
		attempt += 1;
		const contamination = await externalBrowserContamination();
		const measured = await spawnMeasured(command, process.env, { timeoutMs: 15 * 60_000, cwd: process.cwd() });
		const sample = sampleFromRun(profile, "measured", attempt, measured, command);
		if (contamination) {
			sample.valid = false;
			sample.exclusionReason = `contaminated: ${contamination}`;
		}
		samples.push(sample);
	}
	const validSamples = samples.filter((sample) => sample.valid);
	const aggregateResult = aggregate(
		validSamples.map((sample) => ({
			ms: sample.durationMs,
			peakRssBytes: sample.peakRssBytes,
			exitCode: sample.exitCode ?? -1,
			loadAvg1: 0,
		})),
	);
	const invalidReasons = samples.filter((sample) => !sample.valid).map((sample) => `sample ${sample.run}: ${sample.exclusionReason}`);
	if (validSamples.length !== repetitions) invalidReasons.push(`expected ${repetitions} valid samples, got ${validSamples.length}`);
	return {
		profile,
		warmup,
		samples,
		aggregate: aggregateResult,
		valid: invalidReasons.length === 0,
		invalidReasons,
		nonDominated: false,
	};
}

async function externalBrowserContamination(): Promise<string | undefined> {
	try {
		const output = (await exec("ps", ["-axo", "pid=,command="])).stdout;
		const external = output
			.split("\n")
			.filter((line) => line && !line.includes(process.cwd()))
			.filter((line) => /playwright test|media-validation-host-proxy/.test(line));
		return external.length ? external.join(" | ") : undefined;
	} catch {
		return undefined;
	}
}

async function reserveStem(timestamp: string): Promise<string> {
	await mkdir(BENCHMARK_DIR, { recursive: true });
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `run-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try {
			const handle = await open(join(BENCHMARK_DIR, `${stem}.json`), "wx");
			await handle.close();
			return stem;
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
		}
	}
	throw new Error("unable to reserve browser benchmark report name");
}

function bytes(value: number): string {
	return `${(value / (1024 * 1024)).toFixed(1)} MiB`;
}

export function renderBrowserBenchmark(run: BrowserBenchmarkRun): string {
	const lines = [
		"# Browser runtime revalidation",
		"",
		`- Commit: \`${run.commit}\``,
		`- Timestamp: ${run.timestamp}`,
		`- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`,
		`- Canonical outcomes per sample: ${run.canonicalRoutes}`,
		`- Warm-up: one per profile, retained in raw JSON and excluded from aggregates`,
		`- Valid samples required: ${run.repetitions} per profile`,
		`- Locks: ${run.locks.join(", ")}`,
		"",
		"| Profile | Valid | Median | Peak RSS | RSS×time | Samples | Disposition |",
		"| --- | --- | ---: | ---: | ---: | ---: | --- |",
	];
	for (const result of run.profiles) {
		const aggregateResult = result.aggregate;
		const rssTime = aggregateResult ? aggregateResult.medianMs * aggregateResult.medianPeakRssBytes : 0;
		lines.push(`| ${result.profile.id} | ${result.valid ? "yes" : "no"} | ${aggregateResult ? `${aggregateResult.medianMs.toFixed(2)} ms` : "—"} | ${aggregateResult ? bytes(aggregateResult.medianPeakRssBytes) : "—"} | ${aggregateResult ? `${(rssTime / (1024 ** 3)).toFixed(2)} GiB·s` : "—"} | ${result.samples.filter((sample) => sample.valid).length}/${run.repetitions} | ${run.finalists.includes(result.profile.id) ? "finalist" : result.invalidReasons.join("; ") || "discarded"} |`);
	}
	lines.push("", `Finalists: ${run.finalists.length ? run.finalists.join(", ") : "none"}.`, "", "WebView remains experimental and local-only; Playwright retains full E2E coverage and setup-project overhead is not part of the five-route outcome count.", "");
	return lines.join("\n");
}

async function commit(): Promise<string> {
	try {
		return (await exec("git", ["rev-parse", "HEAD"])).stdout.trim();
	} catch {
		return "unknown";
	}
}

function parseArgs(args: string[]): { repetitions: number; profiles: Profile[] } {
	let repetitions = DEFAULT_REPETITIONS;
	let profiles = [...ALL_PROFILES];
	for (const arg of args) {
		if (arg.startsWith("--repetitions=")) repetitions = Number(arg.slice(14));
		else if (arg.startsWith("--profile=")) {
			const id = arg.slice("--profile=".length);
			profiles = ALL_PROFILES.filter((profile) => profile.id === id);
			if (!profiles.length) throw new Error(`unknown browser profile: ${id}`);
		} else if (arg === "--help") {
			console.log("Usage: bun run scripts/bench-browser-runtimes.ts [--repetitions=N] [--profile=ID]");
			process.exit(0);
		} else throw new Error(`unknown argument: ${arg}`);
	}
	if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("--repetitions must be a positive integer");
	return { repetitions, profiles };
}

export async function runBrowserBenchmark(repetitions: number, profiles: Profile[] = [...ALL_PROFILES]): Promise<BrowserBenchmarkRun> {
	const results: BrowserProfileResult[] = [];
	for (const profile of profiles) {
		if (profile.arm === "webview") {
			const server = await startLocalE2EServer({ quiet: true });
			try {
				results.push(await runProfile(profile, repetitions, server.baseUrl));
			} finally {
				await server.stop();
			}
		} else {
			results.push(await runProfile(profile, repetitions, "http://localhost:4173"));
		}
	}
	const finalists = selectNonDominated(results);
	for (const result of results) result.nonDominated = finalists.includes(result.profile.id);
	return {
		schemaVersion: 1,
		commit: await commit(),
		timestamp: new Date().toISOString(),
		host: await collectHostMeta(),
		repetitions,
		warmupsPerProfile: WARMUP_COUNT,
		canonicalRoutes: BROWSER_SMOKE_ROUTE_IDS.length,
		profiles: results,
		finalists,
		locks: ["/tmp/praxis-playwright.lock", join(tmpdir(), "creatista-test.lock")],
	};
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!process.env.BROWSER_BENCH_LOCKED) {
		const antclipsLock = join(tmpdir(), "creatista-test.lock");
		const scriptPath = fileURLToPath(import.meta.url);
		const result = await exec(
			"python3",
			[
				"/Users/antoniofulg/Projects/crm/tools/machine-lock.py",
				"lockf",
				"-ks",
				antclipsLock,
				process.execPath,
				scriptPath,
				...args,
			],
			{ env: { ...process.env, BROWSER_BENCH_LOCKED: "1" } },
		).catch((error: unknown) => {
			throw new Error(error instanceof Error ? error.message : String(error));
		});
		process.exitCode = result ? 0 : 1;
		return;
	}
	const options = parseArgs(args);
	const run = await runBrowserBenchmark(options.repetitions, options.profiles);
	const stem = await reserveStem(run.timestamp);
	const jsonPath = join(BENCHMARK_DIR, `${stem}.json`);
	const markdownPath = join(BENCHMARK_DIR, `${stem}.md`);
	await writeFile(jsonPath, `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(markdownPath, `${renderBrowserBenchmark(run)}\n`, "utf8");
	console.log(`JSON: ${jsonPath}`);
	console.log(`Markdown: ${markdownPath}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
	await main();
}
