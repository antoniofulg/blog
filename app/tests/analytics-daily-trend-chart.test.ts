// @vitest-environment jsdom
/**
 * Unit tests for DailyTrendChart component and detectPeaks helper.
 *
 * Tests verify: correct data-point count passed to chart, peak detection
 * logic, ReferenceDot rendering for peak markers, chart container presence,
 * and locale-driven tick/title labels.
 *
 * Recharts is fully mocked — jsdom has no ResizeObserver or SVG layout.
 */
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock state ────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	let locale: "en" | "pt-br" = "en";
	return {
		setLocale: (l: "en" | "pt-br") => {
			locale = l;
		},
		getLocale: () => locale,
	};
});

// ── Module mocks ──────────────────────────────────────────────────────────────

// Provide LOCALES so strings.ts module-level validation loop works.
vi.mock("#/lib/locale", () => ({
	useLocale: () => ({ locale: mocks.getLocale() }),
	LOCALES: ["en", "pt-br"],
}));

// Stub Recharts primitives — jsdom has no ResizeObserver / SVG layout support.
// LineChart exposes data length via data-count; ReferenceDot exposes x/y for
// peak assertions.
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

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import {
	DailyTrendChart,
	detectPeaks,
} from "#/components/admin/analytics/daily-trend-chart";
import type { AnalyticsDashboardData } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

type DailyTrendData = AnalyticsDashboardData["dailyTrend"];

/** Generate n sequential daily data points starting from 2025-01-01. */
function makeTrend(counts: number[], startDate = "2025-01-01"): DailyTrendData {
	const start = new Date(startDate);
	return counts.map((count, i) => {
		const d = new Date(start);
		d.setUTCDate(d.getUTCDate() + i);
		return {
			date: d.toISOString().slice(0, 10),
			count,
		};
	});
}

function renderChart(trend: DailyTrendData, locale: "en" | "pt-br" = "en") {
	mocks.setLocale(locale);
	return render(
		React.createElement(DailyTrendChart, { dailyTrend: trend, locale }),
	);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	mocks.setLocale("en");
});

afterEach(cleanup);

// ── detectPeaks unit tests ────────────────────────────────────────────────────

describe("detectPeaks", () => {
	it("returns top 3 days by count for a known dataset", () => {
		const data = makeTrend([10, 50, 5, 80, 20, 70, 3]);
		const peaks = detectPeaks(data);
		expect(peaks).toHaveLength(3);
		const counts = peaks.map((p) => p.count).sort((a, b) => b - a);
		// Top 3 should be 80, 70, 50
		expect(counts).toEqual([80, 70, 50]);
	});

	it("returns top 3 preserving original insertion order", () => {
		const data = makeTrend([10, 50, 5, 80, 20, 70, 3]);
		const peaks = detectPeaks(data);
		// Original positions: 50 at idx 1, 80 at idx 3, 70 at idx 5.
		// detectPeaks preserves order → [50, 80, 70].
		expect(peaks.map((p) => p.count)).toEqual([50, 80, 70]);
	});

	it("returns all items when data.length <= 3", () => {
		const data = makeTrend([10, 50, 5]);
		const peaks = detectPeaks(data);
		expect(peaks).toHaveLength(3);
	});

	it("returns a shallow copy when data.length === n", () => {
		const data = makeTrend([10, 50, 5]);
		const peaks = detectPeaks(data, 3);
		expect(peaks).not.toBe(data); // different reference
		expect(peaks).toEqual(data);
	});

	it("handles n=1 (single peak)", () => {
		const data = makeTrend([10, 50, 5, 80, 20]);
		const peaks = detectPeaks(data, 1);
		expect(peaks).toHaveLength(1);
		expect(peaks[0].count).toBe(80);
	});

	it("handles all-equal counts — returns first n in order", () => {
		const data = makeTrend([5, 5, 5, 5, 5]);
		const peaks = detectPeaks(data, 3);
		expect(peaks).toHaveLength(3);
		// All equal, so first 3 are returned.
		expect(peaks.map((p) => p.count)).toEqual([5, 5, 5]);
	});

	it("returns empty array for empty input", () => {
		const peaks = detectPeaks([]);
		expect(peaks).toEqual([]);
	});

	it("returns single item for a single-item array", () => {
		const data = makeTrend([42]);
		const peaks = detectPeaks(data);
		expect(peaks).toHaveLength(1);
		expect(peaks[0].count).toBe(42);
	});
});

// ── DailyTrendChart component tests ──────────────────────────────────────────

