// @vitest-environment jsdom
/**
 * Unit tests for the /admin/analytics route, server fn, and search-param schema.
 *
 * Component rendering is tested with @testing-library/react in jsdom.
 * Server fn and schema tests run in the same env (jsdom is permissive enough).
 */
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock state ────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	type Locale = "en" | "pt-br";

	const state = {
		loaderData: undefined as unknown,
		locale: "en" as Locale,
		requireSessionShouldThrow: false,
		dashboardResult: undefined as unknown,
	};
	const callOrder: string[] = [];
	const requireSessionSpy = vi.fn();
	const getDashboardSpy = vi.fn();
	const navigateSpy = vi.fn();

	return { state, callOrder, requireSessionSpy, getDashboardSpy, navigateSpy };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

// Strip server-only guard so imports don't throw in node/jsdom.
vi.mock("@tanstack/react-start/server-only", () => ({}));

// Make createServerFn transparent — returns the raw handler function.
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

// Give Route a controllable useLoaderData / useSearch / useNavigate.
// Plain mock — no importOriginal to avoid loading two React instances.
// lazyRouteComponent stub is required: TanStack Start Vite plugin injects a check for it.
vi.mock("@tanstack/react-router", () => ({
	createFileRoute:
		(_path: string) =>
		(opts: Record<string, unknown>): Record<string, unknown> => ({
			...opts,
			useLoaderData: () => mocks.state.loaderData,
			useSearch: () => ({ range: "30d" as const }),
			useNavigate: () => mocks.navigateSpy,
		}),
	redirect: (opts: unknown) => ({
		__redirect: true,
		...(opts as object),
	}),
	isRedirect: (e: unknown) =>
		typeof e === "object" && e !== null && "__redirect" in e,
	// TanStack Start plugin injects an import of lazyRouteComponent in route files.
	lazyRouteComponent: (fn: () => unknown) => fn,
}));

// Stub Recharts so jsdom tests don't fail on ResizeObserver / SVG layout.
vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
		children,
	LineChart: ({
		children,
		data,
	}: {
		children: React.ReactNode;
		data: unknown[];
	}) =>
		React.createElement(
			"div",
			{ "data-testid": "line-chart", "data-count": data.length },
			children,
		),
	BarChart: ({
		children,
		data,
	}: {
		children: React.ReactNode;
		data: unknown[];
	}) =>
		React.createElement(
			"div",
			{ "data-testid": "bar-chart", "data-count": data.length },
			children,
		),
	Bar: ({ dataKey }: { dataKey: string }) =>
		React.createElement("div", { "data-testid": "bar", "data-key": dataKey }),
	Legend: () =>
		React.createElement("div", { "data-testid": "recharts-legend" }),
	Line: () => null,
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
	CartesianGrid: () => null,
	ReferenceDot: ({ x, y }: { x: string; y: number }) =>
		React.createElement("div", {
			"data-testid": "reference-dot",
			"data-x": x,
			"data-y": y,
		}),
}));

// Mock locale — must export LOCALES so strings.ts validation loop works.
vi.mock("#/lib/locale", () => ({
	useLocale: () => ({ locale: mocks.state.locale }),
	LOCALES: ["en", "pt-br"],
}));

// Mock session — controllable throw to simulate 401.
vi.mock("#/lib/session", () => ({
	requireSession: async () => {
		mocks.requireSessionSpy();
		mocks.callOrder.push("requireSession");
		if (mocks.state.requireSessionShouldThrow) {
			throw new Response("Unauthorized", { status: 401 });
		}
	},
}));

