// @vitest-environment jsdom
/**
 * Unit tests for the FilterChip component.
 *
 * Covers: null render (no postId), chip render with title, fallback "Post #N",
 * X button click, Enter key, Space key, and locale variants.
 *
 * Uses React.createElement (no JSX) per project convention (.ts extension).
 */
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Must export LOCALES so strings.ts validation loop works at import time.
vi.mock("#/lib/locale", () => ({
	useLocale: () => ({ locale: "en" }),
	LOCALES: ["en", "pt-br"],
}));

// ── SUT import (after mocks) ──────────────────────────────────────────────────

import { FilterChip } from "#/components/admin/analytics/filter-chip";
import { strings } from "#/lib/i18n/strings";

// ── Fixture helpers ───────────────────────────────────────────────────────────

function makeTopPosts() {
	return [
		{
			postId: 1,
			slug: "hello-world",
			title: "Hello World",
			lang: "en" as const,
			count: 50,
			sparkline: [1, 2, 3],
		},
		{
			postId: 2,
			slug: "world-post",
			title: "World Post",
			lang: "pt-br" as const,
			count: 30,
			sparkline: [4, 5, 6],
		},
	];
}

// ── Setup / teardown ──────────────────────────────────────────────────────────

afterEach(cleanup);

// ── FilterChip ────────────────────────────────────────────────────────────────

describe("FilterChip", () => {
	// ── Null render (AC-1) ──────────────────────────────────────────────────────

	it("returns null when postId is undefined", () => {
		const { container } = render(
			React.createElement(FilterChip, {
				postId: undefined,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		expect(container.firstChild).toBeNull();
	});

	it("does not render the filter-chip testid when postId is undefined", () => {
		render(
			React.createElement(FilterChip, {
				postId: undefined,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		expect(screen.queryByTestId("filter-chip")).toBeNull();
	});

	// ── Chip with resolved title (AC-2) ─────────────────────────────────────────

	it("renders chip container when postId is set", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		expect(screen.getByTestId("filter-chip")).toBeDefined();
	});

	it("renders the resolved title when postId matches a top post", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain("Hello World");
	});

	it("renders the activeChip label from strings (EN)", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain(
			strings.en.admin.analytics.filter.activeChip,
		);
	});

	it("renders the activeChip label from strings (pt-br)", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "pt-br",
				onClear: vi.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain(
			strings["pt-br"].admin.analytics.filter.activeChip,
		);
	});

	// ── Fallback "Post #N" (AC-2 edge case) ─────────────────────────────────────

	it("renders 'Post #N' fallback when postId is not in topPosts", () => {
		render(
			React.createElement(FilterChip, {
				postId: 99,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain("Post #99");
	});

	it("renders 'Post #N' fallback when topPosts is empty", () => {
		render(
			React.createElement(FilterChip, {
				postId: 5,
				topPosts: [],
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain("Post #5");
	});

	// ── X button click (AC-3) ────────────────────────────────────────────────────

	it("X button click calls onClear once", () => {
		const onClear = vi.fn();
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear,
			}),
		);
		const btn = screen.getByRole("button");
		fireEvent.click(btn);
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	// ── Keyboard accessibility (AC-4) ────────────────────────────────────────────

	it("X button Enter key calls onClear", () => {
		const onClear = vi.fn();
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear,
			}),
		);
		const btn = screen.getByRole("button");
		fireEvent.keyDown(btn, { key: "Enter" });
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("X button Space key calls onClear", () => {
		const onClear = vi.fn();
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear,
			}),
		);
		const btn = screen.getByRole("button");
		fireEvent.keyDown(btn, { key: " " });
		expect(onClear).toHaveBeenCalledTimes(1);
	});

	it("other keys do not call onClear", () => {
		const onClear = vi.fn();
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear,
			}),
		);
		const btn = screen.getByRole("button");
		fireEvent.keyDown(btn, { key: "Escape" });
		fireEvent.keyDown(btn, { key: "Tab" });
		expect(onClear).not.toHaveBeenCalled();
	});

	// ── Button a11y ──────────────────────────────────────────────────────────────

	it("X button has accessible aria-label from strings", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		const btn = within(chip).getByRole("button");
		expect(btn.getAttribute("aria-label")).toBe(
			strings.en.admin.analytics.filter.clearAll,
		);
	});

	it("X button has tabIndex=0 (Tab-reachable)", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: vi.fn(),
			}),
		);
		const btn = screen.getByRole("button");
		expect(btn.getAttribute("tabindex")).toBe("0");
	});
});
