#!/usr/bin/env bun
import { execFile, spawn } from "node:child_process";
import { mkdir, open, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { BROWSER_SMOKE_ROUTE_IDS, normalizeBrowserSmokeOutcome, type BrowserSmokeObservation, type BrowserSmokeOutcome } from "#/lib/browser-bench/contract";
import { collectHostMeta } from "#/lib/bench/host.server";
import { groupRssBytes, killGroup, spawnMeasured, verifyProcessGroupCleanup, type MeasuredRun } from "#/lib/bench/runner.server";
import { aggregate } from "#/lib/bench/stats";
import type { Aggregate, HostMeta } from "#/lib/bench/types";
import { BROWSER_SMOKE_GREP, DEFAULT_WORKERS, PLAYWRIGHT_WORKER_COUNTS } from "./bench-e2e-runtimes";
import { WEBVIEW_RESULT_PREFIX, WEBVIEW_BACKENDS, type WebViewBackend } from "./run-e2e-webview";
import { startLocalE2EServer, waitForLocalE2EServerRelease } from "./lib/local-e2e-server";

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

export type BrowserOutcome = BrowserSmokeOutcome & { routeCount: number; setupOverhead: number; setupOverheadMs: number; inventory: number };
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
	serverRuntimeVersion: string;
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

export type BrowserExecutionTraceEntry = {
	profile: string;
	kind: BrowserSample["kind"];
	run: number;
	sequence: number;
	startedAt: string;
	finishedAt: string;
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
	screeningFinalists: string[];
	finalists: string[];
	finalistSchedule: string[][];
	executionTrace: BrowserExecutionTraceEntry[];
	locks: string[];
	serializedQueueThroughput: { profile: string; samplesPerMinute: number }[];
};

export const PLAYWRIGHT_PROFILES: readonly Profile[] = PLAYWRIGHT_WORKER_COUNTS.flatMap((workers) => (["node", "bun"] as const).map((runtime) => ({
	id: `playwright:${runtime}:${workers}`, arm: "playwright" as const, runtime, workers, phase: "cold" as const, views: 1 as const, smol: false,
	command: runtime === "node" ? ["mise", "exec", "node@24", "--", "node", "node_modules/@playwright/test/cli.js"] : ["bunx", "--bun", "playwright"],
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
	if (/^en post render:/.test(value)) return "en-post";
	if (/^pt-br post render:/.test(value)) return "pt-br-post";
	if (/^404:/.test(value)) return "not-found";
	if (/^\/pt-br\/ renders 200,/.test(value)) return "pt-br-index";
	if (/^(?:^|\s)\/ renders 200,/.test(value)) return "en-index";
	return undefined;
}

function collectPlaywrightSpecs(value: unknown, output: { title: string; passed: boolean; durationMs: number }[] = []): { title: string; passed: boolean; durationMs: number }[] {
	if (typeof value !== "object" || value === null) return output;
	const title = Reflect.get(value, "title");
	const tests = Reflect.get(value, "tests");
	if (typeof title === "string" && Array.isArray(tests)) {
		const statuses = tests.flatMap((test) => {
			if (typeof test !== "object" || test === null) return [];
			const results = Reflect.get(test, "results");
			return Array.isArray(results) ? results.map((result) => Reflect.get(result, "status")) : [Reflect.get(test, "status")];
		});
		const durationMs = tests.flatMap((test) => {
			if (typeof test !== "object" || test === null) return [];
			const results = Reflect.get(test, "results");
			return Array.isArray(results) ? results.map((result) => Reflect.get(result, "duration")) : [];
		}).reduce((sum, duration) => sum + (typeof duration === "number" ? duration : 0), 0);
		output.push({ title, passed: statuses.length > 0 && statuses.every((status) => status === "passed"), durationMs });
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
				return { ...normalized, routeCount: normalized.routes.length, setupOverhead: 0, setupOverheadMs: 0, inventory: normalized.routes.length };
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
	const setupSpecs = specs.filter((spec) => /^authenticate as admin$/i.test(spec.title));
	const unknownSpecs = specs.filter((spec) => !routeForTitle(spec.title) && !/^authenticate as admin$/i.test(spec.title));
	const routeSpecs = specs.filter((spec) => routeForTitle(spec.title));
	if (routeSpecs.length !== BROWSER_SMOKE_ROUTE_IDS.length || unknownSpecs.length > 0) return null;
	const routes: BrowserSmokeObservation[] = BROWSER_SMOKE_ROUTE_IDS.map((id) => {
		const matches = specs.filter((spec) => routeForTitle(spec.title) === id);
		return { id, passed: matches.length > 0 && matches.every((spec) => spec.passed) };
	});
	const normalized = normalizeBrowserSmokeOutcome({ routes });
	if (!normalized) return null;
	const inventory = expected + skipped + unexpected + flaky;
	if (inventory !== specs.length || setupSpecs.length !== inventory - BROWSER_SMOKE_ROUTE_IDS.length) return null;
	return { ...normalized, routeCount: normalized.routes.length, setupOverhead: setupSpecs.length, setupOverheadMs: setupSpecs.reduce((sum, spec) => sum + spec.durationMs, 0), inventory };
}

export function parseWebViewPassData(stdout: string): { outcomes: BrowserOutcome[]; passDurationsMs: number[]; runtimeVersion: string; backendVersion: string } {
	for (const line of stdout.split("\n").reverse()) {
		if (!line.startsWith(WEBVIEW_RESULT_PREFIX)) continue;
		try {
			const value = JSON.parse(line.slice(WEBVIEW_RESULT_PREFIX.length)) as { passOutcomes?: unknown; passDurationsMs?: unknown; runtimeVersion?: unknown; backendVersion?: unknown };
			if (!Array.isArray(value.passOutcomes)) return { outcomes: [], passDurationsMs: [], runtimeVersion: "unknown", backendVersion: "unknown" };
			const outcomes = value.passOutcomes.flatMap((routes) => {
				const normalized = normalizeBrowserSmokeOutcome({ routes });
				return normalized ? [{ ...normalized, routeCount: normalized.routes.length, setupOverhead: 0, setupOverheadMs: 0, inventory: normalized.routes.length }] : [];
			});
			const durations = Array.isArray(value.passDurationsMs) ? value.passDurationsMs : [];
			return { outcomes, passDurationsMs: durations.filter((duration): duration is number => typeof duration === "number" && Number.isFinite(duration)), runtimeVersion: typeof value.runtimeVersion === "string" ? value.runtimeVersion : "unknown", backendVersion: typeof value.backendVersion === "string" ? value.backendVersion : "unknown" };
		} catch { return { outcomes: [], passDurationsMs: [], runtimeVersion: "unknown", backendVersion: "unknown" }; }
	}
	return { outcomes: [], passDurationsMs: [], runtimeVersion: "unknown", backendVersion: "unknown" };
}

export function parseWebViewPassOutcomes(stdout: string): BrowserOutcome[] {
	return parseWebViewPassData(stdout).outcomes;
}

export function detectBrowserContamination(snapshot: string, cwd: string, ignoredPgid = 0): string | undefined {
	const rootPattern = /(?:[\s/]playwright(?:\.js)?\s+test|(?:^|\s)(?:npm exec playwright|bunx\s+--bun\s+playwright)\s+test|node_modules\/playwright\/lib\/worker|media-validation-host-proxy)/i;
	const rows = snapshot.split("\n").filter(Boolean).map((line) => {
		const fields = line.trim().split(/\s+/);
		return { line, pgid: Number(fields[1]), command: fields.slice(2).join(" ") };
	}).filter((row) => !row.line.includes(cwd) && Number.isFinite(row.pgid) && row.pgid !== ignoredPgid);
	const contaminatedGroups = new Set(rows.filter((row) => rootPattern.test(row.command)).map((row) => row.pgid));
	const matches = rows.filter((row) => contaminatedGroups.has(row.pgid)).map((row) => row.line);
	return matches.length ? matches.join(" | ") : undefined;
}

type Provenance = { runtimeVersion: string; browserVersion: string; serverRuntimeVersion: string };
const provenanceCache = new Map<string, Promise<Provenance>>();

export function runtimeVersionMatches(profile: Profile, version: string): boolean {
	if (profile.runtime === "node") return /^24\./.test(version);
	return /^1\.4\./.test(version);
}

async function runtimeVersionFor(profile: Profile): Promise<string> {
	const command = profile.runtime === "node"
		? ["mise", "exec", "node@24", "--", "node", "--version"]
		: ["bun", "--version"];
	const version = (await exec(command[0], command.slice(1))).stdout.trim().replace(/^v/, "");
	if (!runtimeVersionMatches(profile, version)) {
		throw new Error(`${profile.runtime} runtime mismatch: expected ${profile.runtime === "node" ? "24.x" : "1.4.x"}, got ${version}`);
	}
	return version;
}

async function detectProvenance(profile: Profile, backendVersion = "unknown"): Promise<Provenance> {
	const key = `${profile.arm}:${profile.runtime}:${profile.backend ?? ""}:${backendVersion}`;
	const cached = provenanceCache.get(key);
	if (cached) return cached;
	const pending = (async () => {
		let runtimeVersion = "unknown";
		try { runtimeVersion = await runtimeVersionFor(profile); } catch (error) { throw error; }
		let browserVersion = backendVersion;
		if (profile.arm === "playwright") {
			try {
				const executable = (await exec("mise", ["exec", "node@24", "--", "node", "-e", "process.stdout.write(require('playwright').chromium.executablePath())"])).stdout.trim();
				browserVersion = (await exec(executable, ["--version"])).stdout.trim();
			} catch { browserVersion = "unknown"; }
		}
		return { runtimeVersion, browserVersion, serverRuntimeVersion: await (async () => { try { return (await exec("bun", ["--version"])).stdout.trim(); } catch { return "unknown"; } })() };
	})();
	provenanceCache.set(key, pending);
	return pending;
}

async function externalBrowserContamination(ignoredPgid = 0): Promise<string | undefined> {
	try { return detectBrowserContamination((await exec("ps", ["-axo", "pid=,pgid=,command="])).stdout, process.cwd(), ignoredPgid); } catch { return undefined; }
}

async function measuredWithContamination(command: string[], waitForServerRelease = false): Promise<{ measured: MeasuredRun; contamination: ContaminationReport }> {
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
		if (waitForServerRelease) await waitForLocalE2EServerRelease();
		const after = await externalBrowserContamination();
		return { measured, contamination: { before, during, after, detected: Boolean(before || during || after) } };
	} finally { clearInterval(poll); }
}

function sampleFromRun(profile: Profile, kind: BrowserSample["kind"], run: number, measured: MeasuredRun, command: string[], boundary: Boundary, contamination: ContaminationReport, outcome = parseSmokeOutput(measured.stdout, profile.arm), durationMs: number | undefined = measured.ms, provenance: Provenance = { runtimeVersion: "unknown", browserVersion: "unknown", serverRuntimeVersion: "unknown" }): BrowserSample {
	const reasons: string[] = [];
	const effectiveDurationMs = durationMs ?? measured.ms;
	if (measured.timedOut) reasons.push("timed out");
	if (measured.exitCode !== 0) reasons.push(`exit code ${measured.exitCode}`);
	if (!outcome) reasons.push("missing smoke outcome");
	if (durationMs === undefined) reasons.push("missing per-pass duration");
	if (outcome && (!outcome.passed || outcome.routeCount !== BROWSER_SMOKE_ROUTE_IDS.length)) reasons.push("canonical route outcome mismatch");
	if (measured.cleanupVerified === false) reasons.push(`process cleanup failed: ${(measured.lingeringPids ?? []).join(",")}`);
	if (contamination.detected) reasons.push(`contaminated: ${contamination.before ?? contamination.during ?? contamination.after}`);
	return { profile: profile.id, kind, run, durationMs: effectiveDurationMs, peakRssBytes: measured.peakRssBytes, exitCode: measured.timedOut ? null : measured.exitCode, timedOut: measured.timedOut, outcome, valid: reasons.length === 0, ...(reasons.length === 0 ? {} : { exclusionReason: reasons.join("; ") }), command, boundary, cleanupVerified: measured.cleanupVerified !== false, contamination, rssTimeBytesMs: measured.peakRssBytes * effectiveDurationMs, runtimeVersion: provenance.runtimeVersion, browserVersion: provenance.browserVersion, serverRuntime: "bun", serverRuntimeVersion: provenance.serverRuntimeVersion, setupOverheadMs: outcome?.setupOverheadMs ?? 0 };
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

export function deriveFinalistSchedule(trace: BrowserExecutionTraceEntry[], repetitions: number): string[][] {
	const measured = trace.filter((entry) => entry.kind === "measured");
	return Array.from({ length: repetitions }, (_, index) => measured
		.filter((entry) => entry.run === index + 1)
		.sort((a, b) => a.sequence - b.sequence)
		.map((entry) => `${entry.profile}#${entry.run}`));
}

export function traceIsInterleaved(trace: BrowserExecutionTraceEntry[], profileIds: string[], repetitions: number): boolean {
	const schedule = deriveFinalistSchedule(trace, repetitions);
	return schedule.length === repetitions && schedule.every((round) => round.length === profileIds.length && new Set(round.map((entry) => entry.split("#")[0])).size === profileIds.length);
}

function aggregateSamples(samples: BrowserSample[]): Aggregate | null {
	return aggregate(samples.filter((sample) => sample.valid).map((sample) => ({ ms: sample.durationMs, peakRssBytes: sample.peakRssBytes, exitCode: sample.exitCode ?? -1, loadAvg1: 0 })));
}

type WarmPass = { measured: MeasuredRun; backendVersion: string; runtimeVersion: string; contamination: ContaminationReport };

function warmWebViewCommand(profile: Profile, baseUrl: string): string[] {
	return [...profile.command, "--external-server", `--backend=${profile.backend}`, `--views=${profile.views}`, "--passes=1", `--base-url=${baseUrl}`, "--persistent"];
}

async function startWarmWebViewSession(profile: Profile, baseUrl: string): Promise<{
	runPass: () => Promise<WarmPass>;
	close: () => Promise<boolean>;
}> {
	const child = spawn(warmWebViewCommand(profile, baseUrl)[0], warmWebViewCommand(profile, baseUrl).slice(1), {
		cwd: process.cwd(), detached: true, env: process.env, stdio: ["pipe", "pipe", "pipe"],
	});
	const pgid = child.pid ?? 0;
	let stdout = "";
	let stderr = "";
	const lines: string[] = [];
	let wake: (() => void) | undefined;
	const pushLine = (line: string) => { lines.push(line); wake?.(); wake = undefined; };
	child.stdout?.setEncoding("utf8");
	child.stderr?.setEncoding("utf8");
	let stdoutBuffer = "";
	child.stdout?.on("data", (chunk) => {
		stdout += String(chunk);
		stdoutBuffer += String(chunk);
		for (const line of stdoutBuffer.split("\n").slice(0, -1)) pushLine(line);
		stdoutBuffer = stdoutBuffer.slice(stdoutBuffer.lastIndexOf("\n") + 1);
	});
	child.stderr?.on("data", (chunk) => { stderr += String(chunk); });
	const closed = new Promise<number>((resolve) => child.once("close", (code) => resolve(code ?? -1)));
	const nextLine = async (): Promise<string> => {
		while (lines.length === 0) {
			const code = await Promise.race([closed, new Promise<"line">((resolve) => { wake = () => resolve("line"); })]);
			if (code !== "line") throw new Error(`warm WebView session exited with code ${code}: ${stderr.slice(-2000)}`);
		}
		return lines.shift()!;
	};
	const ready = await nextLine();
	if (!ready.startsWith("BROWSER_SMOKE_READY ")) throw new Error(`warm WebView session did not become ready: ${ready}`);
	const readyData = JSON.parse(ready.slice("BROWSER_SMOKE_READY ".length)) as { runtimeVersion: string; backendVersion: string };
	const runPass = async (): Promise<WarmPass> => {
		const contaminationBefore = await externalBrowserContamination(pgid);
		let peakRssBytes = await groupRssBytes(pgid);
		let sampling = false;
		let during: string | undefined;
		let polling = false;
		const contaminationPoll = setInterval(() => {
			if (polling) return;
			polling = true;
			externalBrowserContamination(pgid).then((value) => { if (value) during = during ? `${during} | ${value}` : value; }).finally(() => { polling = false; });
		}, 100);
		const sampler = setInterval(() => {
			if (sampling) return;
			sampling = true;
			groupRssBytes(pgid).then((rss) => { peakRssBytes = Math.max(peakRssBytes, rss); }).finally(() => { sampling = false; });
		}, 100);
		const started = performance.now();
		child.stdin?.write("pass\n");
		let line: string;
		try {
			line = await Promise.race([
				nextLine(),
				new Promise<never>((_, reject) => setTimeout(() => reject(new Error("warm WebView pass timed out")), SAMPLE_TIMEOUT_MS)),
			]);
		} finally { clearInterval(sampler); clearInterval(contaminationPoll); }
		const contaminationAfter = await externalBrowserContamination(pgid);
		const measured: MeasuredRun = {
			ms: performance.now() - started,
			peakRssBytes,
			exitCode: 0,
			loadAvg1: 0,
			stdout: line,
			stderr,
			stderrTail: stderr.slice(-4000),
			timedOut: false,
			pgid,
			cleanupVerified: true,
			lingeringPids: [],
		};
		const data = parseWebViewPassData(line);
		if (contaminationBefore || contaminationAfter) {
			measured.stdout = `${line}\nWARM_CONTAMINATED ${contaminationBefore ?? contaminationAfter}`;
		}
		return { measured, backendVersion: data.backendVersion === "unknown" ? readyData.backendVersion : data.backendVersion, runtimeVersion: data.runtimeVersion === "unknown" ? readyData.runtimeVersion : data.runtimeVersion, contamination: { before: contaminationBefore, during, after: contaminationAfter, detected: Boolean(contaminationBefore || during || contaminationAfter) } };
	};
	return {
		runPass,
		close: async () => {
			child.stdin?.end();
			await Promise.race([closed, new Promise<void>((resolve) => setTimeout(resolve, 5000))]);
			if ((await verifyProcessGroupCleanup(pgid)).verified) return true;
			killGroup(pgid, "SIGKILL");
			return (await verifyProcessGroupCleanup(pgid)).verified;
		},
	};
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
				const data = parseWebViewPassData(result.measured.stdout);
				const detected = await detectProvenance(profile, data.backendVersion);
				const provenance = { ...detected, runtimeVersion: data.runtimeVersion === "unknown" ? detected.runtimeVersion : data.runtimeVersion };
				return sampleFromRun(profile, kind, run, result.measured, actual, boundary, result.contamination, data.outcomes[0] ?? null, data.passDurationsMs[0] ?? result.measured.ms, provenance);
			} finally { await server.stop(); }
		}
		const result = await measuredWithContamination(command, true);
		return sampleFromRun(profile, kind, run, result.measured, command, boundary, result.contamination, undefined, undefined, await detectProvenance(profile));
	};
	if (profile.arm === "webview" && profile.phase === "warm") {
		const server = await startLocalE2EServer({ quiet: true });
		try {
			const actual = commandForProfile(profile, server.baseUrl, repetitions + 1);
			const result = await measuredWithContamination(actual);
			const data = parseWebViewPassData(result.measured.stdout);
			const detected = await detectProvenance(profile, data.backendVersion);
			const provenance = { ...detected, runtimeVersion: data.runtimeVersion === "unknown" ? detected.runtimeVersion : data.runtimeVersion };
			warmup = sampleFromRun(profile, "warmup", 0, result.measured, actual, boundary, result.contamination, data.outcomes[0] ?? null, data.passDurationsMs[0] ?? result.measured.ms, provenance);
			for (let index = 0; index < repetitions; index += 1) samples.push(sampleFromRun(profile, "measured", index + 1, result.measured, actual, boundary, result.contamination, data.outcomes[index + 1] ?? null, data.passDurationsMs[index + 1], provenance));
		} finally { await server.stop(); }
	} else {
		warmup = await runOne("warmup", 0);
		let attempt = 0;
		while (samples.filter((sample) => sample.valid).length < repetitions && attempt < repetitions + 5) { attempt += 1; samples.push(await runOne("measured", attempt)); }
	}
	const validSamples = samples.filter((sample) => sample.valid);
	const invalidReasons = [
		...(warmup.valid ? [] : [`warmup: ${warmup.exclusionReason}`]),
	];
	if (validSamples.length !== repetitions) invalidReasons.push(`expected ${repetitions} valid samples, got ${validSamples.length}`);
	if (invalidReasons.length === 0 && warmup.valid && validSamples.length === repetitions) invalidReasons.length = 0;
	return { profile, warmup, samples, aggregate: aggregateSamples(samples), valid: warmup.valid && validSamples.length === repetitions, invalidReasons, nonDominated: false, interleaved: false };
}

async function runColdMeasuredSample(profile: Profile, run: number): Promise<BrowserSample> {
	const boundary = sampleBoundary(profile);
	if (profile.arm === "webview") {
		const server = await startLocalE2EServer({ quiet: true });
		try {
			const actual = commandForProfile(profile, server.baseUrl);
			const result = await measuredWithContamination(actual);
			const data = parseWebViewPassData(result.measured.stdout);
			const detected = await detectProvenance(profile, data.backendVersion);
			const provenance = { ...detected, runtimeVersion: data.runtimeVersion === "unknown" ? detected.runtimeVersion : data.runtimeVersion };
			return sampleFromRun(profile, "measured", run, result.measured, actual, boundary, result.contamination, data.outcomes[0] ?? null, data.passDurationsMs[0], provenance);
		} finally { await server.stop(); }
	}
	const command = commandForProfile(profile);
	const result = await measuredWithContamination(command, true);
	return sampleFromRun(profile, "measured", run, result.measured, command, boundary, result.contamination, undefined, undefined, await detectProvenance(profile));
}

async function runColdFinalistsInterleaved(
	profiles: Profile[],
	repetitions: number,
): Promise<{ states: Map<string, BrowserProfileResult>; trace: BrowserExecutionTraceEntry[] }> {
	const states = new Map<string, BrowserProfileResult>();
	const trace: BrowserExecutionTraceEntry[] = [];
	let sequence = 0;
	for (const profile of profiles) {
		const initial = await runProfile(profile, 1);
		const measured = initial.samples.find((sample) => sample.valid) ?? initial.samples[0];
		states.set(profile.id, { ...initial, samples: measured ? [measured] : [], excludedSamples: initial.samples.filter((sample) => sample !== measured), invalidReasons: initial.warmup.valid && measured?.valid ? [] : [...initial.invalidReasons], interleaved: true });
		trace.push({ profile: profile.id, kind: "warmup", run: 0, sequence: sequence++, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
		if (measured) trace.push({ profile: profile.id, kind: "measured", run: 1, sequence: sequence++, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
	}
	let round = 1;
	while ([...states.values()].some((state) => state.samples.filter((sample) => sample.valid).length < repetitions) && round <= repetitions + 5) {
		const order = round % 2 === 1 ? profiles : [...profiles].reverse();
		for (const profile of order) {
			const state = states.get(profile.id)!;
			const sample = await runColdMeasuredSample(profile, round + 1);
			trace.push({ profile: profile.id, kind: "measured", run: round + 1, sequence: sequence++, startedAt: new Date().toISOString(), finishedAt: new Date().toISOString() });
			if (sample.valid) state.samples.push(sample);
			else state.excludedSamples?.push(sample);
		}
		round += 1;
	}
	for (const state of states.values()) {
		const validCount = state.samples.filter((sample) => sample.valid).length;
		if (validCount !== repetitions) state.invalidReasons.push(`expected ${repetitions} interleaved valid samples, got ${validCount}`);
		state.aggregate = aggregateSamples(state.samples);
		state.valid = state.warmup.valid && validCount === repetitions;
		if (state.valid) state.invalidReasons = [];
	}
	for (const state of states.values()) state.interleaved = traceIsInterleaved(trace, profiles.map((profile) => profile.id), repetitions);
	return { states, trace };
}

async function runWarmFinalistsInterleaved(profiles: Profile[], repetitions: number): Promise<{ states: Map<string, BrowserProfileResult>; trace: BrowserExecutionTraceEntry[] }> {
	const states = new Map<string, BrowserProfileResult>();
	const sessions = new Map<string, Awaited<ReturnType<typeof startWarmWebViewSession>>>();
	const servers = new Map<string, Awaited<ReturnType<typeof startLocalE2EServer>>>();
	let sharedServer: Awaited<ReturnType<typeof startLocalE2EServer>> | undefined;
	const trace: BrowserExecutionTraceEntry[] = [];
	let sequence = 0;
	try {
		sharedServer = await startLocalE2EServer({ quiet: true });
		for (const profile of profiles) {
			servers.set(profile.id, sharedServer);
			const session = await startWarmWebViewSession(profile, sharedServer.baseUrl);
			sessions.set(profile.id, session);
		}
		for (const profile of profiles) {
			const session = sessions.get(profile.id)!;
			const startedAt = new Date().toISOString();
			const pass = await session.runPass();
			const data = parseWebViewPassData(pass.measured.stdout);
			if (!runtimeVersionMatches(profile, pass.runtimeVersion)) throw new Error(`${profile.runtime} runtime mismatch: expected 1.4.x, got ${pass.runtimeVersion}`);
			const detected = await detectProvenance(profile, pass.backendVersion);
			const provenance = { ...detected, runtimeVersion: pass.runtimeVersion };
			const warmup = sampleFromRun(profile, "warmup", 0, pass.measured, warmWebViewCommand(profile, servers.get(profile.id)!.baseUrl), sampleBoundary(profile), pass.contamination, data.outcomes[0] ?? null, data.passDurationsMs[0] ?? pass.measured.ms, provenance);
			trace.push({ profile: profile.id, kind: "warmup", run: 0, sequence: sequence++, startedAt, finishedAt: new Date().toISOString() });
			states.set(profile.id, { profile, warmup, samples: [], aggregate: null, valid: false, invalidReasons: [], nonDominated: false, interleaved: false });
		}
		for (let round = 1; round <= repetitions; round += 1) {
			const order = round % 2 === 1 ? profiles : [...profiles].reverse();
			for (const profile of order) {
				const session = sessions.get(profile.id)!;
				const startedAt = new Date().toISOString();
				const pass = await session.runPass();
				const data = parseWebViewPassData(pass.measured.stdout);
				if (!runtimeVersionMatches(profile, pass.runtimeVersion)) throw new Error(`${profile.runtime} runtime mismatch: expected 1.4.x, got ${pass.runtimeVersion}`);
				const detected = await detectProvenance(profile, pass.backendVersion);
				const provenance = { ...detected, runtimeVersion: pass.runtimeVersion };
				const sample = sampleFromRun(profile, "measured", round, pass.measured, warmWebViewCommand(profile, servers.get(profile.id)!.baseUrl), sampleBoundary(profile), pass.contamination, data.outcomes[0] ?? null, data.passDurationsMs[0] ?? pass.measured.ms, provenance);
				states.get(profile.id)!.samples.push(sample);
				trace.push({ profile: profile.id, kind: "measured", run: round, sequence: sequence++, startedAt, finishedAt: new Date().toISOString() });
			}
		}
	} finally {
		const cleanup = await Promise.all([...sessions.entries()].map(async ([id, session]) => [id, await session.close()] as const));
		for (const [id, verified] of cleanup) {
			const state = states.get(id);
			if (!state || verified) continue;
			for (const sample of [state.warmup, ...state.samples]) {
				sample.cleanupVerified = false;
				sample.valid = false;
				sample.exclusionReason = "warm WebView process cleanup failed";
			}
		}
		await sharedServer?.stop();
	}
	for (const state of states.values()) {
		const validCount = state.samples.filter((sample) => sample.valid).length;
		state.interleaved = traceIsInterleaved(trace, profiles.map((profile) => profile.id), repetitions);
		state.invalidReasons = state.warmup.valid ? [] : [`warmup: ${state.warmup.exclusionReason}`];
		if (validCount !== repetitions) state.invalidReasons.push(`expected ${repetitions} valid samples, got ${validCount}`);
		if (!state.interleaved) state.invalidReasons.push("execution trace is not interleaved");
		state.aggregate = aggregateSamples(state.samples);
		state.valid = state.warmup.valid && validCount === repetitions && state.interleaved;
		if (state.valid) state.invalidReasons = [];
	}
	return { states, trace };
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

export function rssTimeGiBSeconds(medianMs: number, medianPeakRssBytes: number): number {
	return (medianMs / 1000) * (medianPeakRssBytes / (1024 ** 3));
}

export function renderBrowserBenchmark(run: BrowserBenchmarkRun): string {
	const lines = ["# Browser runtime revalidation", "", `- Commit: \`${run.commit}\``, `- Timestamp: ${run.timestamp}`, `- Host: ${run.host.host} (${run.host.cpuModel}, ${run.host.cores} cores)`, `- Canonical outcomes per sample: ${run.canonicalRoutes} (route identities retained in JSON)`, `- Protocol: one discarded warm-up + ${run.screeningRepetitions} screening samples; finalists confirm with ${run.repetitions} valid interleaved samples`, `- Locks: ${run.locks.join(", ")}`, "", "| Profile | Valid | Median | Peak RSS | RSS×time | Samples | Disposition |", "| --- | --- | ---: | ---: | ---: | ---: | --- |"];
	for (const result of run.profiles) {
		const aggregateResult = result.aggregate;
		lines.push(`| ${result.profile.id} | ${result.valid ? "yes" : "no"} | ${aggregateResult ? `${aggregateResult.medianMs.toFixed(2)} ms` : "—"} | ${aggregateResult ? bytes(aggregateResult.medianPeakRssBytes) : "—"} | ${aggregateResult ? `${rssTimeGiBSeconds(aggregateResult.medianMs, aggregateResult.medianPeakRssBytes).toFixed(2)} GiB·s` : "—"} | ${result.samples.filter((sample) => sample.valid).length}/${run.repetitions} | ${run.finalists.includes(result.profile.id) ? "finalist" : result.invalidReasons.join("; ") || "discarded"} |`);
	}
	lines.push("", `Finalists: ${run.finalists.length ? run.finalists.join(", ") : "none"}.`, "", "Setup-project overhead is retained on each Playwright sample and excluded from the five-route outcome count.", "WebView remains experimental and local-only; Playwright retains full E2E coverage.", "");
	return lines.join("\n");
}

function parseArgs(args: string[]): { repetitions: number; profiles: Profile[]; confirmOnly: boolean } {
	let repetitions = DEFAULT_REPETITIONS;
	let profiles = [...ALL_PROFILES];
	let confirmOnly = false;
	for (const arg of args) {
		if (arg.startsWith("--repetitions=")) repetitions = Number(arg.slice(14));
		else if (arg.startsWith("--profile=")) { const id = arg.slice("--profile=".length); profiles = ALL_PROFILES.filter((profile) => profile.id === id); if (!profiles.length) throw new Error(`unknown browser profile: ${id}`); }
		else if (arg.startsWith("--profiles=")) {
			const ids = arg.slice("--profiles=".length).split(",").filter(Boolean);
			profiles = ALL_PROFILES.filter((profile) => ids.includes(profile.id));
			if (profiles.length !== ids.length) throw new Error("--profiles contains an unknown browser profile");
		}
		else if (arg === "--confirm-only") confirmOnly = true;
		else if (arg === "--help") { console.log("Usage: bun run scripts/bench-browser-runtimes.ts [--repetitions=N] [--profile=ID]"); process.exit(0); }
		else throw new Error(`unknown argument: ${arg}`);
	}
	if (!Number.isInteger(repetitions) || repetitions < 1) throw new Error("--repetitions must be a positive integer");
	return { repetitions, profiles, confirmOnly };
}

export async function runBrowserConfirmations(repetitions: number, profiles: Profile[]): Promise<BrowserBenchmarkRun> {
	if (!profiles.length) throw new Error("at least one confirmation profile is required");
	const coldResult = await runColdFinalistsInterleaved(profiles.filter((profile) => profile.phase === "cold"), repetitions);
	const warmResult = await runWarmFinalistsInterleaved(profiles.filter((profile) => profile.phase === "warm"), repetitions);
	const confirmed = new Map([...coldResult.states, ...warmResult.states]);
	const executionTrace = [...coldResult.trace, ...warmResult.trace];
	const results = profiles.map((profile) => confirmed.get(profile.id)!);
	const finalists = selectNonDominated(results);
	for (const result of results) result.nonDominated = finalists.includes(result.profile.id);
	return { schemaVersion: 2, commit: await commit(), timestamp: new Date().toISOString(), host: await collectHostMeta(), repetitions, screeningRepetitions: 0, warmupsPerProfile: WARMUP_COUNT, canonicalRoutes: BROWSER_SMOKE_ROUTE_IDS.length, profiles: results, screeningFinalists: profiles.map((profile) => profile.id), finalists, finalistSchedule: deriveFinalistSchedule(executionTrace, repetitions), executionTrace, locks: ["/tmp/praxis-playwright.lock", join(tmpdir(), "creatista-test.lock")], serializedQueueThroughput: results.map((result) => ({ profile: result.profile.id, samplesPerMinute: result.aggregate?.medianMs ? 60_000 / result.aggregate.medianMs : 0 })) };
}

export async function runBrowserBenchmark(repetitions = DEFAULT_REPETITIONS, profiles: Profile[] = [...ALL_PROFILES]): Promise<BrowserBenchmarkRun> {
	const screening: BrowserProfileResult[] = [];
	for (const profile of profiles) screening.push(await runProfile(profile, SCREENING_REPETITIONS));
	const screeningFinalists = selectNonDominated(screening.map((result) => ({ ...result, interleaved: true })));
	if (screeningFinalists.length === 0) {
		screeningFinalists.push(...screening.filter((result) => result.valid && result.aggregate).map((result) => result.profile.id));
	}
	const coldResult = await runColdFinalistsInterleaved(
		profiles.filter((candidate) => screeningFinalists.includes(candidate.id) && candidate.phase === "cold"),
		repetitions,
	);
	const warmConfirmed = await runWarmFinalistsInterleaved(profiles.filter((candidate) => screeningFinalists.includes(candidate.id) && candidate.phase === "warm"), repetitions);
	const confirmed = new Map([...coldResult.states, ...warmConfirmed.states]);
	const executionTrace = [...coldResult.trace, ...warmConfirmed.trace];
	const finalistSchedule = deriveFinalistSchedule(executionTrace, repetitions);
	for (const profile of profiles.filter((candidate) => confirmed.has(candidate.id))) {
		const result = confirmed.get(profile.id)!;
		const prior = screening.find((candidate) => candidate.profile.id === profile.id);
		if (prior) result.screening = { warmup: prior.warmup, samples: prior.samples };
	}
	const results = profiles.map((profile) => confirmed.get(profile.id) ?? screening.find((result) => result.profile.id === profile.id)!);
	const finalists = selectNonDominated(results);
	for (const result of results) result.nonDominated = finalists.includes(result.profile.id);
	return { schemaVersion: 2, commit: await commit(), timestamp: new Date().toISOString(), host: await collectHostMeta(), repetitions, screeningRepetitions: SCREENING_REPETITIONS, warmupsPerProfile: WARMUP_COUNT, canonicalRoutes: BROWSER_SMOKE_ROUTE_IDS.length, profiles: results, screeningFinalists, finalists, finalistSchedule, executionTrace, locks: ["/tmp/praxis-playwright.lock", join(tmpdir(), "creatista-test.lock")], serializedQueueThroughput: results.map((result) => ({ profile: result.profile.id, samplesPerMinute: result.aggregate?.medianMs ? 60_000 / result.aggregate.medianMs : 0 })) };
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	if (!process.env.BROWSER_BENCH_LOCKED) {
		const antclipsLock = join(tmpdir(), "creatista-test.lock");
		const scriptPath = fileURLToPath(import.meta.url);
		await exec("lockf", ["-ks", antclipsLock, process.execPath, scriptPath, ...args], { env: { ...process.env, BROWSER_BENCH_LOCKED: "1" } });
		return;
	}
	const options = parseArgs(args);
	const run = options.confirmOnly ? await runBrowserConfirmations(options.repetitions, options.profiles) : await runBrowserBenchmark(options.repetitions, options.profiles);
	const stem = await reserveStem(run.timestamp);
	await writeFile(join(BENCHMARK_DIR, `${stem}.json`), `${JSON.stringify(run, null, 2)}\n`, "utf8");
	await writeFile(join(BENCHMARK_DIR, `${stem}.md`), `${renderBrowserBenchmark(run)}\n`, "utf8");
	console.log(`JSON: ${join(BENCHMARK_DIR, `${stem}.json`)}`);
	console.log(`Markdown: ${join(BENCHMARK_DIR, `${stem}.md`)}`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
