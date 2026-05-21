import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	buildLocalePath,
	normalizeRoutePath,
} from "#/lib/app-audit/checks.server";
import type { RouteEntry } from "#/lib/site-model.server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const siteModelMocks = vi.hoisted(() => ({
	getRouteInventory: vi.fn<() => Promise<RouteEntry[]>>(),
	resolveRoutePath: vi.fn((route: RouteEntry) => route.path),
}));

const fetchMock = vi.hoisted(() =>
	vi.fn<typeof fetch>().mockResolvedValue(new Response("ok", { status: 200 })),
);

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
	resolveRoutePath: siteModelMocks.resolveRoutePath,
}));

vi.stubGlobal("fetch", fetchMock);

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
		fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
		siteModelMocks.getRouteInventory.mockResolvedValue(FIXTURE_ROUTES);
		siteModelMocks.resolveRoutePath.mockImplementation(
			(route: RouteEntry) => route.path,
		);
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

	it("routes filter: trailing slash normalized → matches inventory path without trailing slash", async () => {
		// inventory has /about; user passes /about/
		await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: ["/about/"],
		});
		// 1 route × 2 locales × 2 auth-states = 4
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(4);
	});

	it("routes filter: missing leading slash normalized → matches inventory path", async () => {
		// inventory has /about; user passes about
		await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: ["about"],
		});
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(4);
	});

	it("routes filter: case mismatch normalized → matches inventory path", async () => {
		// inventory has /about; user passes /About
		await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: ["/About"],
		});
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(4);
	});

	it("routes filter: no match → sweep-error finding returned, no inspections run", async () => {
		const findings = await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
			routes: ["/nonexistent"],
		});
		expect(probeMocks.sweepRoute).not.toHaveBeenCalled();
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "sweep-error",
			severity: "major",
			filePath: "cli",
			message: expect.stringContaining("/nonexistent"),
		});
	});

	// ─── preflight check (issue 002) ─────────────────────────────────────────

	it("preflight: unreachable baseUrl returns single preflight-error blocker", async () => {
		fetchMock.mockRejectedValue(
			Object.assign(new Error("fetch failed"), { code: "ECONNREFUSED" }),
		);
		const findings = await runAppAudit({
			lighthouse: false,
			baseUrl: "http://localhost:99999",
		});
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "preflight-error",
			severity: "blocker",
			filePath: "preflight",
			message: expect.stringContaining("unreachable"),
		});
		expect(probeMocks.sweepRoute).not.toHaveBeenCalled();
	});

	it("preflight: message includes baseUrl and orchestration hint", async () => {
		fetchMock.mockRejectedValue(new Error("fetch failed"));
		const findings = await runAppAudit({
			lighthouse: false,
			baseUrl: "http://localhost:12345",
		});
		expect(findings[0].message).toContain("http://localhost:12345");
		// New guidance points at `make audit-fe` (the orchestrator entry point)
		// and the Nitro bundle for manual runs — `bun preview` (vite preview)
		// does NOT serve the TanStack Start SSR build and is explicitly called
		// out as non-functional in the message.
		expect(findings[0].message).toContain("make audit-fe");
		expect(findings[0].message).toContain(".output/server/index.mjs");
	});

	it("preflight: reachable baseUrl proceeds to route sweep", async () => {
		fetchMock.mockResolvedValue(new Response("ok", { status: 200 }));
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		expect(probeMocks.sweepRoute).toHaveBeenCalled();
	});

	// ─── analyzeA11y skip on sweep-error (issue 003) ─────────────────────────

	it("sweep-error from sweepRoute → analyzeA11y NOT called for that page", async () => {
		probeMocks.sweepRoute.mockResolvedValueOnce([
			{
				category: "sweep-error" as const,
				severity: "major" as const,
				filePath: "/",
				message: "goto failed",
			},
		]);
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		// First call had sweep-error → analyzeA11y skipped for it
		// 8 total inspections, first produced sweep-error, so analyzeA11y called 7 times
		expect(probeMocks.analyzeA11y).toHaveBeenCalledTimes(7);
	});

	it("sweep-error route produces exactly one finding (no cascading axe error)", async () => {
		probeMocks.sweepRoute.mockResolvedValue([
			{
				category: "sweep-error" as const,
				severity: "major" as const,
				filePath: "/",
				message: "goto failed",
			},
		]);
		probeMocks.analyzeA11y.mockResolvedValue([]);
		const findings = await runAppAudit({
			lighthouse: false,
			baseUrl: "http://test:3000",
		});
		// All 8 inspections return sweep-error, analyzeA11y skipped → 8 findings (not 16)
		expect(findings).toHaveLength(8);
		expect(probeMocks.analyzeA11y).not.toHaveBeenCalled();
	});

	// ─── resolveRoutePath usage (issue 004) ──────────────────────────────────

	it("resolveRoutePath called for each route before locale expansion", async () => {
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		// 2 routes × 2 locales = 4 calls to resolveRoutePath
		expect(siteModelMocks.resolveRoutePath).toHaveBeenCalledTimes(4);
	});

	it(":slug route expanded to sampleSlug before page.goto", async () => {
		siteModelMocks.getRouteInventory.mockResolvedValue([
			{
				path: "/:slug",
				locale: "en",
				auth: "public" as const,
				expectedStatus: 200 as const,
				intent: "post detail",
				sampleSlug: "my-sample-post",
			},
		]);
		siteModelMocks.resolveRoutePath.mockImplementation((route: RouteEntry) =>
			route.sampleSlug
				? route.path.replace(/:slug/g, route.sampleSlug)
				: route.path,
		);
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		const calledPaths = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		expect(calledPaths.every((p: string) => !p.includes(":slug"))).toBe(true);
		expect(calledPaths.some((p: string) => p.includes("my-sample-post"))).toBe(
			true,
		);
	});

	// ─── shim route double-prefix guard (round-014 issue 001) ───────────────────

	it("shim route path='/pt-br/' locale='pt-br' walked exactly once — no double-prefix /pt-br/pt-br/", async () => {
		siteModelMocks.getRouteInventory.mockResolvedValue([
			{
				path: "/pt-br/",
				locale: "pt-br" as const,
				auth: "public" as const,
				expectedStatus: 200 as const,
				intent: "pt-br locale root shim",
			},
		]);
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		// Shim route: path already contains locale prefix → walker uses [DEFAULT_LOCALE]
		// → 1 locale × 2 auth-states = 2 sweeps (not 4 = 2 locales × 2 auth).
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(2);
		const paths = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		expect(paths.every((p) => p === "/pt-br/")).toBe(true);
		expect(paths).not.toContain("/pt-br/pt-br/");
	});

	it("shim route path='/en/' locale='en' walked exactly once — no /pt-br/en/ produced", async () => {
		siteModelMocks.getRouteInventory.mockResolvedValue([
			{
				path: "/en/",
				locale: "en" as const,
				auth: "public" as const,
				expectedStatus: 200 as const,
				intent: "en locale root shim",
			},
		]);
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		// /en/ starts with a known locale prefix → isShimRoute=true → 1 locale × 2 auth = 2 sweeps.
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(2);
		const paths = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		expect(paths.every((p) => p === "/en/")).toBe(true);
		expect(paths).not.toContain("/pt-br/en/");
	});

	// ─── locale:null walk restriction (round-012 issue 001) ──────────────────────

	it("locale:null route walks only DEFAULT_LOCALE, locale:en route walks all locales", async () => {
		// 1 global route (locale:null) + 1 locale-scoped route (locale:"en")
		siteModelMocks.getRouteInventory.mockResolvedValue([
			{
				path: "/admin",
				locale: null,
				auth: "admin" as const,
				expectedStatus: 200 as const,
				intent: "admin dashboard",
			},
			{
				path: "/",
				locale: "en",
				auth: "public" as const,
				expectedStatus: 200 as const,
				intent: "blog home",
			},
		]);
		await runAppAudit({ lighthouse: false, baseUrl: "http://test:3000" });
		// locale:null → 1 locale × 2 auth = 2 sweeps
		// locale:"en" → 2 locales × 2 auth = 4 sweeps
		// total = 6
		expect(probeMocks.sweepRoute).toHaveBeenCalledTimes(6);

		const paths = probeMocks.sweepRoute.mock.calls.map(
			([, route]) => (route as RouteEntry).path,
		);
		// Global route MUST NOT be walked with pt-br prefix
		expect(paths).not.toContain("/pt-br/admin");
		expect(paths).toContain("/admin");
		// Locale-scoped route IS walked for pt-br
		expect(paths).toContain("/");
		expect(paths).toContain("/pt-br/");
	});
});

