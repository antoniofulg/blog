import "./happydom";

/**
 * A11y and responsive unit tests for analytics dashboard widgets (task_19).
 *
 * Tests:
 *  - TopPostsTable: sticky first column classes (AC-3)
 *  - DailyTrendChart: sr-only table with same row count as data (AC-6)
 *  - ReferrerSourcesBar: sr-only table with raw referrer rows (AC-6)
 *  - DeviceSplitDonut: sr-only table with 3 device rows (AC-6)
 *  - DeviceSplitDonut: correct responsive visibility classes (AC-4)
 *
 * Uses React.createElement (no JSX) and .ts extension per project convention.
 * Recharts mocked to avoid ResizeObserver / SVG failures in jsdom.
 */

import { afterEach, describe, expect, mock, test } from "bun:test";

const { cleanup, render, screen, within } = await import(
	"@testing-library/react"
);

import React from "react";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Recharts mock — same pattern as admin-analytics-route.test.ts
mock.module("recharts", () => ({
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
			{ "data-testid": "bar-chart", "data-count": data?.length ?? 0 },
			children,
		),
	Bar: ({ dataKey }: { dataKey: string }) =>
		React.createElement("div", { "data-testid": "bar", "data-key": dataKey }),
	PieChart: ({ children }: { children: React.ReactNode }) =>
		React.createElement("div", { "data-testid": "pie-chart" }, children),
	Pie: ({
		data,
		innerRadius,
		children,
	}: {
		data: unknown[];
		innerRadius: number;
		children?: React.ReactNode;
	}) =>
		React.createElement(
			"div",
			{
				"data-testid": "pie",
				"data-count": data.length,
				"data-inner-radius": innerRadius,
			},
			children,
		),
	Cell: ({ fill }: { fill: string }) =>
		React.createElement("div", { "data-testid": "cell", "data-fill": fill }),
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

// Mock locale — must export LOCALES so strings.ts validation works at import time.
mock.module("#/lib/locale", () => ({
	useLocale: () => ({ locale: "en" }),
	LOCALES: ["en", "pt-br"],
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

const { DailyTrendChart } = await import(
	"#/components/admin/analytics/daily-trend-chart"
);
const { DeviceSplitDonut } = await import(
	"#/components/admin/analytics/device-split-donut"
);
const { ReferrerSourcesBar } = await import(
	"#/components/admin/analytics/referrer-sources-bar"
);
const { TopPostsTable } = await import(
	"#/components/admin/analytics/top-posts-table"
);
const { strings } = await import("#/lib/i18n/strings");

// ── Fixtures ──────────────────────────────────────────────────────────────────

const DAILY_TREND = [
	{ date: "2025-01-01", count: 10 },
	{ date: "2025-01-02", count: 15 },
	{ date: "2025-01-03", count: 8 },
];

const REFERRER_BY_DAY = [
	{ date: "2025-01-01", source: "google", count: 5 },
	{ date: "2025-01-01", source: "linkedin", count: 3 },
	{ date: "2025-01-02", source: "google", count: 7 },
];

const DEVICE_SPLIT = { mobile: 30, tablet: 10, desktop: 60 };

const TOP_POSTS = [
	{
		postId: 1,
		slug: "hello",
		title: "Hello World",
		lang: "en" as const,
		count: 50,
		sparkline: [1, 2, 3],
	},
	{
		postId: 2,
		slug: "world",
		title: "Another Post",
		lang: "pt-br" as const,
		count: 30,
		sparkline: [3, 2, 1],
	},
];

const noop = () => {};

afterEach(cleanup);

// ── TopPostsTable: sticky first column (AC-3) ─────────────────────────────────

describe("TopPostsTable sticky first column (AC-3)", () => {
	test("first <th> has 'sticky' class", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const table = screen.getByTestId("top-posts-table");
		const firstTh = table.querySelector("thead th:first-child");
		expect(firstTh?.className).toContain("sticky");
	});

	test("first <th> has 'left-0' class", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const table = screen.getByTestId("top-posts-table");
		const firstTh = table.querySelector("thead th:first-child");
		expect(firstTh?.className).toContain("left-0");
	});

	test("first <td> in data rows has 'sticky' class", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const table = screen.getByTestId("top-posts-table");
		const firstTd = table.querySelector("tbody tr:first-child td:first-child");
		expect(firstTd?.className).toContain("sticky");
	});

	test("first <td> in data rows has 'left-0' class", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const table = screen.getByTestId("top-posts-table");
		const firstTd = table.querySelector("tbody tr:first-child td:first-child");
		expect(firstTd?.className).toContain("left-0");
	});

	test("first <th> has 'bg-card' class (sticky background)", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const table = screen.getByTestId("top-posts-table");
		const firstTh = table.querySelector("thead th:first-child");
		expect(firstTh?.className).toContain("bg-card");
	});

	test("first <td> has 'bg-card' class (sticky background)", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const table = screen.getByTestId("top-posts-table");
		const firstTd = table.querySelector("tbody tr:first-child td:first-child");
		expect(firstTd?.className).toContain("bg-card");
	});
});

// ── DailyTrendChart: sr-only table (AC-6) ─────────────────────────────────────

