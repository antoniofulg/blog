#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { mkdir, open, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { BROWSER_SMOKE_ROUTE_IDS, normalizeBrowserSmokeOutcome, type BrowserSmokeObservation, type BrowserSmokeOutcome } from "#/lib/browser-bench/contract";
import { collectHostMeta } from "#/lib/bench/host.server";
import { spawnMeasured, type MeasuredRun } from "#/lib/bench/runner.server";
import { aggregate } from "#/lib/bench/stats";
import type { Aggregate, HostMeta } from "#/lib/bench/types";
import { BROWSER_SMOKE_GREP, DEFAULT_WORKERS, PLAYWRIGHT_WORKER_COUNTS } from "./bench-e2e-runtimes";
import { WEBVIEW_RESULT_PREFIX, WEBVIEW_BACKENDS, type WebViewBackend } from "./run-e2e-webview";
import { startLocalE2EServer } from "./lib/local-e2e-server";

const exec = promisify(execFile);
export const SCREENING_REPETITIONS = 3;
export const FINALIST_REPETITIONS = 5;
export const DEFAULT_REPETITIONS = FINALIST_REPETITIONS;
export const WARMUP_COUNT = 1;
export const BENCHMARK_DIR = resolve(process.cwd(), "docs/benchmarks/browser-runtime-revalidation/runs");
const SAMPLE_TIMEOUT_MS = 15 * 60_000;

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

export type BrowserOutcome = BrowserSmokeOutcome & { routeCount: number; setupOverhead: number; inventory: number };
export type ContaminationReport = { before?: string; during?: string; after?: string; detected: boolean };
export type Boundary = {
	phase: Profile["phase"];
	server: "restarted-per-sample" | "reused-arm" | "external";
	browser: "restarted-per-sample" | "reused-arm" | "playwright-managed";
	process: "restarted-per-sample" | "reused-arm";
};

export type BrowserSample = {
	profile: string;
	kind: "warmup" | "measured";
	run: number;
	durationMs: number;
	peakRssBytes: number;
	exitCode: number | null;
	timedOut: boolean;
	outcome: BrowserOutcome | null;
	valid: boolean;
	exclusionReason?: string;
	command: string[];
	boundary: Boundary;
	cleanupVerified: boolean;
	contamination: ContaminationReport;
	rssTimeBytesMs: number;
	runtimeVersion: string;
	browserVersion: string;
	serverRuntime: "bun";
	setupOverheadMs: number;
};

export type BrowserProfileResult = {
	profile: Profile;
	warmup: BrowserSample;
	samples: BrowserSample[];
	screening?: { warmup: BrowserSample; samples: BrowserSample[] };
	extraWarmups?: BrowserSample[];
	excludedSamples?: BrowserSample[];
	aggregate: Aggregate | null;
	valid: boolean;
	invalidReasons: string[];
	nonDominated: boolean;
	interleaved?: boolean;
};

export type BrowserBenchmarkRun = {
	schemaVersion: 2;
	commit: string;
	timestamp: string;
	host: HostMeta;
	repetitions: number;
	screeningRepetitions: number;
	warmupsPerProfile: number;
	canonicalRoutes: number;
	profiles: BrowserProfileResult[];
	finalists: string[];
	finalistSchedule: string[][];
	locks: string[];
	serializedQueueThroughput: { profile: string; samplesPerMinute: number }[];
};

export const PLAYWRIGHT_PROFILES: readonly Profile[] = PLAYWRIGHT_WORKER_COUNTS.flatMap((workers) => (["node", "bun"] as const).map((runtime) => ({
	id: `playwright:${runtime}:${workers}`, arm: "playwright" as const, runtime, workers, phase: "cold" as const, views: 1 as const, smol: false,
	command: runtime === "node" ? ["node", "node_modules/@playwright/test/cli.js"] : ["bunx", "--bun", "playwright"],
})));

const webViewProfiles: Profile[] = [];
for (const backend of WEBVIEW_BACKENDS) for (const phase of ["cold", "warm"] as const) for (const views of [1, 2] as const) for (const smol of [false, true] as const) {
	webViewProfiles.push({ id: `webview:${backend}:${phase}:${views}view${smol ? ":smol" : ""}`, arm: "webview", runtime: "bun", backend, phase, views, smol, command: ["bun", ...(smol ? ["--smol"] : []), "run", "scripts/run-e2e-webview.ts"] });
}
export const WEBVIEW_PROFILES: readonly Profile[] = webViewProfiles;
export const ALL_PROFILES: readonly Profile[] = [...PLAYWRIGHT_PROFILES, ...WEBVIEW_PROFILES];

