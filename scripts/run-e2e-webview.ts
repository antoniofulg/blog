#!/usr/bin/env bun
import { execFile } from "node:child_process";
import { mkdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { promisify } from "node:util";
import { chromium } from "@playwright/test";
import {
	assessScenario,
	type E2EPageSnapshot,
	E2E_SMOKE_RESULT_PREFIX,
	E2E_SMOKE_SCENARIOS,
	type E2EScenarioResult,
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
	if (typeof value !== "object" || value === null) {
		throw new Error("browser returned an invalid page snapshot");
	}
	const snapshot = value as Record<string, unknown>;
	if (
		typeof snapshot.readyState !== "string" ||
		typeof snapshot.lang !== "string" ||
		!Array.isArray(snapshot.headings) ||
		!snapshot.headings.every((heading) => typeof heading === "string") ||
		typeof snapshot.bodyText !== "string" ||
		(snapshot.canonical !== null && typeof snapshot.canonical !== "string")
	) {
		throw new Error("browser returned a malformed page snapshot");
	}
	return snapshot as E2EPageSnapshot;
}

async function runPlaywright(baseUrl: string): Promise<E2ESmokeOutcome> {
	const browserExecutable = chromium.executablePath();
	const baseline = await browserProcesses(browserExecutable);
	const browser = await chromium.launch({
		headless: true,
		executablePath: browserExecutable,
	});
	const context = await browser.newContext({ viewport: E2E_VIEWPORT });
	const page = await context.newPage();
	const scenarios: E2EScenarioResult[] = [];
	let browserRssBytes = 0;
	try {
		for (const scenario of E2E_SMOKE_SCENARIOS) {
			try {
				await page.goto(new URL(scenario.path, baseUrl).href, {
					waitUntil: "load",
				});
				const snapshot = snapshotOf(
					await page.evaluate(PAGE_SNAPSHOT_EXPRESSION),
				);
				scenarios.push(assessScenario(scenario, snapshot));
			} catch (error) {
				scenarios.push({
					id: scenario.id,
					passed: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		browserRssBytes = await browserRssAfterLaunch(browserExecutable, baseline);
	} finally {
		await browser.close();
	}
	return {
		schemaVersion: 1,
		arm: "playwright",
		runtime: "bun",
		runtimeVersion: Bun.version,
		automationVersion: playwrightVersion(),
		browserExecutable,
		browserRssBytes,
		viewport: E2E_VIEWPORT,
		scenarios,
	};
}

async function writeFailureScreenshot(
	view: Bun.WebView,
	scenarioId: string,
): Promise<void> {
	const dir = join(process.cwd(), "test-results", "webview");
	mkdirSync(dir, { recursive: true });
	await Bun.write(join(dir, `${scenarioId}.png`), await view.screenshot());
}

async function runWebView(baseUrl: string): Promise<E2ESmokeOutcome> {
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
	const scenarios: E2EScenarioResult[] = [];
	let browserRssBytes = 0;
	try {
		for (const scenario of E2E_SMOKE_SCENARIOS) {
			try {
				await view.navigate(new URL(scenario.path, baseUrl).href);
				const result = assessScenario(
					scenario,
					snapshotOf(await view.evaluate(PAGE_SNAPSHOT_EXPRESSION)),
				);
				scenarios.push(result);
				if (!result.passed) await writeFailureScreenshot(view, scenario.id);
			} catch (error) {
				scenarios.push({
					id: scenario.id,
					passed: false,
					error: error instanceof Error ? error.message : String(error),
				});
				await writeFailureScreenshot(view, scenario.id).catch(() => {});
			}
		}
		browserRssBytes = await browserRssAfterLaunch(browserExecutable, baseline);
	} finally {
		view.close();
	}
	return {
		schemaVersion: 1,
		arm: "webview",
		runtime: "bun",
		runtimeVersion: Bun.version,
		automationVersion: Bun.version,
		browserExecutable,
		browserRssBytes,
		viewport: E2E_VIEWPORT,
		scenarios,
	};
}

export async function runE2ESmokeArm(
	arm: E2ESmokeArm,
	baseUrl: string,
): Promise<E2ESmokeOutcome> {
	return arm === "playwright"
		? runPlaywright(baseUrl)
		: runWebView(baseUrl);
}

type CliOptions = {
	arm: E2ESmokeArm;
	baseUrl: string;
	externalServer: boolean;
};

function parseCli(args: string[]): CliOptions {
	let arm: E2ESmokeArm = "webview";
	let baseUrl = "http://localhost:4173";
	let externalServer = false;
	for (const arg of args) {
		if (arg === "--external-server") externalServer = true;
		else if (arg.startsWith("--arm=")) {
			const value = arg.slice("--arm=".length);
			if (value !== "playwright" && value !== "webview") {
				throw new Error(`Unknown E2E smoke arm: ${value}`);
			}
			arm = value;
		} else if (arg.startsWith("--base-url=")) {
			baseUrl = new URL(arg.slice("--base-url=".length)).href;
		} else {
			throw new Error(`Unknown argument: ${arg}`);
		}
	}
	return { arm, baseUrl, externalServer };
}

async function main(): Promise<void> {
	const options = parseCli(process.argv.slice(2));
	const server = options.externalServer
		? null
		: await startLocalE2EServer({ quiet: false });
	try {
		const outcome = await runE2ESmokeArm(
			options.arm,
			server?.baseUrl ?? options.baseUrl,
		);
		for (const scenario of outcome.scenarios) {
			console.log(
				`${scenario.passed ? "PASS" : "FAIL"} ${scenario.id}${scenario.error ? `: ${scenario.error}` : ""}`,
			);
		}
		console.log(`${E2E_SMOKE_RESULT_PREFIX}${JSON.stringify(outcome)}`);
		if (outcome.scenarios.some((scenario) => !scenario.passed)) {
			process.exitCode = 1;
		}
	} finally {
		await server?.stop();
	}
}

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
