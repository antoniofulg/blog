#!/usr/bin/env bun
import {
	BROWSER_SMOKE_ROUTES,
	normalizeBrowserSmokeOutcome,
	type BrowserSmokeObservation,
	type BrowserSmokeRoute,
} from "#/lib/browser-bench/contract";
import { createInterface } from "node:readline";
import { startLocalE2EServer } from "./lib/local-e2e-server";

export const WEBVIEW_RESULT_PREFIX = "BROWSER_SMOKE_RESULT ";
export const WEBVIEW_VIEWPORT = { width: 1280, height: 720 } as const;
export const WEBVIEW_BACKENDS = ["webkit", "chrome"] as const;
export type WebViewBackend = (typeof WEBVIEW_BACKENDS)[number];

export type WebViewCliOptions = {
	backend: WebViewBackend;
	baseUrl: string;
	views: 1 | 2;
	passes: number;
	smol: boolean;
	externalServer: boolean;
	persistent: boolean;
};

type PageSnapshot = {
	readyState: string;
	status: number;
	lang: string;
	headings: string[];
	bodyText: string;
	canonical: string | null;
};

export type WebViewSmokeResult = {
	backend: WebViewBackend;
	views: number;
	passes: number;
	smol: boolean;
	routes: BrowserSmokeObservation[];
	viewOutcomes: BrowserSmokeObservation[][];
	/** One normalized route inventory per pass, retained for benchmark samples. */
	passOutcomes: BrowserSmokeObservation[][];
	/** Wall time for each pass, excluding browser construction. */
	passDurationsMs: number[];
	/** Runtime/backend identity obtained from Bun and the active WebView API. */
	runtimeVersion: string;
	backendVersion: string;
	passed: boolean;
};

function positiveInt(value: string, option: string): number {
	if (!/^\d+$/.test(value) || Number(value) < 1) {
		throw new Error(`${option} must be a positive integer`);
	}
	return Number(value);
}

export function parseWebViewArgs(args: string[]): WebViewCliOptions {
	const parsed: WebViewCliOptions = {
		backend: "webkit",
		baseUrl: "http://localhost:4173",
		views: 1,
		passes: 1,
		smol: false,
		externalServer: false,
		persistent: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--smol") {
			parsed.smol = true;
			continue;
		}
		if (arg === "--external-server") {
			parsed.externalServer = true;
			continue;
		}
		if (arg === "--persistent") {
			parsed.persistent = true;
			continue;
		}
		if (arg === "--backend") {
			const value = args[++index];
			if (!value) throw new Error("--backend requires a value");
			parsed.backend = parseBackend(value);
			continue;
		}
		if (arg.startsWith("--backend=")) {
			parsed.backend = parseBackend(arg.slice("--backend=".length));
			continue;
		}
		if (arg === "--base-url") {
			const value = args[++index];
			if (!value) throw new Error("--base-url requires a value");
			parsed.baseUrl = new URL(value).href;
			continue;
		}
		if (arg.startsWith("--base-url=")) {
			parsed.baseUrl = new URL(arg.slice("--base-url=".length)).href;
			continue;
		}
		if (arg === "--views") {
			const value = args[++index];
			if (!value) throw new Error("--views requires a value");
			parsed.views = parseViews(value);
			continue;
		}
		if (arg.startsWith("--views=")) {
			parsed.views = parseViews(arg.slice("--views=".length));
			continue;
		}
		if (arg === "--passes") {
			const value = args[++index];
			if (!value) throw new Error("--passes requires a value");
			parsed.passes = positiveInt(value, "--passes");
			continue;
		}
		if (arg.startsWith("--passes=")) {
			parsed.passes = positiveInt(arg.slice("--passes=".length), "--passes");
			continue;
		}
		throw new Error(`Unknown argument: ${arg}`);
	}
	return parsed;
}

function parseBackend(value: string): WebViewBackend {
	if (!WEBVIEW_BACKENDS.includes(value as WebViewBackend)) {
		throw new Error("--backend must be webkit or chrome");
	}
	return value as WebViewBackend;
}

function parseViews(value: string): 1 | 2 {
	if (value !== "1" && value !== "2") throw new Error("--views must be 1 or 2");
	return Number(value) as 1 | 2;
}

function canonicalPath(value: string | null): string | null {
	if (!value) return null;
	try {
		return new URL(value).pathname;
	} catch {
		return null;
	}
}