describe("DailyTrendChart — rendering", () => {
	it("renders the chart wrapper with data-testid='daily-trend-chart'", () => {
		renderChart(makeTrend([10, 20, 30]));
		expect(screen.getByTestId("daily-trend-chart")).toBeDefined();
	});

	it("passes correct number of data points to LineChart (30-day dataset)", () => {
		const trend = makeTrend(Array.from({ length: 30 }, (_, i) => i + 1));
		renderChart(trend);
		const chart = screen.getByTestId("line-chart");
		expect(chart.getAttribute("data-count")).toBe("30");
	});

	it("passes correct count for a 7-day dataset", () => {
		const trend = makeTrend([5, 10, 8, 15, 6, 12, 9]);
		renderChart(trend);
		const chart = screen.getByTestId("line-chart");
		expect(chart.getAttribute("data-count")).toBe("7");
	});

	it("passes correct count for a 90-day dataset", () => {
		const trend = makeTrend(Array.from({ length: 90 }, (_, i) => i + 1));
		renderChart(trend);
		const chart = screen.getByTestId("line-chart");
		expect(chart.getAttribute("data-count")).toBe("90");
	});
});

// ── Peak marker tests ─────────────────────────────────────────────────────────

describe("DailyTrendChart — peak markers (ReferenceDot)", () => {
	it("renders exactly 3 ReferenceDot markers for a dataset with >= 3 points", () => {
		const trend = makeTrend([10, 50, 5, 80, 20, 70, 3]);
		renderChart(trend);
		const dots = screen.getAllByTestId("reference-dot");
		expect(dots).toHaveLength(3);
	});

	it("renders peak dots with the correct x (date) values", () => {
		const trend = makeTrend([10, 50, 5, 80, 20, 70, 3]);
		renderChart(trend);
		const dots = screen.getAllByTestId("reference-dot");
		const xValues = dots.map((d) => d.getAttribute("data-x")).sort();
		// Peaks are at indices 1, 3, 5 → dates "2025-01-02", "2025-01-04", "2025-01-06"
		expect(xValues).toEqual(["2025-01-02", "2025-01-04", "2025-01-06"].sort());
	});

	it("renders fewer than 3 dots when dataset has < 3 points", () => {
		const trend = makeTrend([10, 50]);
		renderChart(trend);
		const dots = screen.getAllByTestId("reference-dot");
		expect(dots).toHaveLength(2);
	});

	it("renders 0 ReferenceDots for an empty dataset", () => {
		renderChart([]);
		const dots = screen.queryAllByTestId("reference-dot");
		expect(dots).toHaveLength(0);
	});
});

// ── Empty state (task_18) ─────────────────────────────────────────────────────

describe("DailyTrendChart — empty state", () => {
	it("renders EmptyState with awaitingData when dailyTrend is empty and no postId", () => {
		renderChart([]);
		expect(screen.getByTestId("daily-trend-chart")).toBeDefined();
		expect(
			screen.getByText(strings.en.admin.analytics.empty.awaitingData),
		).toBeDefined();
	});

	it("renders awaitingDataDescription when dailyTrend is empty and no postId", () => {
		renderChart([]);
		expect(
			screen.getByText(
				strings.en.admin.analytics.empty.awaitingDataDescription,
			),
		).toBeDefined();
	});

	it("does NOT render LineChart when dailyTrend is empty", () => {
		renderChart([]);
		expect(screen.queryByTestId("line-chart")).toBeNull();
	});

	it("renders filter-empty title when postId is set and dailyTrend is empty", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: [],
				locale: "en",
				postId: 7,
			}),
		);
		expect(
			screen.getByText(strings.en.admin.analytics.empty.noDataForPost),
		).toBeDefined();
	});

	it("renders filter-empty description when postId is set and dailyTrend is empty", () => {
		render(
			React.createElement(DailyTrendChart, {
				dailyTrend: [],
				locale: "en",
				postId: 7,
			}),
		);
		expect(
			screen.getByText(
				strings.en.admin.analytics.empty.noDataForPostDescription,
			),
		).toBeDefined();
	});

	it("does not show EmptyState when dailyTrend has data", () => {
		renderChart(makeTrend([10, 20]));
		expect(
			screen.queryByText(strings.en.admin.analytics.empty.awaitingData),
		).toBeNull();
		expect(screen.getByTestId("line-chart")).toBeDefined();
	});
});

// ── Widget title (locale) ─────────────────────────────────────────────────────

describe("DailyTrendChart — widget title", () => {
	it("renders widget title from en strings", () => {
		renderChart(makeTrend([10, 20]));
		expect(
			screen.getByText(strings.en.admin.analytics.widgets.dailyTrend),
		).toBeDefined();
	});

	it("renders widget title from pt-br strings", () => {
		renderChart(makeTrend([10, 20]), "pt-br");
		expect(
			screen.getByText(strings["pt-br"].admin.analytics.widgets.dailyTrend),
		).toBeDefined();
	});

	it("widget title differs between en and pt-br", () => {
		expect(strings.en.admin.analytics.widgets.dailyTrend).not.toBe(
			strings["pt-br"].admin.analytics.widgets.dailyTrend,
		);
	});
});
