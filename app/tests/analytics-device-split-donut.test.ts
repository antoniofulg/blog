// @vitest-environment jsdom
/**
 * Unit tests for DeviceSplitDonut component and computePercent helper.
 *
 * Tests verify: percent computation, donut variant (3 Cells), bar variant
 * (3 Bars with stackId), zero-sum handling (empty-state copy, neutral segment),
 * and locale-driven widget title.
 *
 * Recharts is fully mocked — jsdom has no ResizeObserver or SVG layout.
 * All component tests use React.createElement (no JSX) and .ts extension
 * to match the project's vitest include pattern (`app/tests/**\/*.test.ts`).
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
// PieChart wraps children; Pie exposes data-count + data-inner-radius.
// Cell exposes data-fill for color assertions.
// BarChart exposes data-count; Bar exposes data-key + data-stack-id.
vi.mock("recharts", () => ({
	ResponsiveContainer: ({ children }: { children: React.ReactNode }) =>
		children,
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
		React.createElement("div", {
			"data-testid": "cell",
			"data-fill": fill,
		}),
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
	Tooltip: () => null,
	XAxis: () => null,
	YAxis: () => null,
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import {
	computePercent,
	DEVICE_COLORS,
	DeviceSplitDonut,
} from "#/components/admin/analytics/device-split-donut";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

type DeviceSplit = { mobile: number; tablet: number; desktop: number };

function renderDonut(deviceSplit: DeviceSplit, locale: "en" | "pt-br" = "en") {
	mocks.setLocale(locale);
	return render(React.createElement(DeviceSplitDonut, { deviceSplit, locale }));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	mocks.setLocale("en");
});

afterEach(cleanup);

// ── computePercent unit tests ─────────────────────────────────────────────────

describe("computePercent", () => {
	it("returns 0 when total is 0 (avoids NaN)", () => {
		expect(computePercent(0, 0)).toBe(0);
		expect(computePercent(10, 0)).toBe(0);
	});

	it("computes 30% correctly", () => {
		expect(computePercent(30, 100)).toBe(30);
	});

	it("computes 10% correctly", () => {
		expect(computePercent(10, 100)).toBe(10);
	});

	it("computes 60% correctly", () => {
		expect(computePercent(60, 100)).toBe(60);
	});

	it("computes shares for { mobile: 30, tablet: 10, desktop: 60 } → 30/10/60%", () => {
		const total = 100;
		expect(computePercent(30, total)).toBe(30);
		expect(computePercent(10, total)).toBe(10);
		expect(computePercent(60, total)).toBe(60);
	});

	it("rounds fractional percentages", () => {
		// 1 of 3 = 33.33... → rounds to 33
		expect(computePercent(1, 3)).toBe(33);
		// 2 of 3 = 66.66... → rounds to 67
		expect(computePercent(2, 3)).toBe(67);
	});

	it("returns 100 for 100% of total", () => {
		expect(computePercent(100, 100)).toBe(100);
	});
});

// ── DEVICE_COLORS exhaustiveness ──────────────────────────────────────────────

describe("DEVICE_COLORS", () => {
	it("maps all 3 device classes to CSS chart tokens", () => {
		for (const device of ["mobile", "tablet", "desktop"] as const) {
			expect(DEVICE_COLORS[device]).toMatch(/^var\(--color-chart-\d+\)$/);
		}
	});

	it("assigns distinct tokens to mobile, tablet, desktop", () => {
		const colors = Object.values(DEVICE_COLORS);
		const unique = new Set(colors);
		expect(unique.size).toBe(3);
	});
});

// ── DeviceSplitDonut — wrapper and title ─────────────────────────────────────

describe("DeviceSplitDonut — wrapper and title", () => {
	it("renders wrapper with data-testid='device-split-donut'", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		expect(screen.getByTestId("device-split-donut")).toBeDefined();
	});

	it("renders widget title from en strings", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		expect(
			screen.getByText(strings.en.admin.analytics.widgets.deviceSplit),
		).toBeDefined();
	});

	it("renders widget title from pt-br strings", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 }, "pt-br");
		expect(
			screen.getByText(strings["pt-br"].admin.analytics.widgets.deviceSplit),
		).toBeDefined();
	});

	it("widget title differs between en and pt-br", () => {
		expect(strings.en.admin.analytics.widgets.deviceSplit).not.toBe(
			strings["pt-br"].admin.analytics.widgets.deviceSplit,
		);
	});
});

// ── DeviceSplitDonut — donut variant (PieChart) ───────────────────────────────

describe("DeviceSplitDonut — donut variant", () => {
	it("renders PieChart", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		expect(screen.getByTestId("pie-chart")).toBeDefined();
	});

	it("Pie has innerRadius (donut shape)", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const pie = screen.getByTestId("pie");
		// innerRadius > 0 confirms donut (not a solid pie)
		expect(Number(pie.getAttribute("data-inner-radius"))).toBeGreaterThan(0);
	});

	it("renders 3 Cell elements for { mobile: 30, tablet: 10, desktop: 60 }", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		// Both pie and bar render (CSS hides one). All Cells belong to the Pie.
		const cells = screen.getAllByTestId("cell");
		expect(cells).toHaveLength(3);
	});

	it("Pie receives 3 data entries for non-zero split", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const pie = screen.getByTestId("pie");
		expect(pie.getAttribute("data-count")).toBe("3");
	});

	it("Cell fills use chart color tokens for mobile/tablet/desktop", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const cells = screen.getAllByTestId("cell");
		const fills = cells.map((c) => c.getAttribute("data-fill"));
		// All fills must be chart token references
		for (const fill of fills) {
			expect(fill).toMatch(/^var\(--color-chart-\d+\)$/);
		}
	});

	it("renders Legend when data is non-zero", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		// At least one Legend in the tree (pie chart has one)
		expect(screen.getAllByTestId("recharts-legend").length).toBeGreaterThan(0);
	});
});

// ── DeviceSplitDonut — bar variant (BarChart) ─────────────────────────────────

describe("DeviceSplitDonut — bar variant", () => {
	it("renders BarChart", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		expect(screen.getByTestId("bar-chart")).toBeDefined();
	});

	it("BarChart receives 1 data row (single stacked bar)", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const chart = screen.getByTestId("bar-chart");
		expect(chart.getAttribute("data-count")).toBe("1");
	});

	it("renders 3 Bar segments for { mobile: 30, tablet: 10, desktop: 60 }", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const bars = screen.getAllByTestId("bar");
		expect(bars).toHaveLength(3);
	});

	it("Bar segments carry correct dataKey attributes", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const bars = screen.getAllByTestId("bar");
		const keys = bars.map((b) => b.getAttribute("data-key")).sort();
		expect(keys).toEqual(["desktop", "mobile", "tablet"]);
	});

	it("all Bar segments share the same stackId (stacked bar)", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		const bars = screen.getAllByTestId("bar");
		const stackIds = bars.map((b) => b.getAttribute("data-stack-id"));
		expect(stackIds.every((id) => id !== null && id === stackIds[0])).toBe(
			true,
		);
	});
});

// ── DeviceSplitDonut — zero-sum (empty state) ─────────────────────────────────

describe("DeviceSplitDonut — zero-sum", () => {
	it("renders empty-state copy when all values are 0", () => {
		renderDonut({ mobile: 0, tablet: 0, desktop: 0 });
		expect(screen.getByTestId("device-split-empty")).toBeDefined();
		expect(
			screen.getByText(strings.en.admin.analytics.empty.awaitingData),
		).toBeDefined();
	});

	it("Pie receives 1 neutral segment (not 3) on zero-sum", () => {
		renderDonut({ mobile: 0, tablet: 0, desktop: 0 });
		const pie = screen.getByTestId("pie");
		// 1 neutral segment for the empty donut
		expect(pie.getAttribute("data-count")).toBe("1");
	});

	it("neutral segment has a non-chart fill (muted token)", () => {
		renderDonut({ mobile: 0, tablet: 0, desktop: 0 });
		const cells = screen.getAllByTestId("cell");
		expect(cells).toHaveLength(1);
		// neutral cell must NOT be a chart-N token
		expect(cells[0].getAttribute("data-fill")).not.toMatch(
			/^var\(--color-chart-\d+\)$/,
		);
	});

	it("does not show empty-state copy when data is non-zero", () => {
		renderDonut({ mobile: 30, tablet: 10, desktop: 60 });
		expect(screen.queryByTestId("device-split-empty")).toBeNull();
	});

	it("no NaN displayed — computePercent(0, 0) returns 0", () => {
		// Guard: zero total must never produce NaN from computePercent
		expect(Number.isNaN(computePercent(0, 0))).toBe(false);
		expect(computePercent(0, 0)).toBe(0);
	});
});
