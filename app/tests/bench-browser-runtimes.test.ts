import { describe, expect, test } from "vitest";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import {
	ALL_PROFILES,
	type BrowserProfileResult,
	commandForProfile,
	detectBrowserContamination,
	interleaveProfileIds,
	parseSmokeOutput,
	parseWebViewPassOutcomes,
	sampleBoundary,
	selectNonDominated,
} from "../../scripts/bench-browser-runtimes";

describe("browser finalist benchmark", () => {
	test("enumerates both Playwright runtimes at workers one and two and WebView possibilities", () => {
		expect(
			ALL_PROFILES.some((profile) => profile.id === "playwright:node:1"),
		).toBe(true);
		expect(
			ALL_PROFILES.some((profile) => profile.id === "playwright:bun:2"),
		).toBe(true);
		expect(
			ALL_PROFILES.some(
				(profile) => profile.id === "webview:webkit:warm:2view:smol",
			),
		).toBe(true);
		expect(
			ALL_PROFILES.some(
				(profile) => profile.id === "webview:chrome:cold:1view",
			),
		).toBe(true);
	});

	test("keeps the canonical smoke filter and opt-in WebView controls in commands", () => {
		const playwright = ALL_PROFILES.find(
			(profile) => profile.id === "playwright:bun:2",
		);
		const webview = ALL_PROFILES.find(
			(profile) => profile.id === "webview:webkit:warm:2view:smol",
		);
		expect(commandForProfile(playwright!)).toContain("--grep");
		expect(commandForProfile(playwright!).join(" ")).toContain("--workers=2");
		expect(commandForProfile(webview!).join(" ")).toContain(
			"--external-server",
		);
		expect(commandForProfile(webview!).join(" ")).toContain("--views=2");
	});

	test("selects only valid non-dominated finalists by median time and RSS", () => {
		const make = (id: string, ms: number, rss: number, valid = true) => ({
			profile: { id } as BrowserProfileResult["profile"],
			warmup: {} as BrowserProfileResult["warmup"],
			samples: [] as BrowserProfileResult["samples"],
			aggregate: {
				medianMs: ms,
				minMs: ms,
				maxMs: ms,
				medianPeakRssBytes: rss,
				sampleCount: 5,
				medianLoadAvg1: 0,
				maxLoadAvg1: 0,
			},
			valid,
			invalidReasons: [],
			nonDominated: false,
		});
		expect(
			selectNonDominated([
				make("fast", 10, 100),
				make("memory", 20, 50),
				make("dominated", 30, 200),
				make("invalid", 1, 1, false),
			]),
		).toEqual(["fast", "memory"]);
		expect(BROWSER_SMOKE_ROUTE_IDS).toHaveLength(5);
	});

	test("encodes cold restart and warm reuse boundaries", () => {
		const cold = ALL_PROFILES.find(
			(profile) => profile.id === "webview:webkit:cold:1view",
		);
		const warm = ALL_PROFILES.find(
			(profile) => profile.id === "webview:webkit:warm:1view",
		);
		expect(sampleBoundary(cold!)).toEqual({
			phase: "cold",
			server: "restarted-per-sample",
			browser: "restarted-per-sample",
			process: "restarted-per-sample",
		});
		expect(sampleBoundary(warm!)).toEqual({
			phase: "warm",
			server: "reused-arm",
			browser: "reused-arm",
			process: "reused-arm",
		});
	});

	test("retains exact five route identities in Playwright and WebView outcomes", () => {
		const playwrightReport = JSON.stringify({
			stats: { expected: 5, skipped: 0, unexpected: 0, flaky: 0 },
			suites: [
				{
					title: "public read",
					specs: [
						"en post render: title",
						"pt-br post render: title",
						"404: missing",
						"/ renders 200",
						"/pt-br/ renders 200",
					].map((title) => ({
						title,
						tests: [{ results: [{ status: "passed" }] }],
					})),
				},
			],
		});
		const playwright = parseSmokeOutput(playwrightReport, "playwright");
		expect(playwright?.routes.map((route) => route.id)).toEqual(
			BROWSER_SMOKE_ROUTE_IDS,
		);
		expect(playwright?.routes.every((route) => route.passed)).toBe(true);
		const webview = parseWebViewPassOutcomes(
			`BROWSER_SMOKE_RESULT ${JSON.stringify({ passOutcomes: [playwright?.routes] })}`,
		);
		expect(webview).toHaveLength(1);
		expect(webview[0]?.routes.map((route) => route.id)).toEqual(
			BROWSER_SMOKE_ROUTE_IDS,
		);
	});

	test("detects external browser activity and preserves round-robin finalist schedule", () => {
		expect(
			detectBrowserContamination(
				"123 456 node /other/node_modules/.bin/playwright test --project=chromium\n124 456 /Users/test/Library/Caches/ms-playwright/chromium-123/chrome",
				"/worktree",
			),
		).toContain("playwright test");
		expect(
			detectBrowserContamination(
				"123 456 node /other/node_modules/.bin/playwright-mcp",
				"/worktree",
			),
		).toBeUndefined();
		expect(
			detectBrowserContamination(
				"123 456 /worktree/node_modules/chromium",
				"/worktree",
			),
		).toBeUndefined();
		expect(interleaveProfileIds(["node", "bun"], 3)).toEqual([
			["node#1", "bun#1"],
			["node#2", "bun#2"],
			["node#3", "bun#3"],
		]);
	});
});