export function sampleBoundary(profile: Profile): Boundary {
	if (profile.arm === "playwright") return { phase: "cold", server: "external", browser: "playwright-managed", process: "restarted-per-sample" };
	if (profile.phase === "warm") return { phase: "warm", server: "reused-arm", browser: "reused-arm", process: "reused-arm" };
	return { phase: "cold", server: "restarted-per-sample", browser: "restarted-per-sample", process: "restarted-per-sample" };
}

export function commandForProfile(profile: Profile, baseUrl = "http://localhost:4173", passes = 1): string[] {
	if (profile.arm === "playwright") return [...profile.command, "test", "--config=playwright.config.ts", "--project=chromium", `--workers=${profile.workers ?? DEFAULT_WORKERS}`, "--retries=0", "--grep", BROWSER_SMOKE_GREP, "--reporter=json"];
	return [...profile.command, "--external-server", `--backend=${profile.backend}`, `--views=${profile.views}`, `--passes=${passes}`, `--base-url=${baseUrl}`];
}

function routeForTitle(title: string): (typeof BROWSER_SMOKE_ROUTE_IDS)[number] | undefined {
	const value = title.toLowerCase();
	if (value.includes("en post render")) return "en-post";
	if (value.includes("pt-br post render")) return "pt-br-post";
	if (value.startsWith("404:")) return "not-found";
	if (value.startsWith("/pt-br/ renders 200")) return "pt-br-index";
	if (value.startsWith("/ renders 200")) return "en-index";
	return undefined;
}

function collectPlaywrightSpecs(value: unknown, output: { title: string; passed: boolean }[] = []): { title: string; passed: boolean }[] {
	if (typeof value !== "object" || value === null) return output;
	const title = Reflect.get(value, "title");
	const tests = Reflect.get(value, "tests");
	if (typeof title === "string" && Array.isArray(tests)) {
		const statuses = tests.flatMap((test) => {
			if (typeof test !== "object" || test === null) return [];
			const results = Reflect.get(test, "results");
			return Array.isArray(results) ? results.map((result) => Reflect.get(result, "status")) : [Reflect.get(test, "status")];
		});
		output.push({ title, passed: statuses.length > 0 && statuses.every((status) => status === "passed") });
	}
	for (const key of ["suites", "projects", "specs"]) {
		const children = Reflect.get(value, key);
		if (Array.isArray(children)) for (const child of children) collectPlaywrightSpecs(child, output);
	}
	return output;
}

function parseJsonReport(stdout: string): unknown | null {
	try { return JSON.parse(stdout.trim()); } catch {
		const start = stdout.indexOf("{");
		const end = stdout.lastIndexOf("}");
		if (start < 0 || end <= start) return null;
		try { return JSON.parse(stdout.slice(start, end + 1)); } catch { return null; }
	}
}

export function parseSmokeOutput(stdout: string, arm: Profile["arm"]): BrowserOutcome | null {
	if (arm === "webview") {
		for (const line of stdout.split("\n").reverse()) if (line.startsWith(WEBVIEW_RESULT_PREFIX)) {
			try {
				const value = JSON.parse(line.slice(WEBVIEW_RESULT_PREFIX.length)) as { routes?: unknown };
				const normalized = normalizeBrowserSmokeOutcome({ routes: value.routes });
				if (!normalized) return null;
				return { ...normalized, routeCount: normalized.routes.length, setupOverhead: 0, inventory: normalized.routes.length };
			} catch { return null; }
		}
		return null;
	}
	const report = parseJsonReport(stdout);
	if (!report) return null;
	const stats = Reflect.get(report, "stats");
	if (typeof stats !== "object" || stats === null) return null;
	const expected = Reflect.get(stats, "expected");
	const skipped = Reflect.get(stats, "skipped");
	const unexpected = Reflect.get(stats, "unexpected");
	const flaky = Reflect.get(stats, "flaky");
	if ([expected, skipped, unexpected, flaky].some((value) => typeof value !== "number")) return null;
	const specs = collectPlaywrightSpecs(report);
	const routes: BrowserSmokeObservation[] = BROWSER_SMOKE_ROUTE_IDS.map((id) => {
		const matches = specs.filter((spec) => routeForTitle(spec.title) === id);
		return { id, passed: matches.length > 0 && matches.every((spec) => spec.passed) };
	});
	const normalized = normalizeBrowserSmokeOutcome({ routes });
	if (!normalized) return null;
	const inventory = expected + skipped + unexpected + flaky;
	return { ...normalized, routeCount: normalized.routes.length, setupOverhead: Math.max(0, expected - BROWSER_SMOKE_ROUTE_IDS.length), inventory };
}

