#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { performance } from "node:perf_hooks";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import {
	assessScenario,
	type E2EPageSnapshot,
	type E2EPassOutcome,
	E2E_SESSION_RESULT_PREFIX,
	E2E_SMOKE_RESULT_PREFIX,
	E2E_SMOKE_SCENARIOS,
	type E2EScenarioResult,
	type E2ESessionOutcome,
	type E2ESmokeArm,
	type E2ESmokeOutcome,
	E2E_VIEWPORT,
	PAGE_SNAPSHOT_EXPRESSION,
} from "#/lib/e2e-bench";
import { startLocalE2EServer } from "./lib/local-e2e-server";

const exec = promisify(execFile);

function browserCommandMarker(executable: string): string {
	const appIndex = executable.indexOf(".app/");
	return appIndex === -1 ? dirname(executable) : executable.slice(0, appIndex + 4);
}

async function browserProcesses(executable: string): Promise<Map<number, number>> {
	const marker = browserCommandMarker(executable);
	const { stdout } = await exec("ps", ["-axo", "pid=,rss=,command="]);
	const processes = new Map<number, number>();
	for (const line of stdout.split("\n")) {
		const match = /^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line);
		if (!match || !match[3].includes(marker)) continue;
		processes.set(Number.parseInt(match[1], 10), Number.parseInt(match[2], 10) * 1024);
	}
	return processes;
}

async function browserRssAfterLaunch(
	executable: string,
	baseline: Map<number, number>,
): Promise<number> {
	const current = await browserProcesses(executable);
	let bytes = 0;
	for (const [pid, rss] of current) {
		if (!baseline.has(pid)) bytes += rss;
	}
	return bytes;
}

function playwrightVersion(): string {
	const packageJson = JSON.parse(
		readFileSync(
			new URL("../node_modules/@playwright/test/package.json", import.meta.url),
			"utf8",
		),
	) as { version?: unknown };
	return typeof packageJson.version === "string"
		? packageJson.version
		: "unknown";
}

function snapshotOf(value: unknown): E2EPageSnapshot {
	if (typeof value !== "object" || value === null)
		throw new Error("browser returned an invalid page snapshot");
	const snapshot = value as Record<string, unknown>;
	if (
		typeof snapshot.readyState !== "string" ||
		typeof snapshot.lang !== "string" ||
		!Array.isArray(snapshot.headings) ||
		!snapshot.headings.every((heading) => typeof heading === "string") ||
		typeof snapshot.bodyText !== "string" ||
		(snapshot.canonical !== null && typeof snapshot.canonical !== "string")
	)
		throw new Error("browser returned a malformed page snapshot");
	return snapshot as E2EPageSnapshot;
}

function screenshotPath(arm: E2ESmokeArm, scenarioId: string): string {
	const dir = join(process.cwd(), "test-results", "webview-benchmark");
	mkdirSync(dir, { recursive: true });
	return join(dir, `${arm}-${scenarioId}.png`);
}

type BrowserSession = {
	arm: E2ESmokeArm;
	automationVersion: string;
	browserExecutable: string;
	runPass: () => Promise<E2EPassOutcome>;
	close: () => Promise<void>;
};

async function runScenarioPass(input: {
	arm: E2ESmokeArm;
	browserExecutable: string;
	baseline: Map<number, number>;
	baseUrl: string;
	navigate: (url: string) => Promise<void>;
	evaluate: () => Promise<unknown>;
	screenshot: (path: string) => Promise<void>;
}): Promise<E2EPassOutcome> {
	const started = performance.now();
	const scenarios: E2EScenarioResult[] = [];
	for (const scenario of E2E_SMOKE_SCENARIOS) {
		try {
			await input.navigate(new URL(scenario.path, input.baseUrl).href);
			const result = assessScenario(scenario, snapshotOf(await input.evaluate()));
			scenarios.push(result);
			if (!result.passed)
				await input.screenshot(screenshotPath(input.arm, scenario.id));
		} catch (error) {
			scenarios.push({
				id: scenario.id,
				passed: false,
				error: error instanceof Error ? error.message : String(error),
			});
			await input
				.screenshot(screenshotPath(input.arm, scenario.id))
				.catch(() => {});
		}
	}
	const browserRssBytes = await browserRssAfterLaunch(
		input.browserExecutable,
		input.baseline,
	);
	return {
		durationMs: performance.now() - started,
		browserRssBytes,
		scenarios,
	};
}

async function openPlaywrightSession(baseUrl: string): Promise<BrowserSession> {
	const browserExecutable = chromium.executablePath();
	const baseline = await browserProcesses(browserExecutable);
	const browser = await chromium.launch({
		headless: true,
		executablePath: browserExecutable,
	});
	const context = await browser.newContext({ viewport: E2E_VIEWPORT });
	const page = await context.newPage();
	return {
		arm: "playwright",
		automationVersion: playwrightVersion(),
		browserExecutable,
		runPass: () =>
			runScenarioPass({
				arm: "playwright",
				browserExecutable,
				baseline,
				baseUrl,
				navigate: async (url) => {
					await page.goto(url, { waitUntil: "load" });
				},
				evaluate: () => page.evaluate(PAGE_SNAPSHOT_EXPRESSION),
				screenshot: async (path) => {
					await page.screenshot({ path });
				},
			}),
		close: () => browser.close(),
	};
}

