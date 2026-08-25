import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { chromium } from "@playwright/test";
import {
	driverProfileForProject,
	failureNeedsScreenshot,
	HYBRID_DRIVER_PROFILES,
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
});