// Mock analytics-queries — spy + controllable result.
vi.mock("#/db/analytics-queries", () => ({
	getAnalyticsDashboard: async (...args: unknown[]) => {
		mocks.getDashboardSpy(...args);
		mocks.callOrder.push("getAnalyticsDashboard");
		return mocks.state.dashboardResult;
	},
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import { strings } from "#/lib/i18n/strings";
import {
	AnalyticsDashboard,
	analyticsSearchSchema,
	Route,
} from "#/routes/admin/analytics/index";
import {
	getAnalyticsDashboardFn,
	getAnalyticsDashboardHandler,
} from "#/routes/admin/analytics/index.server";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeDashboardData() {
	return {
		summary: {
			totalVisits: 100,
			uniquePosts: 5,
			topReferrer: { source: "google", count: 40 },
			topLanguage: { lang: "en" as const, count: 60 },
			previousPeriodTotal: 80,
		},
		dailyTrend: [{ date: "2025-01-01", count: 10 }],
		referrerByDay: [{ date: "2025-01-01", source: "google", count: 10 }],
		topPosts: [
			{
				postId: 1,
				slug: "hello",
				title: "Hello",
				lang: "en" as const,
				count: 50,
				sparkline: [1, 2, 3],
			},
		],
		deviceSplit: { mobile: 30, tablet: 10, desktop: 60 },
	};
}

// ── Reset between tests ───────────────────────────────────────────────────────

beforeEach(() => {
	mocks.callOrder.length = 0;
	mocks.requireSessionSpy.mockClear();
	mocks.getDashboardSpy.mockClear();
	mocks.navigateSpy.mockClear();
	mocks.state.requireSessionShouldThrow = false;
	mocks.state.locale = "en";
	mocks.state.loaderData = makeDashboardData();
	mocks.state.dashboardResult = makeDashboardData();
});

afterEach(cleanup);

// ── analyticsSearchSchema ─────────────────────────────────────────────────────

describe("analyticsSearchSchema", () => {
	describe("range field", () => {
		it("defaults to '30d' when range is absent", () => {
			const result = analyticsSearchSchema.parse({});
			expect(result.range).toBe("30d");
		});

		it("accepts all valid range values", () => {
			for (const r of ["7d", "30d", "90d", "mtd", "ytd", "all"] as const) {
				expect(analyticsSearchSchema.parse({ range: r }).range).toBe(r);
			}
		});

		it("falls back to '30d' for an invalid range string", () => {
			const result = analyticsSearchSchema.parse({ range: "foo" });
			expect(result.range).toBe("30d");
		});

		it("falls back to '30d' for numeric range value", () => {
			const result = analyticsSearchSchema.parse({ range: 99 });
			expect(result.range).toBe("30d");
		});
	});

	describe("postId field", () => {
		it("is undefined when absent", () => {
			const result = analyticsSearchSchema.parse({ range: "30d" });
			expect(result.postId).toBeUndefined();
		});

		it("accepts a valid positive integer", () => {
			const result = analyticsSearchSchema.parse({ range: "30d", postId: 42 });
			expect(result.postId).toBe(42);
		});

		it("coerces a numeric string to a number", () => {
			const result = analyticsSearchSchema.parse({ range: "30d", postId: "7" });
			expect(result.postId).toBe(7);
		});

		it("rejects a negative postId (returns undefined)", () => {
			const result = analyticsSearchSchema.parse({
				range: "30d",
				postId: -1,
			});
			expect(result.postId).toBeUndefined();
		});

		it("rejects zero postId (returns undefined — not positive)", () => {
			const result = analyticsSearchSchema.parse({
				range: "30d",
				postId: 0,
			});
			expect(result.postId).toBeUndefined();
		});

		it("rejects a non-numeric string postId (returns undefined)", () => {
			const result = analyticsSearchSchema.parse({
				range: "30d",
				postId: "abc",
			});
			expect(result.postId).toBeUndefined();
		});
	});
});

// ── getAnalyticsDashboardFn ───────────────────────────────────────────────────

describe("getAnalyticsDashboardFn", () => {
	it("delegates to getAnalyticsDashboard with the input", async () => {
		const input = { range: "30d" as const };
		const result = await getAnalyticsDashboardFn(input);
		expect(mocks.getDashboardSpy).toHaveBeenCalledWith(input);
		expect(result).toEqual(mocks.state.dashboardResult);
	});

	it("passes postId filter through to getAnalyticsDashboard", async () => {
		const input = { range: "7d" as const, postId: 42 };
		await getAnalyticsDashboardFn(input);
		expect(mocks.getDashboardSpy).toHaveBeenCalledWith(input);
	});

	it("returns the shape matching AnalyticsDashboardData (mocked DB)", async () => {
		const data = await getAnalyticsDashboardFn({ range: "30d" });
		expect(data).toHaveProperty("summary");
		expect(data).toHaveProperty("dailyTrend");
		expect(data).toHaveProperty("referrerByDay");
		expect(data).toHaveProperty("topPosts");
		expect(data).toHaveProperty("deviceSplit");
	});
});

// ── getAnalyticsDashboardHandler (auth-gated handler, tested directly) ─────────
// Tests target getAnalyticsDashboardHandler because the Vite plugin transforms
// createServerFn().handler() into a client-side RPC proxy (start-client-core).
// This matches the pattern in admin-routes.test.ts which tests getAllPostsFn
// directly rather than the getAllPosts server fn wrapper.

describe("getAnalyticsDashboardHandler (auth gate)", () => {
	it("calls requireSession before getAnalyticsDashboard", async () => {
		await getAnalyticsDashboardHandler({ range: "30d" });

		const reqIdx = mocks.callOrder.indexOf("requireSession");
		const dbIdx = mocks.callOrder.indexOf("getAnalyticsDashboard");
		expect(reqIdx).toBeGreaterThanOrEqual(0);
		expect(dbIdx).toBeGreaterThan(reqIdx);
	});

	it("calls requireSession exactly once per invocation", async () => {
		await getAnalyticsDashboardHandler({ range: "30d" });
		expect(mocks.requireSessionSpy).toHaveBeenCalledTimes(1);
	});

	it("throws 401 Response when session is missing", async () => {
		mocks.state.requireSessionShouldThrow = true;
		await expect(
			getAnalyticsDashboardHandler({ range: "30d" }),
		).rejects.toBeInstanceOf(Response);
	});

	it("does not call getAnalyticsDashboard when session is missing", async () => {
		mocks.state.requireSessionShouldThrow = true;
		await getAnalyticsDashboardHandler({ range: "30d" }).catch(() => {});
		expect(mocks.getDashboardSpy).not.toHaveBeenCalled();
	});

	it("passes the data input through to getAnalyticsDashboardFn", async () => {
		await getAnalyticsDashboardHandler({ range: "90d", postId: 5 });
		expect(mocks.getDashboardSpy).toHaveBeenCalledWith({
			range: "90d",
			postId: 5,
		});
	});
});

// ── AnalyticsDashboard component ──────────────────────────────────────────────
// Tests import AnalyticsDashboard directly (it's exported from index.tsx) to
// avoid the TanStack Start Vite plugin's lazyRouteComponent transform on
// Route.component, which would cause Suspense during render.

describe("AnalyticsDashboard component", () => {
	it("renders the page title in English from strings", () => {
		mocks.state.locale = "en";
		render(React.createElement(AnalyticsDashboard));
		expect(screen.getByRole("heading", { level: 1 })).toBeDefined();
		expect(
			screen.getByText(strings.en.admin.analytics.pageTitle),
		).toBeDefined();
	});

	it("renders the page title in pt-br from strings", () => {
		mocks.state.locale = "pt-br";
		render(React.createElement(AnalyticsDashboard));
		expect(
			screen.getByText(strings["pt-br"].admin.analytics.pageTitle),
		).toBeDefined();
	});

	it("renders the SummaryCards component with 4 cards (task 12)", () => {
		mocks.state.locale = "en";
		render(React.createElement(AnalyticsDashboard));
		// SummaryCards renders 4 label spans — verify at least the totalVisits label
		// is present, confirming the component mounted and received loader data.
		expect(
			screen.getByText(strings.en.admin.analytics.summary.totalVisits),
		).toBeDefined();
	});

	it("renders the DailyTrendChart widget (task 13)", () => {
		render(React.createElement(AnalyticsDashboard));
		expect(screen.getByTestId("daily-trend-chart")).toBeDefined();
	});

	it("renders the RangeSelector widget (task 13)", () => {
		render(React.createElement(AnalyticsDashboard));
		expect(screen.getByTestId("range-selector")).toBeDefined();
	});

	it("renders the referrer sources bar widget (task 14)", () => {
		render(React.createElement(AnalyticsDashboard));
		expect(screen.getByTestId("referrer-sources-bar")).toBeDefined();
	});

	it("renders the top posts table widget (task 15)", () => {
		render(React.createElement(AnalyticsDashboard));
		expect(screen.getByTestId("top-posts-table")).toBeDefined();
	});

	it("top posts table row click calls navigate with functional postId updater (AC-3)", () => {
		render(React.createElement(AnalyticsDashboard));
		const table = screen.getByTestId("top-posts-table");
		const rows = within(table).getAllByRole("button");
		fireEvent.click(rows[0]);
		expect(mocks.navigateSpy).toHaveBeenCalledTimes(1);
		// Verify navigate received a functional updater that correctly sets postId.
		const callArg = mocks.navigateSpy.mock.calls[0][0] as {
			search: (prev: { range: string; postId?: number }) => {
				range: string;
				postId?: number;
			};
		};
		const updater = callArg.search;
		// Functional updater must preserve range while setting postId.
		const result = updater({ range: "90d" });
		expect(result.range).toBe("90d");
		expect(result.postId).toBe(1); // makeDashboardData topPosts[0].postId === 1
	});

	it("renders the device split placeholder slot", () => {
		render(React.createElement(AnalyticsDashboard));
		expect(screen.getByTestId("device-split-placeholder")).toBeDefined();
	});

	it("page title matches strings for both locales", () => {
		mocks.state.locale = "en";
		const { unmount } = render(React.createElement(AnalyticsDashboard));
		const enTitle = screen.getByRole("heading", { level: 1 }).textContent;
		unmount();

		mocks.state.locale = "pt-br";
		render(React.createElement(AnalyticsDashboard));
		const ptTitle = screen.getByRole("heading", { level: 1 }).textContent;

		expect(enTitle).toBe(strings.en.admin.analytics.pageTitle);
		expect(ptTitle).toBe(strings["pt-br"].admin.analytics.pageTitle);
	});
});

// ── beforeLoad auth guard ─────────────────────────────────────────────────────

describe("beforeLoad auth guard", () => {
	type RouteOpts = {
		beforeLoad?: (args: {
			context: { auth: { user: unknown } };
			location: { href: string };
		}) => void;
	};
	const routeOpts = Route as unknown as RouteOpts;

	it("redirects to /login when context.auth.user is null", () => {
		let threw: unknown;
		try {
			routeOpts.beforeLoad?.({
				context: { auth: { user: null } },
				location: { href: "/admin/analytics" },
			});
		} catch (e) {
			threw = e;
		}
		expect(threw).toBeDefined();
		expect((threw as { __redirect: boolean }).__redirect).toBe(true);
	});

	it("does not redirect when context.auth.user is set", () => {
		let threw = false;
		try {
			routeOpts.beforeLoad?.({
				context: { auth: { user: { id: "1", email: "a@b.com" } } },
				location: { href: "/admin/analytics" },
			});
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});