async function openWebViewSession(baseUrl: string): Promise<BrowserSession> {
	const browserExecutable = chromium.executablePath();
	const baseline = await browserProcesses(browserExecutable);
	const view = new Bun.WebView({
		width: E2E_VIEWPORT.width,
		height: E2E_VIEWPORT.height,
		dataStore: "ephemeral",
		backend: {
			type: "chrome",
			path: browserExecutable,
			url: false,
		},
	});
	return {
		arm: "webview",
		automationVersion: Bun.version,
		browserExecutable,
		runPass: () =>
			runScenarioPass({
				arm: "webview",
				browserExecutable,
				baseline,
				baseUrl,
				navigate: (url) => view.navigate(url),
				evaluate: () => view.evaluate(PAGE_SNAPSHOT_EXPRESSION),
				screenshot: async (path) => {
					await Bun.write(path, await view.screenshot());
				},
			}),
		close: async () => {
			view.close();
		},
	};
}

async function openSession(
	arm: E2ESmokeArm,
	baseUrl: string,
): Promise<BrowserSession> {
	return arm === "playwright"
		? openPlaywrightSession(baseUrl)
		: openWebViewSession(baseUrl);
}

function provenance(session: BrowserSession) {
	return {
		schemaVersion: 1 as const,
		arm: session.arm,
		runtime: "bun" as const,
		runtimeVersion: Bun.version,
		automationVersion: session.automationVersion,
		browserExecutable: session.browserExecutable,
		viewport: E2E_VIEWPORT,
	};
}

export async function runE2ESmokeArm(
	arm: E2ESmokeArm,
	baseUrl: string,
): Promise<E2ESmokeOutcome> {
	const session = await openSession(arm, baseUrl);
	try {
		return { ...provenance(session), ...(await session.runPass()) };
	} finally {
		await session.close();
	}
}

export async function runE2ESmokeSession(
	arm: E2ESmokeArm,
	baseUrl: string,
	measuredPasses: number,
): Promise<E2ESessionOutcome> {
	const session = await openSession(arm, baseUrl);
	try {
		const warmup = await session.runPass();
		const passes: E2EPassOutcome[] = [];
		for (let index = 0; index < measuredPasses; index += 1)
			passes.push(await session.runPass());
		return { ...provenance(session), warmup, passes };
	} finally {
		await session.close();
	}
}

type CliOptions = {
	arm: E2ESmokeArm;
	baseUrl: string;
	externalServer: boolean;
	sessionPasses: number | null;
};

function parseCli(args: string[]): CliOptions {
	let arm: E2ESmokeArm = "webview";
	let baseUrl = "http://localhost:4173";
	let externalServer = false;
	let sessionPasses: number | null = null;
	for (const arg of args) {
		if (arg === "--external-server") externalServer = true;
		else if (arg.startsWith("--arm=")) {
			const value = arg.slice("--arm=".length);
			if (value !== "playwright" && value !== "webview")
				throw new Error(`Unknown E2E smoke arm: ${value}`);
			arm = value;
		} else if (arg.startsWith("--base-url=")) {
			baseUrl = new URL(arg.slice("--base-url=".length)).href;
		} else if (arg.startsWith("--session-passes=")) {
			sessionPasses = Number.parseInt(
				arg.slice("--session-passes=".length),
				10,
			);
			if (
				!Number.isInteger(sessionPasses) ||
				sessionPasses < 1 ||
				sessionPasses > 50
			)
				throw new Error("--session-passes must be an integer between 1 and 50");
		} else throw new Error(`Unknown argument: ${arg}`);
	}
	return { arm, baseUrl, externalServer, sessionPasses };
}

function passFailed(pass: E2EPassOutcome): boolean {
	return pass.scenarios.some((scenario) => !scenario.passed);
}

async function main(): Promise<void> {
	const options = parseCli(process.argv.slice(2));
	const server = options.externalServer
		? null
		: await startLocalE2EServer({ quiet: false });
	try {
		const baseUrl = server?.baseUrl ?? options.baseUrl;
		if (options.sessionPasses !== null) {
			const outcome = await runE2ESmokeSession(
				options.arm,
				baseUrl,
				options.sessionPasses,
			);
			console.log(
				`${E2E_SESSION_RESULT_PREFIX}${JSON.stringify(outcome)}`,
			);
			if (passFailed(outcome.warmup) || outcome.passes.some(passFailed))
				process.exitCode = 1;
			return;
		}

		const outcome = await runE2ESmokeArm(options.arm, baseUrl);
		for (const scenario of outcome.scenarios)
			console.log(
				`${scenario.passed ? "PASS" : "FAIL"} ${scenario.id}${scenario.error ? `: ${scenario.error}` : ""}`,
			);
		console.log(`${E2E_SMOKE_RESULT_PREFIX}${JSON.stringify(outcome)}`);
		if (passFailed(outcome)) process.exitCode = 1;
	} finally {
		await server?.stop();
	}
}

if (import.meta.main)
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