// ─── normalizeRoutePath unit tests (issue 001) ───────────────────────────────

describe("normalizeRoutePath", () => {
	it("adds leading slash when missing", () => {
		expect(normalizeRoutePath("about")).toBe("/about");
	});

	it("removes trailing slash when path length > 1", () => {
		expect(normalizeRoutePath("/about/")).toBe("/about");
	});

	it("keeps root / unchanged", () => {
		expect(normalizeRoutePath("/")).toBe("/");
	});

	it("lowercases the path", () => {
		expect(normalizeRoutePath("/About")).toBe("/about");
	});

	it("trims whitespace", () => {
		expect(normalizeRoutePath("  /about  ")).toBe("/about");
	});

	it("handles missing slash + trailing slash together", () => {
		expect(normalizeRoutePath("about/")).toBe("/about");
	});

	it("root with trailing slash → /", () => {
		expect(normalizeRoutePath("//")).toBe("/");
	});
});

// ─── buildLocalePath unit tests (round-015 issue 002) ────────────────────────

describe("buildLocalePath", () => {
	it("en locale: path returned as-is regardless of prefix", () => {
		expect(buildLocalePath("/", "en")).toBe("/");
		expect(buildLocalePath("/about", "en")).toBe("/about");
		expect(buildLocalePath("/pt-br/", "en")).toBe("/pt-br/");
		expect(buildLocalePath("/en/", "en")).toBe("/en/");
	});

	it("pt-br locale: non-prefixed root mapped to /pt-br/", () => {
		expect(buildLocalePath("/", "pt-br")).toBe("/pt-br/");
	});

	it("pt-br locale: non-prefixed path prefixed with /pt-br", () => {
		expect(buildLocalePath("/about", "pt-br")).toBe("/pt-br/about");
	});

	it("idempotent for /pt-br/ prefix — no double-prefix /pt-br/pt-br/", () => {
		expect(buildLocalePath("/pt-br/", "pt-br")).toBe("/pt-br/");
		expect(buildLocalePath("/pt-br", "pt-br")).toBe("/pt-br");
	});

	it("idempotent for /en/ prefix when locale is pt-br — no /pt-br/en/ produced", () => {
		// This is the bug fixed in round-015: the old hardcoded /pt-br/ check
		// would silently produce /pt-br/en/ for an already-prefixed /en/ path.
		expect(buildLocalePath("/en/", "pt-br")).toBe("/en/");
		expect(buildLocalePath("/en", "pt-br")).toBe("/en");
	});
});