export function assessWebViewRoute(
	route: BrowserSmokeRoute,
	snapshot: PageSnapshot,
): BrowserSmokeObservation {
	const errors: string[] = [];
	if (route.expectedStatus !== undefined && snapshot.status !== route.expectedStatus) {
		errors.push(`status expected ${route.expectedStatus}, got ${snapshot.status}`);
	}
	if (snapshot.readyState !== "complete") errors.push(`readyState=${snapshot.readyState}`);
	if (route.expectedLang && snapshot.lang !== route.expectedLang) {
		errors.push(`lang expected ${route.expectedLang}, got ${snapshot.lang}`);
	}
	if (route.expectedHeading && !snapshot.headings.includes(route.expectedHeading)) {
		errors.push(`heading not found: ${route.expectedHeading}`);
	}
	if (route.expectedText && !snapshot.bodyText.includes(route.expectedText)) {
		errors.push(`text not found: ${route.expectedText}`);
	}
	if (
		route.expectedCanonicalPath &&
		canonicalPath(snapshot.canonical) !== route.expectedCanonicalPath
	) {
		errors.push(
			`canonical expected ${route.expectedCanonicalPath}, got ${canonicalPath(snapshot.canonical) ?? "missing"}`,
		);
	}
	return {
		id: route.id,
		passed: errors.length === 0,
		status: snapshot.status,
		...(errors.length === 0 ? {} : { error: errors.join("; ") }),
	};
}

const PAGE_SNAPSHOT_EXPRESSION = `(() => ({
  readyState: document.readyState,
  status: 0,
  lang: document.documentElement.lang,
  headings: [...document.querySelectorAll("h1, h2, h3, h4, h5, h6")]
    .map((element) => element.textContent?.trim() ?? "")
    .filter(Boolean),
  bodyText: document.body.innerText,
  canonical: document.querySelector('link[rel="canonical"]')?.href ?? null,
}))()`;

async function pageSnapshot(view: Bun.WebView, url: string): Promise<PageSnapshot> {
	await view.navigate(url);
	// Navigation can resolve before SSR hydration replaces the previous
	// document. Let one render turn settle before reading locale-specific text.
	await Bun.sleep(25);
	const snapshot = (await view.evaluate(PAGE_SNAPSHOT_EXPRESSION)) as PageSnapshot;
	const status = (await view.evaluate(
		"fetch(location.href, {cache: 'no-store'}).then((response) => response.status)",
	)) as number;
	return { ...snapshot, status };
}

function backendConfig(backend: WebViewBackend) {
	return backend === "chrome"
		? { backend: { type: "chrome" as const, url: false as const } }
		: { backend: "webkit" as const };
}

async function runView(
	view: Bun.WebView,
	baseUrl: string,
	passes: number,
): Promise<{ outcomes: BrowserSmokeObservation[]; durationsMs: number[]; backendVersion: string }> {
	const observations: BrowserSmokeObservation[] = [];
	const durationsMs: number[] = [];
	const backendVersion = String(await view.evaluate("navigator.userAgent"));
	for (let pass = 0; pass < passes; pass += 1) {
		const started = performance.now();
		for (const route of BROWSER_SMOKE_ROUTES) {
			try {
				const snapshot = await pageSnapshot(
					view,
					new URL(route.path, baseUrl).href,
				);
				observations.push(assessWebViewRoute(route, snapshot));
			} catch (error) {
				observations.push({
					id: route.id,
					passed: false,
					error: error instanceof Error ? error.message : String(error),
				});
			}
		}
		durationsMs.push(performance.now() - started);
	}
	return { outcomes: observations, durationsMs, backendVersion };
}

function aggregateObservations(
	viewOutcomes: BrowserSmokeObservation[][],
	passes: number,
): BrowserSmokeObservation[] {
	return BROWSER_SMOKE_ROUTES.map((route, routeIndex) => {
		const observations = viewOutcomes.flatMap((outcomes) =>
			Array.from({ length: passes }, (_, pass) => outcomes[pass * BROWSER_SMOKE_ROUTES.length + routeIndex]),
		);
		const failed = observations.find((observation) => !observation?.passed);
		return (
			failed ?? {
				id: route.id,
				passed: true,
				status: observations.find((observation) => observation?.status !== undefined)?.status,
			}
		);
	});
}

