import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import {
	incrementViewCountFn,
	shouldSuppressPostViewAnalytics,
} from "#/routes/{-$locale}/$slug.server";
import {
	buildHybridComparisons,
	buildHybridSchedule,
	commandForHybridProfile,
	type HybridHarnessResult,
	type HybridPhase,
	type HybridProfile,
	type HybridProfileSummary,
	measurementInvalidReasons,
	parseHybridHarnessOutput,
	validateHybridHarnessResult,
} from "../../scripts/bench-playwright-webview-hybrid";
import {
	assertBunWebViewAvailable,
	attachFailureScreenshot,
	driverProfileForProject,
	failureNeedsScreenshot,
	HYBRID_DRIVER_PROFILES,
	type HybridDriverProfile,
	initializeWebView,
	requireChromiumPath,
	type ScreenshotTestInfo,
} from "../../tests/e2e-webview/fixtures/browser-smoke";

function harnessResult(
	profile: HybridProfile,
	phase: HybridPhase,
): HybridHarnessResult {
	return {
		schemaVersion: 1,
		profile,
		phase,
		startupMs: 40,
		driverSetupMs: 30,
		warmupMs: phase === "warm" ? 12 : null,
		actionMs: 10,
		routes: BROWSER_SMOKE_ROUTE_IDS.map((id) => ({ id, passed: true })),
		passed: true,
		runtimeVersion: "1.4.0",
		browserVersion: "browser/1",
	};
}

function harnessOutput(result: HybridHarnessResult) {
	return {
		result,
		teardown: { profile: result.profile, teardownMs: 3 },
	};
}

const METRIC = { median: 10, min: 9, max: 11, sampleCount: 5 };

function profileSummary(
	profile: HybridProfile,
	valid: boolean,
): HybridProfileSummary {
	return {
		profile,
		phase: "cold",
		valid,
		invalidReasons: valid ? [] : ["process group cleanup failed"],
		warmupCommandWallMs: 10,
		sampleCount: valid ? 5 : 0,
		wall: METRIC,
		startup: METRIC,
		driverSetup: METRIC,
		internalWarmup: null,
		action: METRIC,
		teardown: METRIC,
		runnerOverhead: METRIC,
		peakRss: METRIC,
		rssTime: METRIC,
	};
}

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

	test("captures screenshots only for unexpected test outcomes", async () => {
		expect(failureNeedsScreenshot("failed", "passed")).toBe(true);
		expect(failureNeedsScreenshot("passed", "passed")).toBe(false);

		const attachments: Array<{
			body?: Buffer | string;
			contentType?: string;
			name: string;
		}> = [];
		const failedInfo: ScreenshotTestInfo = {
			status: "failed",
			expectedStatus: "passed",
			attach: async (name, options) => {
				if (!options) throw new Error("attachment options are required");
				attachments.push({
					name,
					...(options.body === undefined ? {} : { body: options.body }),
					...(options.contentType === undefined
						? {}
						: { contentType: options.contentType }),
				});
			},
		};
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		await attachFailureScreenshot(failedInfo, async () => png);
		expect(attachments).toEqual([
			{ name: "failure.png", body: png, contentType: "image/png" },
		]);

		await attachFailureScreenshot(
			{ ...failedInfo, status: "passed" },
			async () => png,
		);
		expect(attachments).toHaveLength(1);

		attachments.length = 0;
		await attachFailureScreenshot(failedInfo, async () => {
			throw new Error("capture failed");
		});
		expect(attachments[0]?.name).toBe("failure-screenshot-error.txt");
		expect(attachments[0]?.contentType).toBe("text/plain");
		expect(attachments[0]?.body?.toString()).toContain("capture failed");
	});

	test("fails WebView projects instead of falling back when Bun.WebView is absent", () => {
		expect(() => assertBunWebViewAvailable(undefined)).toThrow(
			"Bun.WebView is unavailable; hybrid WebView projects do not fall back to Playwright Page",
		);
		expect(() => assertBunWebViewAvailable({ version: "1.4.0" })).toThrow(
			"Bun.WebView is unavailable",
		);
		expect(() =>
			assertBunWebViewAvailable({ WebView: Bun.WebView }),
		).not.toThrow();
	});

	test("rejects a missing Chromium executable before launching its profile", () => {
		const profile: HybridDriverProfile = {
			project: "bun-webview-chrome",
			driver: "bun-webview",
			engine: "chromium",
		};
		expect(() => requireChromiumPath(profile)).toThrow(
			"missing Chromium executable for bun-webview-chrome",
		);
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
		const result = harnessResult("bun-webview-webkit", "warm");
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
		expect(
			validateHybridHarnessResult(
				{ ...output, result: { ...result, warmupMs: null } },
				"bun-webview-webkit",
				"warm",
			),
		).toContain("warm sample is missing internal warmup");
		expect(
			validateHybridHarnessResult(
				{ ...output, result: { ...result, runtimeVersion: "1.5.0" } },
				"bun-webview-webkit",
				"warm",
			),
		).toContain("runtime is not Bun 1.4");
	});

	test("keeps Page and WebKit valid when only the WebView Chrome harness fails", () => {
		expect(
			validateHybridHarnessResult(
				harnessOutput(harnessResult("playwright-page", "cold")),
				"playwright-page",
				"cold",
			),
		).toEqual([]);
		expect(
			validateHybridHarnessResult(
				harnessOutput(harnessResult("bun-webview-webkit", "cold")),
				"bun-webview-webkit",
				"cold",
			),
		).toEqual([]);
		expect(
			validateHybridHarnessResult(
				{ result: undefined, teardown: undefined },
				"bun-webview-chrome",
				"cold",
			),
		).toEqual(["missing result marker"]);
	});

	test("invalidates timeout, exit, and process cleanup failures", () => {
		expect(
			measurementInvalidReasons({
				exitCode: 3,
				timedOut: true,
				cleanupVerified: false,
			}),
		).toEqual(["exit code 3", "timed out", "process group cleanup failed"]);
		expect(
			measurementInvalidReasons({
				exitCode: 0,
				timedOut: false,
				cleanupVerified: true,
			}),
		).toEqual([]);
	});

	test("produces no winner metrics for an invalid candidate cohort", () => {
		const comparison = buildHybridComparisons([
			profileSummary("playwright-page", true),
			profileSummary("bun-webview-chrome", false),
		]).find((entry) => entry.profile === "bun-webview-chrome");
		expect(comparison).toEqual({
			phase: "cold",
			profile: "bun-webview-chrome",
			scope: "engine-matched",
			valid: false,
			wall: null,
			action: null,
			peakRssDeltaPct: null,
			rssTimeDeltaPct: null,
		});
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