describe("DailyTrendChart sr-only table (AC-6)", () => {
	test("renders a <table> with aria-label matching the widget title", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: DAILY_TREND,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.dailyTrend,
		});
		expect(srTable).toBeDefined();
	});

	test("sr-only table has the same number of data rows as dailyTrend input", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: DAILY_TREND,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.dailyTrend,
		});
		// thead row + 3 data rows = 4 total rows
		const rows = within(srTable).getAllByRole("row");
		expect(rows).toHaveLength(DAILY_TREND.length + 1); // +1 for header row
	});

	test("sr-only table has Date and Visits column headers", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: DAILY_TREND,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.dailyTrend,
		});
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.a11y.columnDate,
			}),
		).toBeDefined();
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.topPostsTable.columnVisits,
			}),
		).toBeDefined();
	});

	test("sr-only table has class 'sr-only' for visual hiding", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: DAILY_TREND,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.dailyTrend,
		});
		expect(srTable.className).toContain("sr-only");
	});

	test("does not render sr-only table when dailyTrend is empty", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: [],
				locale: "en",
			}),
		);
		const tables = screen.queryAllByRole("table");
		expect(tables).toHaveLength(0);
	});
});

// ── ReferrerSourcesBar: sr-only table (AC-6) ──────────────────────────────────

describe("ReferrerSourcesBar sr-only table (AC-6)", () => {
	test("renders a <table> with aria-label matching the widget title", () => {
		render(
			React.createElement(ReferrerSourcesBar, {
				referrerByDay: REFERRER_BY_DAY,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.referrerSources,
		});
		expect(srTable).toBeDefined();
	});

	test("sr-only table has the same number of data rows as referrerByDay input", () => {
		render(
			React.createElement(ReferrerSourcesBar, {
				referrerByDay: REFERRER_BY_DAY,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.referrerSources,
		});
		const rows = within(srTable).getAllByRole("row");
		expect(rows).toHaveLength(REFERRER_BY_DAY.length + 1); // +1 for header
	});

	test("sr-only table has Date, Source, and Visits column headers", () => {
		render(
			React.createElement(ReferrerSourcesBar, {
				referrerByDay: REFERRER_BY_DAY,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.referrerSources,
		});
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.a11y.columnDate,
			}),
		).toBeDefined();
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.a11y.columnSource,
			}),
		).toBeDefined();
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.topPostsTable.columnVisits,
			}),
		).toBeDefined();
	});
});

// ── DeviceSplitDonut: sr-only table (AC-6) + visibility classes (AC-4) ────────

describe("DeviceSplitDonut sr-only table (AC-6)", () => {
	test("renders a <table> with aria-label matching the widget title", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.deviceSplit,
		});
		expect(srTable).toBeDefined();
	});

	test("sr-only table has exactly 3 data rows (mobile, tablet, desktop)", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.deviceSplit,
		});
		const rows = within(srTable).getAllByRole("row");
		expect(rows).toHaveLength(4); // 1 header + 3 data rows
	});

	test("sr-only table has Device and Visits column headers", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const srTable = screen.getByRole("table", {
			name: strings.en.admin.analytics.widgets.deviceSplit,
		});
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.a11y.columnDevice,
			}),
		).toBeDefined();
		expect(
			within(srTable).getByRole("columnheader", {
				name: strings.en.admin.analytics.topPostsTable.columnVisits,
			}),
		).toBeDefined();
	});

	test("does not render sr-only table when device split is all zeros", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: { mobile: 0, tablet: 0, desktop: 0 },
				locale: "en",
			}),
		);
		const tables = screen.queryAllByRole("table");
		expect(tables).toHaveLength(0);
	});
});

describe("DeviceSplitDonut responsive visibility classes (AC-4)", () => {
	test("donut wrapper has 'hidden' class (hidden on mobile)", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const donutWrapper = screen.getByTestId("device-donut-wrapper");
		expect(donutWrapper.className).toContain("hidden");
	});

	test("donut wrapper has 'min-[480px]:block' class (visible above 480px)", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const donutWrapper = screen.getByTestId("device-donut-wrapper");
		expect(donutWrapper.className).toContain("min-[480px]:block");
	});

	test("bar wrapper has 'block' class (visible on mobile)", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const barWrapper = screen.getByTestId("device-bar-wrapper");
		expect(barWrapper.className).toContain("block");
	});

	test("bar wrapper has 'min-[480px]:hidden' class (hidden above 480px)", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const barWrapper = screen.getByTestId("device-bar-wrapper");
		expect(barWrapper.className).toContain("min-[480px]:hidden");
	});
});

// ── Aria-label on chart containers ────────────────────────────────────────────

describe("Chart container aria-labels", () => {
	test("DailyTrendChart container has aria-label", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: DAILY_TREND,
				locale: "en",
			}),
		);
		const container = screen.getByTestId("daily-trend-chart");
		expect(container.getAttribute("aria-label")).toBe(
			strings.en.admin.analytics.widgets.dailyTrend,
		);
	});

	test("ReferrerSourcesBar container has aria-label", () => {
		render(
			React.createElement(ReferrerSourcesBar, {
				referrerByDay: REFERRER_BY_DAY,
				locale: "en",
			}),
		);
		const container = screen.getByTestId("referrer-sources-bar");
		expect(container.getAttribute("aria-label")).toBe(
			strings.en.admin.analytics.widgets.referrerSources,
		);
	});

	test("DeviceSplitDonut container has aria-label", () => {
		render(
			React.createElement(DeviceSplitDonut, {
				deviceSplit: DEVICE_SPLIT,
				locale: "en",
			}),
		);
		const container = screen.getByTestId("device-split-donut");
		expect(container.getAttribute("aria-label")).toBe(
			strings.en.admin.analytics.widgets.deviceSplit,
		);
	});

	test("TopPostsTable container has aria-label", () => {
		render(
			React.createElement(TopPostsTable, {
				topPosts: TOP_POSTS,
				locale: "en",
				onRowClick: noop,
			}),
		);
		const container = screen.getByTestId("top-posts-table");
		expect(container.getAttribute("aria-label")).toBe(
			strings.en.admin.analytics.widgets.topPosts,
		);
	});
});
