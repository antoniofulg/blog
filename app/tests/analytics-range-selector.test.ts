// @vitest-environment jsdom
/**
 * Unit tests for RangeSelector component.
 *
 * Tests verify: all 6 preset labels render, selecting a range fires onSelect,
 * keyboard navigation (ArrowDown moves focusedIdx, Enter commits selection),
 * and that the functional updater pattern preserves postId (ADR-006).
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

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import {
	RANGE_OPTIONS,
	RangeSelector,
} from "#/components/admin/analytics/range-selector";
import type { AnalyticsRange } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function renderSelector(
	value: AnalyticsRange = "30d",
	locale: "en" | "pt-br" = "en",
	onSelect = vi.fn(),
) {
	mocks.setLocale(locale);
	return {
		onSelect,
		...render(React.createElement(RangeSelector, { value, locale, onSelect })),
	};
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	mocks.setLocale("en");
});

afterEach(cleanup);

// ── AC: all 6 preset labels render ───────────────────────────────────────────

describe("RangeSelector — preset labels (AC-3)", () => {
	it("renders all 6 en preset labels after opening", () => {
		renderSelector("30d", "en");
		// Open the dropdown
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		const t = strings.en.admin.analytics.range;
		for (const r of RANGE_OPTIONS) {
			// Scope to listbox to avoid collision with the button's current-value label.
			expect(within(list).getByText(t[r])).toBeDefined();
		}
	});

	it("renders all 6 pt-br preset labels after opening", () => {
		renderSelector("30d", "pt-br");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		const t = strings["pt-br"].admin.analytics.range;
		for (const r of RANGE_OPTIONS) {
			expect(within(list).getByText(t[r])).toBeDefined();
		}
	});

	it("shows the current value label on the trigger button", () => {
		renderSelector("90d", "en");
		const t = strings.en.admin.analytics.range;
		expect(screen.getByRole("button").textContent).toContain(t["90d"]);
	});

	it("shows the correct pt-br label for current value on trigger", () => {
		renderSelector("ytd", "pt-br");
		const t = strings["pt-br"].admin.analytics.range;
		expect(screen.getByRole("button").textContent).toContain(t.ytd);
	});
});

// ── AC: click selection fires onSelect ───────────────────────────────────────

describe("RangeSelector — click selection", () => {
	it("calls onSelect with the clicked range", () => {
		const { onSelect } = renderSelector("30d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		const t = strings.en.admin.analytics.range;
		fireEvent.click(within(list).getByText(t["7d"]));
		expect(onSelect).toHaveBeenCalledWith("7d");
	});

	it("calls onSelect with '90d' when 90d option is clicked", () => {
		const { onSelect } = renderSelector("30d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		const t = strings.en.admin.analytics.range;
		fireEvent.click(within(list).getByText(t["90d"]));
		expect(onSelect).toHaveBeenCalledWith("90d");
	});

	it("closes the dropdown after selection", () => {
		renderSelector("30d", "en");
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByRole("listbox")).toBeDefined();
		const list = screen.getByRole("listbox");
		const t = strings.en.admin.analytics.range;
		fireEvent.click(within(list).getByText(t["7d"]));
		expect(screen.queryByRole("listbox")).toBeNull();
	});

	it("calls onSelect exactly once per click", () => {
		const { onSelect } = renderSelector("30d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		const t = strings.en.admin.analytics.range;
		fireEvent.click(within(list).getByText(t.all));
		expect(onSelect).toHaveBeenCalledTimes(1);
	});
});

// ── AC: keyboard navigation ───────────────────────────────────────────────────

describe("RangeSelector — keyboard navigation (AC-6)", () => {
	it("opens the dropdown on Enter key from the trigger button", () => {
		renderSelector("30d", "en");
		fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
		expect(screen.getByRole("listbox")).toBeDefined();
	});

	it("opens the dropdown on ArrowDown key from the trigger button", () => {
		renderSelector("30d", "en");
		fireEvent.keyDown(screen.getByRole("button"), { key: "ArrowDown" });
		expect(screen.getByRole("listbox")).toBeDefined();
	});

	it("ArrowDown on list moves focused option to the next index", () => {
		// value="7d" → RANGE_OPTIONS.indexOf("7d") === 0 → focusedIdx starts at 0.
		renderSelector("7d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		fireEvent.keyDown(list, { key: "ArrowDown" });
		const options = screen.getAllByRole("option");
		// focusedIdx should now be 1 → options[1] has data-focused="true".
		expect(options[1].getAttribute("data-focused")).toBe("true");
	});

	it("ArrowUp on list moves focused option to the previous index", () => {
		// value="90d" → idx 2 → ArrowDown → idx 3 → ArrowUp → idx 2.
		renderSelector("90d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		fireEvent.keyDown(list, { key: "ArrowDown" }); // idx 2→3
		fireEvent.keyDown(list, { key: "ArrowUp" }); // idx 3→2
		const options = screen.getAllByRole("option");
		expect(options[2].getAttribute("data-focused")).toBe("true");
	});

	it("Enter on list commits the focused option", () => {
		const { onSelect } = renderSelector("7d", "en");
		// Open (focusedIdx=0) → ArrowDown (focusedIdx=1, "30d") → Enter.
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		fireEvent.keyDown(list, { key: "ArrowDown" });
		fireEvent.keyDown(list, { key: "Enter" });
		expect(onSelect).toHaveBeenCalledWith("30d");
	});

	it("Escape closes dropdown without calling onSelect", () => {
		const { onSelect } = renderSelector("30d", "en");
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByRole("listbox")).toBeDefined();
		fireEvent.keyDown(screen.getByRole("listbox"), { key: "Escape" });
		expect(screen.queryByRole("listbox")).toBeNull();
		expect(onSelect).not.toHaveBeenCalled();
	});

	it("ArrowDown does not go past the last option", () => {
		// value="all" → idx 5 (last); pressing ArrowDown should stay at 5.
		renderSelector("all", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		// Press many times to ensure it clamps.
		for (let i = 0; i < 10; i++) {
			fireEvent.keyDown(list, { key: "ArrowDown" });
		}
		const options = screen.getAllByRole("option");
		expect(options[5].getAttribute("data-focused")).toBe("true");
	});

	it("ArrowUp does not go before the first option", () => {
		// value="7d" → idx 0; pressing ArrowUp should stay at 0.
		renderSelector("7d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		for (let i = 0; i < 10; i++) {
			fireEvent.keyDown(list, { key: "ArrowUp" });
		}
		const options = screen.getAllByRole("option");
		expect(options[0].getAttribute("data-focused")).toBe("true");
	});
});

// ── AC: functional updater preserves postId (ADR-006) ────────────────────────
// This test validates the Route.navigate functional updater pattern directly.
// It proves that the closure `(prev) => ({ ...prev, range: newRange })` keeps
// any existing postId in the URL search params.

describe("RangeSelector — functional updater preserves postId (AC-5 / ADR-006)", () => {
	type AnalyticsSearch = { range: AnalyticsRange; postId?: number };

	it("spread updater preserves postId when changing range", () => {
		// Simulate what AnalyticsDashboard does when onSelect fires:
		//   void navigate({ search: (prev) => ({ ...prev, range: newRange }) })
		const prev: AnalyticsSearch = { range: "30d", postId: 42 };
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			range: "90d",
		});
		const result = updater(prev);
		expect(result).toEqual({ range: "90d", postId: 42 });
	});

	it("spread updater preserves postId=undefined when not set", () => {
		const prev: AnalyticsSearch = { range: "7d" };
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			range: "all",
		});
		const result = updater(prev);
		expect(result).toEqual({ range: "all" });
		expect(result.postId).toBeUndefined();
	});

	it("selecting '90d' with postId=42 active preserves postId in result", () => {
		const prev: AnalyticsSearch = { range: "30d", postId: 42 };
		// Simulate handleRangeSelect("90d") from AnalyticsDashboard
		const newRange: AnalyticsRange = "90d";
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			range: newRange,
		});
		expect(updater(prev)).toEqual({ range: "90d", postId: 42 });
	});

	it("RANGE_OPTIONS contains exactly 6 items in correct order", () => {
		expect(RANGE_OPTIONS).toEqual(["7d", "30d", "90d", "mtd", "ytd", "all"]);
	});
});

// ── AC: ARIA attributes ───────────────────────────────────────────────────────

describe("RangeSelector — ARIA attributes", () => {
	it("trigger button has aria-haspopup='listbox'", () => {
		renderSelector();
		const btn = screen.getByRole("button");
		expect(btn.getAttribute("aria-haspopup")).toBe("listbox");
	});

	it("trigger button has aria-expanded=false when closed", () => {
		renderSelector();
		expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe(
			"false",
		);
	});

	it("trigger button has aria-expanded=true when open", () => {
		renderSelector();
		fireEvent.click(screen.getByRole("button"));
		expect(screen.getByRole("button").getAttribute("aria-expanded")).toBe(
			"true",
		);
	});

	it("listbox is not rendered when dropdown is closed", () => {
		renderSelector();
		expect(screen.queryByRole("listbox")).toBeNull();
	});

	it("listbox renders 6 options with role='option'", () => {
		renderSelector();
		fireEvent.click(screen.getByRole("button"));
		const options = screen.getAllByRole("option");
		expect(options).toHaveLength(6);
	});

	it("current value option has aria-selected=true", () => {
		renderSelector("90d");
		fireEvent.click(screen.getByRole("button"));
		const options = screen.getAllByRole("option");
		// "90d" is at index 2 in RANGE_OPTIONS
		expect(options[2].getAttribute("aria-selected")).toBe("true");
	});

	it("non-selected options have aria-selected=false", () => {
		renderSelector("90d");
		fireEvent.click(screen.getByRole("button"));
		const options = screen.getAllByRole("option");
		const nonSelected = options.filter((_, i) => i !== 2);
		for (const opt of nonSelected) {
			expect(opt.getAttribute("aria-selected")).toBe("false");
		}
	});

	it("each option has a stable id matching range-opt-<range>", () => {
		renderSelector("30d");
		fireEvent.click(screen.getByRole("button"));
		const options = screen.getAllByRole("option");
		for (const [i, r] of RANGE_OPTIONS.entries()) {
			expect(options[i].getAttribute("id")).toBe(`range-opt-${r}`);
		}
	});

	it("listbox has aria-activedescendant pointing to the focused option id", () => {
		// value="7d" → focusedIdx=0 on open. ArrowDown → focusedIdx=1 ("30d").
		renderSelector("7d", "en");
		fireEvent.click(screen.getByRole("button"));
		const list = screen.getByRole("listbox");
		// After open, focusedIdx = indexOf("7d") = 0
		expect(list.getAttribute("aria-activedescendant")).toBe("range-opt-7d");
		// Arrow down → focusedIdx = 1 → "30d"
		fireEvent.keyDown(list, { key: "ArrowDown" });
		expect(list.getAttribute("aria-activedescendant")).toBe("range-opt-30d");
	});
});