export function parseWebViewPassOutcomes(stdout: string): BrowserOutcome[] {
	for (const line of stdout.split("\n").reverse()) {
		if (!line.startsWith(WEBVIEW_RESULT_PREFIX)) continue;
		try {
			const value = JSON.parse(line.slice(WEBVIEW_RESULT_PREFIX.length)) as { passOutcomes?: unknown };
			if (!Array.isArray(value.passOutcomes)) return [];
			return value.passOutcomes.flatMap((routes) => {
				const normalized = normalizeBrowserSmokeOutcome({ routes });
				return normalized ? [{ ...normalized, routeCount: normalized.routes.length, setupOverhead: 0, inventory: normalized.routes.length }] : [];
			});
		} catch {
			return [];
		}
	}
	return [];
}

export function detectBrowserContamination(snapshot: string, cwd: string, ignoredPgid = 0): string | undefined {
	const rootPattern = /(?:playwright(?:\.js)?\s+test|node_modules\/playwright\/lib\/worker|media-validation-host-proxy)/i;
	const rows = snapshot.split("\n").filter(Boolean).map((line) => {
		const fields = line.trim().split(/\s+/);
		return { line, pgid: Number(fields[1]), command: fields.slice(2).join(" ") };
	}).filter((row) => !row.line.includes(cwd) && Number.isFinite(row.pgid) && row.pgid !== ignoredPgid);
	const contaminatedGroups = new Set(rows.filter((row) => rootPattern.test(row.command)).map((row) => row.pgid));
	const matches = rows.filter((row) => contaminatedGroups.has(row.pgid)).map((row) => row.line);
	return matches.length ? matches.join(" | ") : undefined;
}

async function externalBrowserContamination(ignoredPgid = 0): Promise<string | undefined> {
	try { return detectBrowserContamination((await exec("ps", ["-axo", "pid=,pgid=,command="])).stdout, process.cwd(), ignoredPgid); } catch { return undefined; }
}

async function measuredWithContamination(command: string[]): Promise<{ measured: MeasuredRun; contamination: ContaminationReport }> {
	const before = await externalBrowserContamination();
	let pgid = 0;
	let during: string | undefined;
	let polling = false;
	const poll = setInterval(() => {
		if (polling) return;
		polling = true;
		externalBrowserContamination(pgid).then((value) => { if (value) during = during ? `${during} | ${value}` : value; }).finally(() => { polling = false; });
	}, 100);
	try {
		const measured = await spawnMeasured(command, process.env, { timeoutMs: SAMPLE_TIMEOUT_MS, cwd: process.cwd(), onStart: (group) => { pgid = group; } });
		const after = await externalBrowserContamination();
		return { measured, contamination: { before, during, after, detected: Boolean(before || during || after) } };
	} finally { clearInterval(poll); }
}

