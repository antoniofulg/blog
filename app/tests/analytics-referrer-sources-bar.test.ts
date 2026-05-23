// @vitest-environment jsdom
/**
 * Unit tests for ReferrerSourcesBar component and pivotReferrerByDay helper.
 *
 * Tests verify: pivot logic (long → wide), missing-source handling, legend
 * rendering, empty-data behaviour, and locale-driven widget title.
 *
 * Recharts is fully mocked — jsdom has no ResizeObserver or SVG layout.
 * All component tests use React.createElement (no JSX) and .ts extension
 * to match the project's vitest include pattern.
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

// Stub Recharts — jsdom has no ResizeObserver / SVG layout support.
// BarChart exposes data length via data-count.
// Bar exposes dataKey and stackId for assertion.
// Legend renders a div so we can assert its presence.
vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
		children,
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
	Bar: ({ dataKey, stackId }: { dataKey: string; stackId: string }) =>
		React.createElement("div", {
			"data-testid": "bar",
			"data-key": dataKey,
			"data-stack-id": stackId,
		}),
	Legend: () =>
		React.createElement("div", { "data-testid": "recharts-legend" }),
	XAxis: () => null,
	YAxis: () => null,
	Tooltip: () => null,
	CartesianGrid: () => null,
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import {
	pivotReferrerByDay,
	ReferrerSourcesBar,
	SOURCE_COLOR_MAP,
} from "#/components/admin/analytics/referrer-sources-bar";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

type ReferrerEntry = { date: string; source: string; count: number };

function makeEntry(date: string, source: string, count: number): ReferrerEntry {
	return { date, source, count };
}

function renderBar(
	referrerByDay: ReferrerEntry[],
	locale: "en" | "pt-br" = "en",
) {
	mocks.setLocale(locale);
	return render(
		React.createElement(ReferrerSourcesBar, { referrerByDay, locale }),
	);
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	mocks.setLocale("en");
});

afterEach(cleanup);

// ── pivotReferrerByDay unit tests ─────────────────────────────────────────────

describe("pivotReferrerByDay", () => {
	it("returns an empty array for empty input", () => {
		expect(pivotReferrerByDay([])).toEqual([]);
	});

	it("converts a single row to a wide entry", () => {
		const input = [makeEntry("2025-01-01", "google", 5)];
		const result = pivotReferrerByDay(input);
		expect(result).toHaveLength(1);
		expect(result[0].date).toBe("2025-01-01");
		expect(result[0].google).toBe(5);
	});

	it("groups multiple sources on the same date into one wide entry", () => {
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-01", "linkedin", 3),
			makeEntry("2025-01-01", "direct", 7),
		];
		const result = pivotReferrerByDay(input);
		expect(result).toHaveLength(1);
		expect(result[0].google).toBe(5);
		expect(result[0].linkedin).toBe(3);
		expect(result[0].direct).toBe(7);
	});

	it("produces one wide entry per unique date", () => {
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-02", "github", 2),
			makeEntry("2025-01-03", "direct", 9),
		];
		const result = pivotReferrerByDay(input);
		expect(result).toHaveLength(3);
		const dates = result.map((r) => r.date).sort();
		expect(dates).toEqual(["2025-01-01", "2025-01-02", "2025-01-03"]);
	});

	it("handles missing sources for a given date — key is absent (Recharts treats undefined as 0)", () => {
		// date "2025-01-01" has google but not linkedin
		// date "2025-01-02" has linkedin but not google
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-02", "linkedin", 3),
		];
		const result = pivotReferrerByDay(input);
		const day1 = result.find((r) => r.date === "2025-01-01");
		const day2 = result.find((r) => r.date === "2025-01-02");
		// Missing source key is absent (undefined), not explicitly 0
		// Recharts stacked bars treat missing keys as 0 in render
		// Optional chaining: if entry is somehow absent, access returns undefined anyway
		expect(day1?.linkedin).toBeUndefined();
		expect(day2?.google).toBeUndefined();
	});

	it("sums multiple rows for the same (date, source) pair", () => {
		const input = [
			makeEntry("2025-01-01", "google", 3),
			makeEntry("2025-01-01", "google", 7),
		];
		const result = pivotReferrerByDay(input);
		expect(result).toHaveLength(1);
		expect(result[0].google).toBe(10);
	});

	it("preserves insertion order of dates", () => {
		const input = [
			makeEntry("2025-01-03", "google", 1),
			makeEntry("2025-01-01", "github", 2),
			makeEntry("2025-01-02", "direct", 3),
		];
		const result = pivotReferrerByDay(input);
		expect(result.map((r) => r.date)).toEqual([
			"2025-01-03",
			"2025-01-01",
			"2025-01-02",
		]);
	});
});

// ── SOURCE_COLOR_MAP exhaustiveness ───────────────────────────────────────────

describe("SOURCE_COLOR_MAP", () => {
	it("maps all 12 ReferrerSource buckets", () => {
		const expectedSources = [
			"linkedin",
			"google",
			"github",
			"twitter",
			"reddit",
			"hackernews",
			"dev.to",
			"medium",
			"bluesky",
			"mastodon",
			"direct",
			"other",
		] as const;
		for (const source of expectedSources) {
			expect(SOURCE_COLOR_MAP[source]).toMatch(/^var\(--color-chart-\d+\)$/);
		}
	});

	it("maps every bucket to a CSS custom property reference", () => {
		for (const [, color] of Object.entries(SOURCE_COLOR_MAP)) {
			expect(color).toMatch(/^var\(--color-chart-\d+\)$/);
		}
	});
});

// ── ReferrerSourcesBar — rendering ───────────────────────────────────────────

describe("ReferrerSourcesBar — rendering", () => {
	it("renders wrapper with data-testid='referrer-sources-bar'", () => {
		renderBar([makeEntry("2025-01-01", "google", 5)]);
		expect(screen.getByTestId("referrer-sources-bar")).toBeDefined();
	});

	it("passes correct number of wide entries (days) to BarChart", () => {
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-01", "linkedin", 2),
			makeEntry("2025-01-02", "github", 3),
			makeEntry("2025-01-03", "direct", 8),
		];
		renderBar(input);
		const chart = screen.getByTestId("bar-chart");
		// 3 unique dates → 3 wide entries
		expect(chart.getAttribute("data-count")).toBe("3");
	});

	it("renders one Bar per active source (sources present in data)", () => {
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-01", "linkedin", 2),
			makeEntry("2025-01-02", "github", 3),
		];
		renderBar(input);
		const bars = screen.getAllByTestId("bar");
		// 3 distinct sources → 3 bars
		expect(bars).toHaveLength(3);
	});

	it("renders bars with the correct dataKey attributes", () => {
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-02", "linkedin", 3),
		];
		renderBar(input);
		const bars = screen.getAllByTestId("bar");
		const keys = bars.map((b) => b.getAttribute("data-key")).sort();
		expect(keys).toEqual(["google", "linkedin"].sort());
	});

	it("renders all bars with the same stackId (stacked chart)", () => {
		const input = [
			makeEntry("2025-01-01", "google", 5),
			makeEntry("2025-01-01", "linkedin", 3),
		];
		renderBar(input);
		const bars = screen.getAllByTestId("bar");
		const stackIds = bars.map((b) => b.getAttribute("data-stack-id"));
		// All bars must share the same non-null stackId
		expect(stackIds.every((id) => id !== null && id === stackIds[0])).toBe(
			true,
		);
	});

	it("renders the Legend component", () => {
		renderBar([makeEntry("2025-01-01", "google", 5)]);
		expect(screen.getByTestId("recharts-legend")).toBeDefined();
	});

	it("produces no Bar elements for empty input", () => {
		renderBar([]);
		const bars = screen.queryAllByTestId("bar");
		expect(bars).toHaveLength(0);
	});

	it("BarChart still renders with 0 entries for empty input", () => {
		renderBar([]);
		const chart = screen.getByTestId("bar-chart");
		expect(chart.getAttribute("data-count")).toBe("0");
	});
});

// ── Widget title (locale) ─────────────────────────────────────────────────────

describe("ReferrerSourcesBar — widget title", () => {
	it("renders widget title from en strings", () => {
		renderBar([makeEntry("2025-01-01", "google", 5)]);
		expect(
			screen.getByText(strings.en.admin.analytics.widgets.referrerSources),
		).toBeDefined();
	});

	it("renders widget title from pt-br strings", () => {
		renderBar([makeEntry("2025-01-01", "google", 5)], "pt-br");
		expect(
			screen.getByText(
				strings["pt-br"].admin.analytics.widgets.referrerSources,
			),
		).toBeDefined();
	});

	it("widget title differs between en and pt-br", () => {
		expect(strings.en.admin.analytics.widgets.referrerSources).not.toBe(
			strings["pt-br"].admin.analytics.widgets.referrerSources,
		);
	});
});
