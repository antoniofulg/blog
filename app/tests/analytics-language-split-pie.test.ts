// @vitest-environment jsdom
/**
 * Unit tests for LanguageSplitPie component + its computePercent helper.
 *
 * Verifies: percent computation, pie slice count + colors, localized slice
 * labels (English/Portuguese vs Inglês/Português), the sr-only data table,
 * zero-sum empty state, and the locale-driven widget title.
 *
 * Recharts is fully mocked — jsdom has no ResizeObserver or SVG layout.
 */
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Provide LOCALES so strings.ts module-level validation loop works, and so the
// component's `LOCALES.map(...)` produces the en + pt-br slices.
vi.mock("#/lib/locale", () => ({
	LOCALES: ["en", "pt-br"],
}));

vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
		children,
	PieChart: ({ children }: { children: React.ReactNode }) =>
		React.createElement("div", { "data-testid": "pie-chart" }, children),
	Pie: ({ data, children }: { data: unknown[]; children?: React.ReactNode }) =>
		React.createElement(
			"div",
			{ "data-testid": "pie", "data-count": data.length },
			children,
		),
	Cell: ({ fill }: { fill: string }) =>
		React.createElement("div", { "data-testid": "cell", "data-fill": fill }),
	Legend: () =>
		React.createElement("div", { "data-testid": "recharts-legend" }),
	Tooltip: () => null,
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import {
	computePercent,
	LANGUAGE_COLORS,
	LanguageSplitPie,
} from "#/components/admin/analytics/language-split-pie";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

type LanguageSplit = { en: number; "pt-br": number };

function renderPie(
	languageSplit: LanguageSplit,
	locale: "en" | "pt-br" = "en",
) {
	return render(
		React.createElement(LanguageSplitPie, { languageSplit, locale }),
	);
}

afterEach(cleanup);

// ── computePercent ────────────────────────────────────────────────────────────

describe("computePercent", () => {
	it("returns 0 when total is 0 (avoids NaN)", () => {
		expect(computePercent(0, 0)).toBe(0);
		expect(computePercent(10, 0)).toBe(0);
	});

	it("computes integer percentages", () => {
		expect(computePercent(60, 100)).toBe(60);
		expect(computePercent(40, 100)).toBe(40);
	});

	it("rounds fractional percentages", () => {
		expect(computePercent(1, 3)).toBe(33);
		expect(computePercent(2, 3)).toBe(67);
	});
});

// ── LANGUAGE_COLORS ───────────────────────────────────────────────────────────

describe("LANGUAGE_COLORS", () => {
	it("maps both content locales to CSS chart tokens", () => {
		for (const lang of ["en", "pt-br"] as const) {
			expect(LANGUAGE_COLORS[lang]).toMatch(/^var\(--color-chart-\d+\)$/);
		}
	});
});

// ── Rendering ─────────────────────────────────────────────────────────────────

describe("LanguageSplitPie — rendering", () => {
	it("renders two pie slices (one per locale) with their colors", () => {
		renderPie({ en: 60, "pt-br": 40 });
		expect(screen.getByTestId("pie").getAttribute("data-count")).toBe("2");
		const fills = screen
			.getAllByTestId("cell")
			.map((c) => c.getAttribute("data-fill"));
		expect(fills).toContain(LANGUAGE_COLORS.en);
		expect(fills).toContain(LANGUAGE_COLORS["pt-br"]);
	});

	it("renders localized slice labels in the EN admin (English / Portuguese)", () => {
		renderPie({ en: 60, "pt-br": 40 }, "en");
		// sr-only table rows carry the resolved labels.
		expect(screen.getByText("English")).toBeDefined();
		expect(screen.getByText("Portuguese")).toBeDefined();
	});

	it("renders localized slice labels in the pt-br admin (Inglês / Português)", () => {
		renderPie({ en: 60, "pt-br": 40 }, "pt-br");
		expect(screen.getByText("Inglês")).toBeDefined();
		expect(screen.getByText("Português")).toBeDefined();
	});

	it("renders the widget title from strings for the active locale", () => {
		const { unmount } = renderPie({ en: 1, "pt-br": 1 }, "en");
		expect(
			screen.getByText(strings.en.admin.analytics.widgets.languageSplit),
		).toBeDefined();
		unmount();
		renderPie({ en: 1, "pt-br": 1 }, "pt-br");
		expect(
			screen.getByText(strings["pt-br"].admin.analytics.widgets.languageSplit),
		).toBeDefined();
	});

	it("renders the raw counts in the sr-only table", () => {
		renderPie({ en: 60, "pt-br": 40 });
		expect(screen.getByText("60")).toBeDefined();
		expect(screen.getByText("40")).toBeDefined();
	});
});

// ── Zero-sum empty state ──────────────────────────────────────────────────────

describe("LanguageSplitPie — empty state", () => {
	it("renders the awaiting-data empty state when total is 0 (no postId)", () => {
		renderPie({ en: 0, "pt-br": 0 });
		expect(
			screen.getByText(strings.en.admin.analytics.empty.awaitingData),
		).toBeDefined();
		// No pie when empty.
		expect(screen.queryByTestId("pie")).toBeNull();
	});

	it("renders the no-data-for-post empty state when filtered to a postId", () => {
		render(
			React.createElement(LanguageSplitPie, {
				languageSplit: { en: 0, "pt-br": 0 },
				locale: "en",
				postId: 7,
			}),
		);
		expect(
			screen.getByText(strings.en.admin.analytics.empty.noDataForPost),
		).toBeDefined();
	});
});