function sampleFromRun(profile: Profile, kind: BrowserSample["kind"], run: number, measured: MeasuredRun, command: string[], boundary: Boundary, contamination: ContaminationReport, outcome = parseSmokeOutput(measured.stdout, profile.arm), durationMs = measured.ms): BrowserSample {
	const reasons: string[] = [];
	if (measured.timedOut) reasons.push("timed out");
	if (measured.exitCode !== 0) reasons.push(`exit code ${measured.exitCode}`);
	if (!outcome) reasons.push("missing smoke outcome");
	if (outcome && (!outcome.passed || outcome.routeCount !== BROWSER_SMOKE_ROUTE_IDS.length)) reasons.push("canonical route outcome mismatch");
	if (measured.cleanupVerified === false) reasons.push(`process cleanup failed: ${(measured.lingeringPids ?? []).join(",")}`);
	if (contamination.detected) reasons.push(`contaminated: ${contamination.before ?? contamination.during ?? contamination.after}`);
	return { profile: profile.id, kind, run, durationMs, peakRssBytes: measured.peakRssBytes, exitCode: measured.timedOut ? null : measured.exitCode, timedOut: measured.timedOut, outcome, valid: reasons.length === 0, ...(reasons.length === 0 ? {} : { exclusionReason: reasons.join("; ") }), command, boundary, cleanupVerified: measured.cleanupVerified !== false, contamination, rssTimeBytesMs: measured.peakRssBytes * durationMs, runtimeVersion: profile.runtime === "node" ? "24" : "1.4", browserVersion: profile.arm === "playwright" ? "chromium" : profile.backend ?? "unknown", serverRuntime: "bun", setupOverheadMs: outcome?.setupOverhead ?? 0 };
}

export function selectNonDominated(results: BrowserProfileResult[]): string[] {
	const valid = results.filter((result) => result.valid && result.aggregate && result.interleaved !== false);
	return valid.filter((candidate) => !valid.some((other) => {
		if (other === candidate) return false;
		const a = candidate.aggregate!;
		const b = other.aggregate!;
		return b.medianMs <= a.medianMs && b.medianPeakRssBytes <= a.medianPeakRssBytes && (b.medianMs < a.medianMs || b.medianPeakRssBytes < a.medianPeakRssBytes);
	})).map((result) => result.profile.id);
}

export function interleaveProfileIds(profileIds: string[], repetitions: number): string[][] {
	return Array.from({ length: repetitions }, (_, index) => profileIds.map((id) => `${id}#${index + 1}`));
}

function aggregateSamples(samples: BrowserSample[]): Aggregate | null {
	return aggregate(samples.filter((sample) => sample.valid).map((sample) => ({ ms: sample.durationMs, peakRssBytes: sample.peakRssBytes, exitCode: sample.exitCode ?? -1, loadAvg1: 0 })));
}

async function runProfile(profile: Profile, repetitions: number): Promise<BrowserProfileResult> {
	const boundary = sampleBoundary(profile);
	const command = commandForProfile(profile);
	const samples: BrowserSample[] = [];
	let warmup: BrowserSample;
	const runOne = async (kind: BrowserSample["kind"], run: number): Promise<BrowserSample> => {
		if (profile.arm === "webview") {
			const server = await startLocalE2EServer({ quiet: true });
			try {
				const actual = commandForProfile(profile, server.baseUrl);
				const result = await measuredWithContamination(actual);
				return sampleFromRun(profile, kind, run, result.measured, actual, boundary, result.contamination);
			} finally { await server.stop(); }
		}
		const result = await measuredWithContamination(command);
		return sampleFromRun(profile, kind, run, result.measured, command, boundary, result.contamination);
	};
	if (profile.arm === "webview" && profile.phase === "warm") {
		const server = await startLocalE2EServer({ quiet: true });
		try {
			const actual = commandForProfile(profile, server.baseUrl, repetitions + 1);
			const result = await measuredWithContamination(actual);
			const passOutcomes = parseWebViewPassOutcomes(result.measured.stdout);
			warmup = sampleFromRun(profile, "warmup", 0, result.measured, actual, boundary, result.contamination, passOutcomes[0] ?? null, result.measured.ms / (repetitions + 1));
			for (let index = 0; index < repetitions; index += 1) samples.push(sampleFromRun(profile, "measured", index + 1, result.measured, actual, boundary, result.contamination, passOutcomes[index + 1] ?? null, result.measured.ms / (repetitions + 1)));
		} finally { await server.stop(); }
	} else {
		warmup = await runOne("warmup", 0);
		let attempt = 0;
		while (samples.filter((sample) => sample.valid).length < repetitions && attempt < repetitions + 5) { attempt += 1; samples.push(await runOne("measured", attempt)); }
	}
	const validSamples = samples.filter((sample) => sample.valid);
	const invalidReasons = [
		...(warmup.valid ? [] : [`warmup: ${warmup.exclusionReason}`]),
		...samples.filter((sample) => !sample.valid).map((sample) => `sample ${sample.run}: ${sample.exclusionReason}`),
	];
	if (validSamples.length !== repetitions) invalidReasons.push(`expected ${repetitions} valid samples, got ${validSamples.length}`);
	return { profile, warmup, samples, aggregate: aggregateSamples(samples), valid: invalidReasons.length === 0, invalidReasons, nonDominated: false, interleaved: false };
}

