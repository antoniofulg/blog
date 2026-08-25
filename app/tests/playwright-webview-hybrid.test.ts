import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import {
	incrementViewCountFn,
	shouldSuppressPostViewAnalytics,
} from "#/routes/{-$locale}/$slug.server";
import {
	buildHybridSchedule,
	commandForHybridProfile,
	parseHybridHarnessOutput,
	validateHybridHarnessResult,
} from "../../scripts/bench-playwright-webview-hybrid";
import {
	driverProfileForProject,
	failureNeedsScreenshot,
	HYBRID_DRIVER_PROFILES,
	initializeWebView,
} from "../../tests/e2e-webview/fixtures/browser-smoke";

describe("Playwright Test WebView hybrid fixture", () => {
	test("maps the Page and WebView projects to explicit browser drivers", () => {
		expect(HYBRID_DRIVER_PROFILES).toEqual([
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
		]);
		expect(driverProfileForProject("bun-webview-chrome")).toMatchObject({
			driver: "bun-webview",
			engine: "chromium",
		});
		expect(() => driverProfileForProject("unknown")).toThrow(
			"unknown hybrid browser project: unknown",
		);
	});

	test("uses Playwright Chromium for the engine-matched WebView profile", () => {
		const profile = driverProfileForProject("bun-webview-chrome");
		expect(profile.executablePath).toBe(chromium.executablePath());
		expect(profile.executablePath).toContain("chromium");
	});

	test("declares no built-in Playwright browser fixture dependency", () => {
		const source = readFileSync(
			new URL(
				"../../tests/e2e-webview/fixtures/browser-smoke.ts",
				import.meta.url,
			),
			"utf8",
		);
		expect(source).toContain("browserSmoke: async ({}, use, testInfo)");
		expect(source).not.toMatch(
			/browserSmoke:\s*async\s*\(\s*\{[^}]*\b(?:page|browser|context)\b/,
		);
	});

	test("captures screenshots only for unexpected test outcomes", () => {
		expect(failureNeedsScreenshot("failed", "passed")).toBe(true);
		expect(failureNeedsScreenshot("passed", "passed")).toBe(false);
	});

	test("probes WebView status without replaying the route body", () => {
		const source = readFileSync(
			new URL(
				"../../tests/e2e-webview/fixtures/browser-smoke.ts",
				import.meta.url,
			),
			"utf8",
		);
		expect(source).toContain("method: 'HEAD'");
		expect(source).not.toContain("fetch(location.href, { cache: 'no-store' })");
	});

	test("navigates before evaluating Chrome WebView runtime data", async () => {
		const calls: string[] = [];
		const userAgent = await initializeWebView({
			navigate: async (url) => {
				calls.push(`navigate:${url}`);
			},
			evaluate: async (expression) => {
				calls.push(`evaluate:${expression}`);
				return "Chrome for Testing";
			},
		});
		expect(calls).toEqual([
			"navigate:about:blank",
			"evaluate:navigator.userAgent",
		]);
		expect(userAgent).toBe("Chrome for Testing");
	});

	test("rotates every profile through the interleaved sample order", () => {
		expect(buildHybridSchedule(HYBRID_DRIVER_PROFILES, 2)).toEqual([
			{ profile: "playwright-page", kind: "warmup", run: 0 },
			{ profile: "bun-webview-webkit", kind: "warmup", run: 0 },
			{ profile: "bun-webview-chrome", kind: "warmup", run: 0 },
			{ profile: "playwright-page", kind: "measured", run: 1 },
			{ profile: "bun-webview-webkit", kind: "measured", run: 1 },
			{ profile: "bun-webview-chrome", kind: "measured", run: 1 },
			{ profile: "bun-webview-webkit", kind: "measured", run: 2 },
			{ profile: "bun-webview-chrome", kind: "measured", run: 2 },
			{ profile: "playwright-page", kind: "measured", run: 2 },
		]);
	});

	test("runs every benchmark profile through Bun-hosted Playwright Test", () => {
		expect(commandForHybridProfile("bun-webview-chrome")).toEqual([
			"bunx",
			"--bun",
			"playwright",
			"test",
			"--config=playwright.webview.config.ts",
			"--project=bun-webview-chrome",
			"--workers=1",
			"--retries=0",
			"--reporter=line",
		]);
	});

	test("parses matched lifecycle markers and rejects route drift", () => {
		const result = {
			schemaVersion: 1,
			profile: "bun-webview-webkit",
			phase: "warm",
			startupMs: 40,
			driverSetupMs: 30,
			warmupMs: 12,
			actionMs: 10,
			routes: BROWSER_SMOKE_ROUTE_IDS.map((id) => ({ id, passed: true })),
			passed: true,
			runtimeVersion: "1.4.0",
			browserVersion: "AppleWebKit/620",
		};
		const output = parseHybridHarnessOutput(
			`runner output\nHYBRID_BROWSER_RESULT ${JSON.stringify(result)}\nHYBRID_BROWSER_TEARDOWN ${JSON.stringify({ profile: result.profile, teardownMs: 3 })}\n`,
		);
		expect(output).toEqual({
			result,
			teardown: { profile: result.profile, teardownMs: 3 },
		});
		expect(
			validateHybridHarnessResult(output, "bun-webview-webkit", "warm"),
		).toEqual([]);
		expect(
			validateHybridHarnessResult(
				{
					...output,
					result: { ...result, routes: result.routes.slice(1) },
				},
				"bun-webview-webkit",
				"warm",
			),
		).toContain("invalid five-route outcome");
	});

	test("suppresses post analytics only in an isolated browser-smoke server", async () => {
		expect(shouldSuppressPostViewAnalytics({ E2E_BROWSER_SMOKE: "true" })).toBe(
			true,
		);
		expect(shouldSuppressPostViewAnalytics({})).toBe(false);
		expect(shouldSuppressPostViewAnalytics({ E2E_TEST: "true" })).toBe(false);
		await expect(
			incrementViewCountFn(
				{ id: -1, referrer: null, utmSource: null },
				{ E2E_BROWSER_SMOKE: "true" },
			),
		).resolves.toBeUndefined();
	});

	test("isolates analytics only in the hybrid config, never the canonical E2E config", () => {
		const hybrid = readFileSync(
			new URL("../../playwright.webview.config.ts", import.meta.url),
			"utf8",
		);
		const canonical = readFileSync(
			new URL("../../playwright.config.ts", import.meta.url),
			"utf8",
		);
		expect(hybrid).toContain("E2E_BROWSER_SMOKE=true");
		expect(canonical).not.toContain("E2E_BROWSER_SMOKE");
	});
});
