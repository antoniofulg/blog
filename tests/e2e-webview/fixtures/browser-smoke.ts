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
	observe: (route: BrowserSmokeRoute, baseUrl: string) => Promise<BrowserSmokeObservation>;
};

type PageSnapshot = {
	readyState: string;
	status: number;
	lang: string;
	headings: string[];
	bodyText: string;
	canonical: string | null;
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
						const snapshot = await page.evaluate<PageSnapshot>(
							PAGE_SNAPSHOT_EXPRESSION,
						);
						return assessWebViewRoute(route, {
							...snapshot,
							status: response?.status() ?? 0,
						});
					},
				});
			} finally {
				await attachFailureScreenshot(testInfo, () => page.screenshot());
				await browser.close();
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
		const browserVersion = String(await view.evaluate("navigator.userAgent"));
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
					const snapshot = await view.evaluate<PageSnapshot>(
						PAGE_SNAPSHOT_EXPRESSION,
					);
					const status = await view.evaluate<number>(
						"fetch(location.href, { cache: 'no-store' }).then((response) => response.status)",
					);
					return assessWebViewRoute(route, { ...snapshot, status });
				},
			});
		} finally {
			await attachFailureScreenshot(testInfo, () =>
				view.screenshot({ encoding: "buffer" }),
			);
			view.close();
		}
	},
});

export { expect };
