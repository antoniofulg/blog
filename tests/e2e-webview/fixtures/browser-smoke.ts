import {
	chromium,
	expect,
	test as base,
	type TestInfo,
} from "@playwright/test";
import { performance } from "node:perf_hooks";
import type {
	BrowserSmokeObservation,
	BrowserSmokeRoute,
} from "#/lib/browser-bench/contract";
import { assessWebViewRoute } from "../../../scripts/run-e2e-webview";

export const HYBRID_VIEWPORT = { width: 1280, height: 720 } as const;
export const HYBRID_RESULT_PREFIX = "HYBRID_BROWSER_RESULT ";
export const HYBRID_TEARDOWN_PREFIX = "HYBRID_BROWSER_TEARDOWN ";

export const HYBRID_DRIVER_PROFILES = [
	{
		project: "playwright-page",
		driver: "playwright-page",
		engine: "chromium",
	},
	{
		project: "bun-webview-webkit",
		driver: "bun-webview",
		engine: "webkit",
	},
	{
		project: "bun-webview-chrome",
		driver: "bun-webview",
		engine: "chromium",
	},
] as const;

export type HybridDriverProfile = (typeof HYBRID_DRIVER_PROFILES)[number] & {
	executablePath?: string;
};

export type BrowserSmokeFixture = {
	profile: HybridDriverProfile;
	runtimeVersion: string;
	browserVersion: string;
	startupMs: number;
	driverSetupMs: number;
	observe: (
		route: BrowserSmokeRoute,
		baseUrl: string,
	) => Promise<BrowserSmokeRouteResult>;
};

export type BrowserSmokePageSnapshot = {
	readyState: string;
	status: number;
	lang: string;
	headings: string[];
	bodyText: string;
	canonical: string | null;
};

export type BrowserSmokeRouteResult = {
	observation: BrowserSmokeObservation;
	snapshot: BrowserSmokePageSnapshot;
};

const MODULE_STARTED_AT = performance.now();

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

export function driverProfileForProject(project: string): HybridDriverProfile {
	const profile = HYBRID_DRIVER_PROFILES.find(
		(candidate) => candidate.project === project,
	);
	if (!profile) throw new Error(`unknown hybrid browser project: ${project}`);
	return profile.engine === "chromium"
		? { ...profile, executablePath: chromium.executablePath() }
		: profile;
}

function bunVersion(): string {
	if (typeof Bun === "undefined" || typeof Bun.version !== "string") {
		throw new Error(
			"Playwright Test hybrid projects require a Bun worker; run with bunx --bun",
		);
	}
	return Bun.version;
}

function chromiumPath(profile: HybridDriverProfile): string {
	if (!profile.executablePath) {
		throw new Error(`missing Chromium executable for ${profile.project}`);
	}
	return profile.executablePath;
}

export function failureNeedsScreenshot(
	status: TestInfo["status"],
	expectedStatus: TestInfo["expectedStatus"],
): boolean {
	return status !== expectedStatus;
}

export async function initializeWebView(view: {
	evaluate: (script: string) => Promise<unknown>;
	navigate: (url: string) => Promise<void>;
}): Promise<string> {
	await view.navigate("about:blank");
	return String(await view.evaluate("navigator.userAgent"));
}

async function attachFailureScreenshot(
	testInfo: TestInfo,
	screenshot: () => Promise<Buffer>,
): Promise<void> {
	if (!failureNeedsScreenshot(testInfo.status, testInfo.expectedStatus)) return;
	try {
		await testInfo.attach("failure.png", {
			body: await screenshot(),
			contentType: "image/png",
		});
	} catch (error) {
		await testInfo.attach("failure-screenshot-error.txt", {
			body: Buffer.from(error instanceof Error ? error.message : String(error)),
			contentType: "text/plain",
		});
	}
}

async function teardownDriver(
	testInfo: TestInfo,
	profile: HybridDriverProfile,
	screenshot: () => Promise<Buffer>,
	close: () => Promise<void> | void,
): Promise<void> {
	await attachFailureScreenshot(testInfo, screenshot);
	const startedAt = performance.now();
	await close();
	if (process.env.PLAYWRIGHT_WEBVIEW_BENCHMARK_PHASE) {
		console.log(
			`${HYBRID_TEARDOWN_PREFIX}${JSON.stringify({
				profile: profile.project,
				teardownMs: performance.now() - startedAt,
			})}`,
		);
	}
}

export const test = base.extend<{ browserSmoke: BrowserSmokeFixture }>({
	browserSmoke: async ({}, use, testInfo) => {
		const profile = driverProfileForProject(testInfo.project.name);
		const runtimeVersion = bunVersion();
		const driverStartedAt = performance.now();

		if (profile.driver === "playwright-page") {
			const browser = await chromium.launch({
				headless: true,
				executablePath: chromiumPath(profile),
			});
			const context = await browser.newContext({ viewport: HYBRID_VIEWPORT });
			const page = await context.newPage();
			const readyAt = performance.now();
			try {
				await use({
					profile,
					runtimeVersion,
					browserVersion: browser.version(),
					startupMs: readyAt - MODULE_STARTED_AT,
					driverSetupMs: readyAt - driverStartedAt,
					observe: async (route, baseUrl) => {
						const response = await page.goto(new URL(route.path, baseUrl).href);
						await page.waitForLoadState("load");
						const snapshot = await page.evaluate<BrowserSmokePageSnapshot>(
							PAGE_SNAPSHOT_EXPRESSION,
						);
						const completeSnapshot = {
							...snapshot,
							status: response?.status() ?? 0,
						};
						return {
							observation: assessWebViewRoute(route, completeSnapshot),
							snapshot: completeSnapshot,
						};
					},
				});
			} finally {
				await teardownDriver(
					testInfo,
					profile,
					() => page.screenshot(),
					() => browser.close(),
				);
			}
			return;
		}

		const view = new Bun.WebView({
			width: HYBRID_VIEWPORT.width,
			height: HYBRID_VIEWPORT.height,
			dataStore: "ephemeral",
			backend:
				profile.engine === "webkit"
					? "webkit"
					: { type: "chrome", path: chromiumPath(profile) },
		});
		const browserVersion = await initializeWebView(view);
		const readyAt = performance.now();
		try {
			await use({
				profile,
				runtimeVersion,
				browserVersion,
				startupMs: readyAt - MODULE_STARTED_AT,
				driverSetupMs: readyAt - driverStartedAt,
				observe: async (route, baseUrl) => {
					await view.navigate(new URL(route.path, baseUrl).href);
					const snapshot = await view.evaluate<BrowserSmokePageSnapshot>(
						PAGE_SNAPSHOT_EXPRESSION,
					);
					const status = await view.evaluate<number>(
						"fetch(location.href, { method: 'HEAD', cache: 'no-store' }).then((response) => response.status)",
					);
					const completeSnapshot = { ...snapshot, status };
					return {
						observation: assessWebViewRoute(route, completeSnapshot),
						snapshot: completeSnapshot,
					};
				},
			});
		} finally {
			await teardownDriver(
				testInfo,
				profile,
				() => view.screenshot({ encoding: "buffer" }),
				() => view.close(),
			);
		}
	},
});

export { expect };