async function runColdFinalistsInterleaved(
	profiles: Profile[],
	repetitions: number,
): Promise<Map<string, BrowserProfileResult>> {
	const states = new Map<string, BrowserProfileResult>();
	for (let round = 0; round < repetitions; round += 1) {
		for (const profile of profiles) {
			const run = await runProfile(profile, 1);
			const state = states.get(profile.id);
			if (!state) {
				const measured = run.samples.find((sample) => sample.valid) ?? run.samples[0];
				states.set(profile.id, {
					...run,
					samples: measured ? [measured] : [],
					extraWarmups: [],
					excludedSamples: run.samples.filter((sample) => sample !== measured),
					invalidReasons: [...run.invalidReasons],
					interleaved: true,
				});
				continue;
			}
			const measured = run.samples.find((sample) => sample.valid) ?? run.samples[0];
			if (measured) state.samples.push(measured);
			state.extraWarmups?.push(run.warmup);
			state.excludedSamples?.push(...run.samples.filter((sample) => sample !== measured));
			state.invalidReasons.push(...run.invalidReasons);
		}
	}
	for (const state of states.values()) {
		const validCount = state.samples.filter((sample) => sample.valid).length;
		if (validCount !== repetitions) state.invalidReasons.push(`expected ${repetitions} interleaved valid samples, got ${validCount}`);
		state.aggregate = aggregateSamples(state.samples);
		state.valid = state.warmup.valid && validCount === repetitions && state.invalidReasons.length === 0;
	}
	return states;
}

async function commit(): Promise<string> {
	try { return (await exec("git", ["rev-parse", "HEAD"])).stdout.trim(); } catch { return "unknown"; }
}

async function reserveStem(timestamp: string): Promise<string> {
	await mkdir(BENCHMARK_DIR, { recursive: true });
	const base = timestamp.replace(/[^0-9A-Za-z-]/g, "-");
	for (let suffix = 0; suffix < 10_000; suffix += 1) {
		const stem = `run-${base}${suffix === 0 ? "" : `-${suffix}`}`;
		try { const handle = await open(join(BENCHMARK_DIR, `${stem}.json`), "wx"); await handle.close(); return stem; } catch (error) { if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error; }
	}
	throw new Error("unable to reserve browser benchmark report name");
}

function bytes(value: number): string { return `${(value / (1024 * 1024)).toFixed(1)} MiB`; }

export function renderBrowserBenchmark(run: BrowserBenchmarkRun): string {
	const lines = ["# Browser runtime revalidation", "", `- Commit: \`${run.commit}\``, `- Timestamp: ${run.timestamp}`, `- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`, `- Canonical outcomes per sample: ${run.canonicalRoutes} (route identities retained in JSON)`, `- Protocol: one discarded warm-up + ${run.screeningRepetitions} screening samples; finalists confirm with ${run.repetitions} valid interleaved samples`, `- Locks: ${run.locks.join(", ")}`, "", "| Profile | Valid | Median | Peak RSS | RSS×time | Samples | Disposition |", "| --- | --- | ---: | ---: | ---: | ---: | --- |"];
	for (const result of run.profiles) {
		const aggregateResult = result.aggregate;
		const rssTime = aggregateResult ? aggregateResult.medianMs * aggregateResult.medianPeakRssBytes : 0;
		lines.push(`| ${result.profile.id} | ${result.valid ? "yes" : "no"} | ${aggregateResult ? `${aggregateResult.medianMs.toFixed(2)} ms` : "—"} | ${aggregateResult ? bytes(aggregateResult.medianPeakRssBytes) : "—"} | ${aggregateResult ? `${(rssTime / (1024 ** 3)).toFixed(2)} GiB·s` : "—"} | ${result.samples.filter((sample) => sample.valid).length}/${run.repetitions} | ${run.finalists.includes(result.profile.id) ? "finalist" : result.invalidReasons.join("; ") || "discarded"} |`);
	}
	lines.push("", `Finalists: ${run.finalists.length ? run.finalists.join(", ") : "none"}.`, "", "Setup-project overhead is retained on each Playwright sample and excluded from the five-route outcome count.", "WebView remains experimental and local-only; Playwright retains full E2E coverage.", "");
	return lines.join("\n");
}

