import { describe, expect, test } from "vitest";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import {
	ALL_PROFILES,
	type BrowserProfileResult,
	commandForProfile,
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
});
