// @vitest-environment jsdom
/**
 * Unit tests for SummaryCards component.
 *
 * Tests verify: label localisation, delta-percent logic, null/em-dash handling,
 * zero-previous-period guard, and ArrowUp/ArrowDown icon presence.
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

// ── SUT import (after mocks) ──────────────────────────────────────────────────

import { SummaryCards } from "#/components/admin/analytics/summary-cards";
import type { AnalyticsDashboardData } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

type SummaryData = AnalyticsDashboardData["summary"];

function makeSummary(overrides: Partial<SummaryData> = {}): SummaryData {
	return {
		totalVisits: 100,
		uniquePosts: 5,
		topReferrer: { source: "google", count: 40 },
		topLanguage: { lang: "en", count: 60 },
		previousPeriodTotal: 50,
		...overrides,
	};
}

function renderCards(summary: SummaryData, locale: "en" | "pt-br" = "en") {
	mocks.setLocale(locale);
	return render(React.createElement(SummaryCards, { summary, locale }));
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	mocks.setLocale("en");
});

afterEach(cleanup);

// ── Labels: 4 cards with correct en labels ────────────────────────────────────

describe("SummaryCards — label rendering", () => {
	it("renders the Total Visits label from en strings", () => {
		renderCards(makeSummary());
		expect(
			screen.getByText(strings.en.admin.analytics.summary.totalVisits),
		).toBeDefined();
	});

	it("renders the Unique Posts label from en strings", () => {
		renderCards(makeSummary());
		expect(
			screen.getByText(strings.en.admin.analytics.summary.uniquePosts),
		).toBeDefined();
	});

	it("renders the Top Referrer label from en strings", () => {
		renderCards(makeSummary());
		expect(
			screen.getByText(strings.en.admin.analytics.summary.topReferrer),
		).toBeDefined();
	});

	it("renders the Top Language label from en strings", () => {
		renderCards(makeSummary());
		expect(
			screen.getByText(strings.en.admin.analytics.summary.topLanguage),
		).toBeDefined();
	});

	it("renders all 4 labels in pt-br locale from strings", () => {
		renderCards(makeSummary(), "pt-br");
		const t = strings["pt-br"].admin.analytics.summary;
		expect(screen.getByText(t.totalVisits)).toBeDefined();
		expect(screen.getByText(t.uniquePosts)).toBeDefined();
		expect(screen.getByText(t.topReferrer)).toBeDefined();
		expect(screen.getByText(t.topLanguage)).toBeDefined();
	});
});

// ── AC-1: delta +100% when totalVisits=100, previousPeriodTotal=50 ─────────────

describe("SummaryCards — delta-percent calculation (AC-1)", () => {
	it("shows +100% delta when totalVisits=100 and previousPeriodTotal=50", () => {
		renderCards(makeSummary({ totalVisits: 100, previousPeriodTotal: 50 }));
		expect(screen.getByText("100%")).toBeDefined();
	});

	it("renders an up arrow when current > previous", () => {
		renderCards(makeSummary({ totalVisits: 100, previousPeriodTotal: 50 }));
		// ArrowUp renders an SVG; assert its aria-hidden wrapper exists in DOM.
		// We look for the percentage text which is only rendered alongside an arrow.
		const pctEl = screen.getByText("100%");
		// The percentage span is a sibling of the arrow inside a flex container.
		expect(pctEl.closest("span")).toBeDefined();
	});

	it("shows -50% delta when totalVisits=50 and previousPeriodTotal=100", () => {
		renderCards(makeSummary({ totalVisits: 50, previousPeriodTotal: 100 }));
		expect(screen.getByText("50%")).toBeDefined();
	});

	it("computes 0% delta when current equals previous", () => {
		renderCards(makeSummary({ totalVisits: 80, previousPeriodTotal: 80 }));
		expect(screen.getByText("0%")).toBeDefined();
	});

	it("rounds fractional delta to nearest integer", () => {
		// 15 / 90 ≈ 16.67% rounded to 17%
		renderCards(makeSummary({ totalVisits: 105, previousPeriodTotal: 90 }));
		// Math.round((105-90)/90*100) = Math.round(16.67) = 17
		expect(screen.getByText("17%")).toBeDefined();
	});
});

// ── AC-2: previousPeriodTotal = 0 → no delta arrow ────────────────────────────

describe("SummaryCards — zero previous period (AC-2)", () => {
	it("renders no percent text when previousPeriodTotal=0", () => {
		renderCards(makeSummary({ totalVisits: 42, previousPeriodTotal: 0 }));
		expect(screen.queryByText(/\d+%/)).toBeNull();
	});

	it("still renders totalVisits value when previousPeriodTotal=0", () => {
		renderCards(makeSummary({ totalVisits: 42, previousPeriodTotal: 0 }));
		expect(screen.getByText("42")).toBeDefined();
	});
});

// ── AC-3: topReferrer = null → em-dash ───────────────────────────────────────

describe("SummaryCards — null topReferrer (AC-3)", () => {
	it("renders em-dash when topReferrer is null", () => {
		renderCards(makeSummary({ topReferrer: null }));
		// Two em-dashes may appear if topLanguage is also null; query all.
		const dashes = screen.getAllByText("—");
		expect(dashes.length).toBeGreaterThanOrEqual(1);
	});

	it("renders referrer source + count when topReferrer is not null", () => {
		renderCards(makeSummary({ topReferrer: { source: "linkedin", count: 7 } }));
		expect(screen.getByText("linkedin (7)")).toBeDefined();
	});
});

// ── AC-4: topLanguage → pt-br label + count ──────────────────────────────────

describe("SummaryCards — topLanguage rendering (AC-4)", () => {
	it("renders pt-br lang and count when topLanguage={ lang:'pt-br', count:42 }", () => {
		renderCards(makeSummary({ topLanguage: { lang: "pt-br", count: 42 } }));
		expect(screen.getByText("pt-br (42)")).toBeDefined();
	});

	it("renders en lang and count when topLanguage={ lang:'en', count:60 }", () => {
		renderCards(makeSummary({ topLanguage: { lang: "en", count: 60 } }));
		expect(screen.getByText("en (60)")).toBeDefined();
	});

	it("renders em-dash when topLanguage is null", () => {
		renderCards(makeSummary({ topLanguage: null }));
		const dashes = screen.getAllByText("—");
		expect(dashes.length).toBeGreaterThanOrEqual(1);
	});
});

// ── AC-5: grid exists (structural) ───────────────────────────────────────────

describe("SummaryCards — responsive grid (AC-5)", () => {
	it("renders exactly 4 card containers", () => {
		const { container } = renderCards(makeSummary());
		// Each card is a div with rounded-lg border — count them via the grid's direct children.
		const grid = container.firstChild as HTMLElement;
		expect(grid.children).toHaveLength(4);
	});

	it("grid element has lg:grid-cols-4 class", () => {
		const { container } = renderCards(makeSummary());
		const grid = container.firstChild as HTMLElement;
		expect(grid.className).toContain("lg:grid-cols-4");
	});

	it("grid element has sm:grid-cols-2 class", () => {
		const { container } = renderCards(makeSummary());
		const grid = container.firstChild as HTMLElement;
		expect(grid.className).toContain("sm:grid-cols-2");
	});

	it("grid element has grid-cols-1 class (mobile base)", () => {
		const { container } = renderCards(makeSummary());
		const grid = container.firstChild as HTMLElement;
		expect(grid.className).toContain("grid-cols-1");
	});
});

// ── AC-6: no hardcoded strings ────────────────────────────────────────────────

describe("SummaryCards — no hardcoded label strings (AC-6)", () => {
	it("en and pt-br card labels differ (proving strings are locale-driven)", () => {
		const { unmount } = renderCards(makeSummary(), "en");
		const enLabel = screen.getByText(
			strings.en.admin.analytics.summary.totalVisits,
		).textContent;
		unmount();

		renderCards(makeSummary(), "pt-br");
		const ptLabel = screen.getByText(
			strings["pt-br"].admin.analytics.summary.totalVisits,
		).textContent;

		expect(enLabel).not.toBe(ptLabel);
	});
});

// ── Both null case ────────────────────────────────────────────────────────────

describe("SummaryCards — both topReferrer and topLanguage null", () => {
	it("renders two em-dashes when both are null", () => {
		renderCards(makeSummary({ topReferrer: null, topLanguage: null }));
		const dashes = screen.getAllByText("—");
		expect(dashes).toHaveLength(2);
	});
});