function parseArgs(args: string[]): { repetitions: number; profiles: Profile[] } {
	let repetitions = DEFAULT_REPETITIONS;
	let profiles = [...ALL_PROFILES];
	for (const arg of args) {
		if (arg.startsWith("--repetitions=")) repetitions = Number(arg.slice(14));
		else if (arg.startsWith("--profile=")) { const id = arg.slice("--profile=".length); profiles = ALL_PROFILES.filter((profile) => profile.id === id); if (!profiles.length) throw new Error(`unknown browser profile: ${id}`); }
		else if (arg === "--help") { console.log("Usage: bun run scripts/bench-browser-runtimes.ts [--repetitions=N] [--profile=ID]"); process.exit(0); }
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("--repetitions must be a positive integer");
	return { repetitions, profiles };
}

export async function runBrowserBenchmark(repetitions = DEFAULT_REPETITIONS, profiles: Profile[] = [...ALL_PROFILES]): Promise<BrowserBenchmarkRun> {
	const screening: BrowserProfileResult[] = [];
	for (const profile of profiles) screening.push(await runProfile(profile, SCREENING_REPETITIONS));
	const screeningFinalists = selectNonDominated(screening.map((result) => ({ ...result, interleaved: true })));
	const confirmed = await runColdFinalistsInterleaved(
		profiles.filter((candidate) => screeningFinalists.includes(candidate.id) && candidate.phase === "cold"),
		repetitions,
	);
	const finalistSchedule = interleaveProfileIds([...confirmed.keys()], repetitions);
	for (const profile of profiles.filter((candidate) => screeningFinalists.includes(candidate.id) && candidate.phase === "warm")) {
		const result = await runProfile(profile, repetitions);
		result.invalidReasons.push("warm finalist invalidated: warm session cannot be interleaved across process groups");
		result.valid = false;
		result.interleaved = false;
		confirmed.set(profile.id, result);
	}
	for (const profile of profiles.filter((candidate) => confirmed.has(candidate.id))) {
		const result = confirmed.get(profile.id)!;
		const prior = screening.find((candidate) => candidate.profile.id === profile.id);
		if (prior) result.screening = { warmup: prior.warmup, samples: prior.samples };
	}
	const results = profiles.map((profile) => confirmed.get(profile.id) ?? screening.find((result) => result.profile.id === profile.id)!);
	const finalists = selectNonDominated(results);
	for (const result of results) result.nonDominated = finalists.includes(result.profile.id);
	return { schemaVersion: 2, commit: await commit(), timestamp: new Date().toISOString(), host: await collectHostMeta(), repetitions, screeningRepetitions: SCREENING_REPETITIONS, warmupsPerProfile: WARMUP_COUNT, canonicalRoutes: BROWSER_SMOKE_ROUTE_IDS.length, profiles: results, finalists, finalistSchedule, locks: ["/tmp/praxis-playwright.lock", join(tmpdir(), "creatista-test.lock")], serializedQueueThroughput: results.map((result) => ({ profile: result.profile.id, samplesPerMinute: result.aggregate?.medianMs ? 60_000 / result.aggregate.medianMs : 0 })) };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!process.env.BROWSER_BENCH_LOCKED) {
		const antclipsLock = join(tmpdir(), "creatista-test.lock");
		const scriptPath = fileURLToPath(import.meta.url);
		await exec("python3", ["/Users/antoniofulg/Projects/crm/tools/machine-lock.py", "lockf", "-ks", antclipsLock, process.execPath, scriptPath, ...args], { env: { ...process.env, BROWSER_BENCH_LOCKED: "1" } });
		return;
	}
	const options = parseArgs(args);
	const run = await runBrowserBenchmark(options.repetitions, options.profiles);
	const stem = await reserveStem(run.timestamp);
	await writeFile(join(BENCHMARK_DIR, `${stem}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(join(BENCHMARK_DIR, `${stem}.md`), `${renderBrowserBenchmark(run)}\n`, "utf8");
	console.log(`JSON: ${join(BENCHMARK_DIR, `${stem}.json`)}`);
	console.log(`Markdown: ${join(BENCHMARK_DIR, `${stem}.md`)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