function passObservations(
	viewOutcomes: BrowserSmokeObservation[][],
	passes: number,
): BrowserSmokeObservation[][] {
	return Array.from({ length: passes }, (_, pass) =>
		BROWSER_SMOKE_ROUTES.map((route, routeIndex) => {
			const observations = viewOutcomes.map(
				(outcomes) => outcomes[pass * BROWSER_SMOKE_ROUTES.length + routeIndex],
			);
			return (
				observations.find((observation) => !observation?.passed) ??
				observations.find((observation) => observation !== undefined) ?? {
					id: route.id,
					passed: false,
					error: "missing WebView observation",
				}
			);
		}),
	);
}

export async function runWebViewSmoke(
	options: WebViewCliOptions,
): Promise<WebViewSmokeResult> {
	const views: Bun.WebView[] = [];
	const viewOutcomes: BrowserSmokeObservation[][] = [];
	try {
		for (let index = 0; index < options.views; index += 1) {
			views.push(
				new Bun.WebView({
					...backendConfig(options.backend),
					width: WEBVIEW_VIEWPORT.width,
					height: WEBVIEW_VIEWPORT.height,
					dataStore: "ephemeral",
				}),
			);
		}
		const outcomes = await Promise.all(
			views.map((view) => runView(view, options.baseUrl, options.passes)),
		);
		viewOutcomes.push(...outcomes.map((result) => result.outcomes));
		const routes = aggregateObservations(viewOutcomes, options.passes);
		const normalized = normalizeBrowserSmokeOutcome({ routes });
		if (!normalized) throw new Error("WebView smoke produced an invalid route inventory");
		const perPass = passObservations(viewOutcomes, options.passes);
		return {
			backend: options.backend,
			views: options.views,
			passes: options.passes,
			smol: options.smol,
			routes: normalized.routes,
			viewOutcomes,
			passOutcomes: perPass,
			passDurationsMs: Array.from({ length: options.passes }, (_, pass) =>
				Math.max(...outcomes.map((result) => result.durationsMs[pass] ?? 0)),
			),
			runtimeVersion: Bun.version,
			backendVersion: outcomes[0]?.backendVersion ?? "unknown",
			passed: normalized.passed,
		};
	} catch (error) {
		Bun.WebView.closeAll();
		throw error;
	} finally {
		for (const view of views) view.close();
	}
}

/**
 * Keep WebView instances alive while the benchmark coordinator alternates
 * profiles. One request performs one measured five-route pass and emits the
 * same structured payload as the one-shot harness.
 */
async function runPersistentWebViewSmoke(options: WebViewCliOptions): Promise<void> {
	const views: Bun.WebView[] = [];
	try {
		for (let index = 0; index < options.views; index += 1) {
			views.push(new Bun.WebView({
				...backendConfig(options.backend),
				width: WEBVIEW_VIEWPORT.width,
				height: WEBVIEW_VIEWPORT.height,
				dataStore: "ephemeral",
			}));
		}
		const backendVersion = String(await views[0]?.evaluate("navigator.userAgent"));
		console.log(`BROWSER_SMOKE_READY ${JSON.stringify({ runtimeVersion: Bun.version, backendVersion })}`);
		const input = createInterface({ input: process.stdin });
		for await (const line of input) {
			if (line.trim() !== "pass") continue;
			const results = await Promise.all(views.map((view) => runView(view, options.baseUrl, 1)));
			const viewOutcomes = results.map((result) => result.outcomes);
			const routes = aggregateObservations(viewOutcomes, 1);
			const normalized = normalizeBrowserSmokeOutcome({ routes });
			if (!normalized) throw new Error("WebView smoke produced an invalid route inventory");
			const perPass = passObservations(viewOutcomes, 1);
			console.log(`${WEBVIEW_RESULT_PREFIX}${JSON.stringify({
				passOutcomes: perPass,
				passDurationsMs: [Math.max(...results.map((result) => result.durationsMs[0] ?? 0))],
				runtimeVersion: Bun.version,
				backendVersion,
			})}`);
		}
	} finally {
		for (const view of views) view.close();
	}
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const options = parseWebViewArgs(args);
	if (options.persistent) {
		await runPersistentWebViewSmoke(options);
		return;
	}
	const server = options.externalServer
		? null
		: await startLocalE2EServer({ quiet: false });
	try {
		const result = await runWebViewSmoke({
			...options,
			baseUrl: server?.baseUrl ?? options.baseUrl,
		});
		for (const route of result.routes) {
			console.log(`${route.passed ? "PASS" : "FAIL"} ${route.id}${route.error ? `: ${route.error}` : ""}`);
		}
		console.log(`${WEBVIEW_RESULT_PREFIX}${JSON.stringify(result)}`);
		if (!result.passed) process.exitCode = 1;
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
