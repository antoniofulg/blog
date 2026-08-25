import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import {
	ALL_PROFILES,
	type BrowserProfileResult,
	commandForProfile,
	deriveFinalistSchedule,
	detectBrowserContamination,
	interleaveProfileIds,
	parseSmokeOutput,
	parseWebViewPassData,
	parseWebViewPassOutcomes,
	rssTimeGiBSeconds,
	runtimeVersionMatches,
	sampleBoundary,
	selectNonDominated,
	traceIsInterleaved,
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
		const nodePlaywright = ALL_PROFILES.find(
			(profile) => profile.id === "playwright:node:1",
		);
		expect(nodePlaywright).toBeDefined();
		expect(
			commandForProfile(nodePlaywright ?? ALL_PROFILES[0]).slice(0, 4),
		).toEqual(["mise", "exec", "node@24", "--"]);
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
						"/ renders 200, sets html[lang], and canonical contains expected path",
						"/pt-br/ renders 200, sets html[lang], and canonical contains expected path",
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

	test("rejects locale alias and retains setup count/time separately", () => {
		const report = JSON.stringify({
			stats: { expected: 6, skipped: 0, unexpected: 0, flaky: 0 },
			suites: [
				{
					specs: [
						...[
							"en post render: title",
							"pt-br post render: title",
							"404: missing",
							"/ renders 200, sets html[lang], and canonical contains expected path",
							"/pt-br/ renders 200, sets html[lang], and canonical contains expected path",
						].map((title) => ({
							title,
							tests: [{ results: [{ status: "passed", duration: 11 }] }],
						})),
						{
							title: "authenticate as admin",
							tests: [{ results: [{ status: "passed", duration: 37 }] }],
						},
					],
				},
			],
		});
		const parsed = parseSmokeOutput(report, "playwright");
		expect(parsed).toMatchObject({
			inventory: 6,
			routeCount: 5,
			setupOverhead: 1,
			setupOverheadMs: 37,
		});
		const withAlias = report.replace("/ renders 200,", "/en/ renders 200,");
		expect(parseSmokeOutput(withAlias, "playwright")).toBeNull();
	});

	test("uses emitted WebView pass durations and provenance", () => {
		const payload = {
			passOutcomes: [
				BROWSER_SMOKE_ROUTE_IDS.map((id) => ({ id, passed: true })),
				BROWSER_SMOKE_ROUTE_IDS.map((id) => ({ id, passed: true })),
			],
			passDurationsMs: [91, 17],
			runtimeVersion: "1.4.2",
			backendVersion: "Mozilla/5.0 AppleWebKit/617.1",
		};
		const parsed = parseWebViewPassData(
			`BROWSER_SMOKE_RESULT ${JSON.stringify(payload)}`,
		);
		expect(parsed.passDurationsMs).toEqual([91, 17]);
		expect(parsed.runtimeVersion).toBe("1.4.2");
		expect(parsed.backendVersion).toContain("AppleWebKit");
	});

	test("discriminates warm/cold guards and one-warmup coordinator", () => {
		const source = readFileSync(
			new URL("../../scripts/bench-browser-runtimes.ts", import.meta.url),
			"utf8",
		);
		expect(source).toContain(
			'profile.arm === "webview" && profile.phase === "warm"',
		);
		expect(source).toContain("data.passDurationsMs[index + 1]");
		expect(source).not.toContain("result.measured.ms / (repetitions + 1)");
		expect(source).not.toMatch(
			/while \([^\n]*valid[^\n]*\)[\s\S]{0,700}runProfile\(profile, 1\)/,
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
		expect(
			detectBrowserContamination(
				"123 456 /bin/zsh -c pgrep -f 'vitest|playwright test'",
				"/worktree",
			),
		).toBeUndefined();
		expect(interleaveProfileIds(["node", "bun"], 3)).toEqual([
			["node#1", "bun#1"],
			["node#2", "bun#2"],
			["node#3", "bun#3"],
		]);
		const trace = [1, 2, 3, 4].map((sequence) => ({
			profile: sequence % 2 ? "node" : "bun",
			kind: "measured" as const,
			run: Math.ceil(sequence / 2),
			sequence,
			startedAt: "2026-01-01T00:00:00.000Z",
			finishedAt: "2026-01-01T00:00:00.001Z",
		}));
		expect(deriveFinalistSchedule(trace, 2)).toEqual([
			["node#1", "bun#1"],
			["node#2", "bun#2"],
		]);
		expect(traceIsInterleaved(trace, ["node", "bun"], 2)).toBe(true);
		expect(traceIsInterleaved(trace.slice(0, 1), ["node", "bun"], 2)).toBe(
			false,
		);
	});

	test("reports RSS-time in GiB seconds, not GiB milliseconds", () => {
		expect(rssTimeGiBSeconds(2_000, 2 ** 31)).toBe(4);
	});

	test("rejects Node 22 provenance for the Node 24 arm", () => {
		const node = ALL_PROFILES.find(
			(profile) => profile.id === "playwright:node:1",
		);
		expect(node).toBeDefined();
		const profile = node ?? ALL_PROFILES[0];
		expect(runtimeVersionMatches(profile, "22.23.1")).toBe(false);
		expect(runtimeVersionMatches(profile, "24.19.0")).toBe(true);
	});
});
