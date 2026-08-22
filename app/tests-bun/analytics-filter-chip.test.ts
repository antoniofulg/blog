import "./happydom";

/**
 * Unit tests for the FilterChip component.
 *
 * Covers: null render (no postId), chip render with title, fallback "Post #N",
 * X button click, Enter key, Space key, and locale variants.
 *
 * Uses React.createElement (no JSX) per project convention (.ts extension).
 */

import { afterEach, describe, expect, jest, mock, test } from "bun:test";
import {
	cleanup,
	fireEvent,
	render,
	screen,
	within,
} from "@testing-library/react";
import React from "react";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Must export LOCALES so strings.ts validation loop works at import time.
mock.module("#/lib/locale", () => ({
	useLocale: () => ({ locale: "en" }),
	LOCALES: ["en", "pt-br"],
}));

// ── SUT import (after mocks) ──────────────────────────────────────────────────

const { FilterChip } = await import("#/components/admin/analytics/filter-chip");
const { strings } = await import("#/lib/i18n/strings");

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

	test("returns null when postId is undefined", () => {
		const { container } = render(
			React.createElement(FilterChip, {
				postId: undefined,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		expect(container.firstChild).toBeNull();
	});

	test("does not render the filter-chip testid when postId is undefined", () => {
		render(
			React.createElement(FilterChip, {
				postId: undefined,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		expect(screen.queryByTestId("filter-chip")).toBeNull();
	});

	// ── Chip with resolved title (AC-2) ─────────────────────────────────────────

	test("renders chip container when postId is set", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		expect(screen.getByTestId("filter-chip")).toBeDefined();
	});

	test("renders the resolved title when postId matches a top post", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain("Hello World");
	});

	test("renders the activeChip label from strings (EN)", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain(
			strings.en.admin.analytics.filter.activeChip,
		);
	});

	test("renders the activeChip label from strings (pt-br)", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "pt-br",
				onClear: jest.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain(
			strings["pt-br"].admin.analytics.filter.activeChip,
		);
	});

	// ── Fallback "Post #N" (AC-2 edge case) ─────────────────────────────────────

	test("renders 'Post #N' fallback when postId is not in topPosts", () => {
		render(
			React.createElement(FilterChip, {
				postId: 99,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain("Post #99");
	});

	test("renders 'Post #N' fallback when topPosts is empty", () => {
		render(
			React.createElement(FilterChip, {
				postId: 5,
				topPosts: [],
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		expect(chip.textContent).toContain("Post #5");
	});

	// ── X button click (AC-3) ────────────────────────────────────────────────────

	test("X button click calls onClear once", () => {
		const onClear = jest.fn();
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

	test("X button Enter key calls onClear", () => {
		const onClear = jest.fn();
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

	test("X button Space key calls onClear", () => {
		const onClear = jest.fn();
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

	test("other keys do not call onClear", () => {
		const onClear = jest.fn();
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

	test("X button has accessible aria-label from strings", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		const chip = screen.getByTestId("filter-chip");
		const btn = within(chip).getByRole("button");
		expect(btn.getAttribute("aria-label")).toBe(
			strings.en.admin.analytics.filter.clearAll,
		);
	});

	test("X button has tabIndex=0 (Tab-reachable)", () => {
		render(
			React.createElement(FilterChip, {
				postId: 1,
				topPosts: makeTopPosts(),
				locale: "en",
				onClear: jest.fn(),
			}),
		);
		const btn = screen.getByRole("button");
		expect(btn.getAttribute("tabindex")).toBe("0");
	});
});
