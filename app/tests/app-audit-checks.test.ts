import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RouteEntry } from "#/lib/site-model.server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const siteModelMocks = vi.hoisted(() => ({
	getRouteInventory: vi.fn<() => Promise<RouteEntry[]>>(),
}));

const probeMocks = vi.hoisted(() => ({
	sweepRoute: vi.fn().mockResolvedValue([]),
	analyzeA11y: vi.fn().mockResolvedValue([]),
	runLighthouse: vi.fn().mockResolvedValue({
		performance: 0.9,
		accessibility: 0.9,
		bestPractices: 0.9,
		seo: 0.95,
	}),
	lighthouseToFindings: vi.fn().mockReturnValue([]),
}));

const playwrightMocks = vi.hoisted(() => {
	const mockPage = { close: vi.fn().mockResolvedValue(undefined) };
	const mockContext = {
		newPage: vi.fn().mockResolvedValue(mockPage),
		close: vi.fn().mockResolvedValue(undefined),
	};
	const mockBrowser = {
		newContext: vi.fn().mockResolvedValue(mockContext),
		close: vi.fn().mockResolvedValue(undefined),
	};
	return { mockPage, mockContext, mockBrowser };
});

vi.mock("#/lib/site-model.server", () => ({
	getRouteInventory: siteModelMocks.getRouteInventory,
}));

vi.mock("#/lib/app-audit/browser-sweep.server", () => ({
	sweepRoute: probeMocks.sweepRoute,
}));

vi.mock("#/lib/app-audit/a11y-adapter.server", () => ({
	analyzeA11y: probeMocks.analyzeA11y,
}));

vi.mock("#/lib/app-audit/lighthouse.server", () => ({
	runLighthouse: probeMocks.runLighthouse,
	lighthouseToFindings: probeMocks.lighthouseToFindings,
}));

vi.mock("@playwright/test", () => ({
	chromium: {
		launch: vi.fn().mockImplementation(async () => playwrightMocks.mockBrowser),
		executablePath: vi.fn().mockReturnValue("/fake/chromium"),
	},
}));

// Admin json not found → fallback to anon context
vi.mock("node:fs/promises", () => ({
	readFile: vi
		.fn()
		.mockRejectedValue(Object.assign(new Error("ENOENT"), { code: "ENOENT" })),
	join: vi.fn(),
}));

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const FIXTURE_ROUTES: RouteEntry[] = [
	{
		path: "/",
		locale: "en",
		auth: "public",
		expectedStatus: 200,
		intent: "blog home",
	},
	{
		path: "/about",
		locale: "en",
		auth: "public",
		expectedStatus: 200,
		intent: "about",
	},
];

// ─── Tests ────────────────────────────────────────────────────────────────────

import { runAppAudit } from "#/lib/app-audit/checks.server";

describe("runAppAudit orchestrator", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		siteModelMocks.getRouteInventory.mockResolvedValue(FIXTURE_ROUTES);
		probeMocks.sweepRoute.mockResolvedValue([]);
		probeMocks.analyzeA11y.mockResolvedValue([]);
		probeMocks.runLighthouse.mockResolvedValue({
			performance: 0.9,
			accessibility: 0.9,
			bestPractices: 0.9,
			seo: 0.95,
		});
		probeMocks.lighthouseToFindings.mockReturnValue([]);
		playwrightMocks.mockContext.newPage.mockResolvedValue(
			playwrightMocks.mockPage,
		);
		playwrightMocks.mockBrowser.newContext.mockResolvedValue(
			playwrightMocks.mockContext,
		);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("2 routes × 2 locales × 2 auth-states → sweepRoute called 8 times", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(8);
	});

	it("2 routes × 2 locales × 2 auth-states → analyzeA11y called 8 times", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		expect(probeMocks.analyzeA11y).toHaveBeenCalledTimes(8);
	});

	it("lighthouse: false → runLighthouse not called", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		expect(probeMocks.runLighthouse).not.toHaveBeenCalled();
	});

	it("lighthouse: true → runLighthouse called once per route×locale (4 times)", async () => {
		await runAppAudit({ lighthouse: true, baseUrl: "http://test:3000" });
		// 2 routes × 2 locales = 4 (Lighthouse is URL-based, not auth-state-based)
		expect(probeMocks.runLighthouse).toHaveBeenCalledTimes(4);
	});

	it("sweep-error forwarded without aborting remaining inspections", async () => {
		probeMocks.sweepRoute.mockResolvedValueOnce([
			{
				category: "sweep-error",
				severity: "major",
				filePath: "/",
				message: "probe failed",
			},
		]);

		const findings = await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
		});

		expect(findings.some((f) => f.category === "sweep-error")).toBe(true);
		// All 8 inspections still ran
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(8);
	});

	it("findings from all probes are collected and returned flat", async () => {
		const fixture = {
			category: "console-error" as const,
			severity: "blocker" as const,
			filePath: "/",
			message: "error",
		};
		probeMocks.sweepRoute.mockResolvedValue([fixture]);

		const findings = await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
		});

		// 8 sweep calls × 1 finding each = 8
		expect(findings).toHaveLength(8);
		expect(findings[0].category).toBe("console-error");
	});

	it("lighthouse findings included when lighthouse: true", async () => {
		probeMocks.lighthouseToFindings.mockReturnValue([
			{
				category: "perf-budget-breach" as const,
				severity: "minor" as const,
				filePath: "http://test:3000/",
				message: "Performance score 60 below threshold (80)",
			},
		]);

		const findings = await runAppAudit({
			lighthouse: true,
			baseUrl: "http://test:3000",
		});

		const lhFindings = findings.filter(
			(f) => f.category === "perf-budget-breach",
		);
		// 4 lighthouse calls (2 routes × 2 locales) × 1 finding each = 4
		expect(lhFindings).toHaveLength(4);
	});

	it("locale path: pt-br routes use /pt-br prefix", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });

		const calls = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		expect(calls).toContain("/pt-br/");
		expect(calls).toContain("/pt-br/about");
		expect(calls).toContain("/");
		expect(calls).toContain("/about");
	});

	it("locale path: root en route stays /", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });

		const calls = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		expect(calls).toContain("/");
	});

	it("page.close called for every inspection", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		// 8 inspections × 1 close = 8
		expect(playwrightMocks.mockPage.close).toHaveBeenCalledTimes(8);
	});

	// ─── routes filter (issue 001) ────────────────────────────────────────────

	it("routes filter: only matching routes swept when routes provided", async () => {
		// inventory has 2 routes: / and /about; filter to / only
		await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: ["/"],
		});
		// 1 route × 2 locales × 2 auth-states = 4
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(4);

		const paths = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		expect(paths.every((p) => p === "/" || p === "/pt-br/")).toBe(true);
	});

	it("routes filter: empty routes array sweeps all routes", async () => {
		await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: [],
		});
		// no filter → 2 routes × 2 locales × 2 auth-states = 8
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(8);
	});

	it("routes filter: undefined routes sweeps all routes", async () => {
		await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: undefined,
		});
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(8);
	});
});
