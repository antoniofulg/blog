// @vitest-environment jsdom
/**
 * Unit tests for TopPostsTable component.
 *
 * Tests verify: rendering (10 rows, empty, title/badge/count/sparkline),
 * row-click interaction, keyboard activation (Enter/Space), language-badge
 * output for both locales, and the functional-updater pattern for ADR-006.
 *
 * Recharts is fully mocked — jsdom has no ResizeObserver or SVG layout.
 * All component tests use React.createElement (no JSX) and .ts extension
 * to match the project's vitest include pattern.
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

// Stub Recharts — jsdom has no ResizeObserver / SVG layout support.
// LineChart exposes data length via data-count for sparkline assertions.
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
}));

// ── SUT imports (after mocks) ─────────────────────────────────────────────────

import { TopPostsTable } from "#/components/admin/analytics/top-posts-table";
import { strings } from "#/lib/i18n/strings";

// ── Types & fixture helpers ───────────────────────────────────────────────────

type TopPost = {
	postId: number;
	slug: string;
	title: string;
	lang: "en" | "pt-br";
	count: number;
	sparkline: number[];
};

function makePost(overrides: Partial<TopPost> = {}): TopPost {
	return {
		postId: 1,
		slug: "hello-world",
		title: "Hello World",
		lang: "en",
		count: 42,
		sparkline: [1, 2, 3, 4, 5],
		...overrides,
	};
}

function make10Posts(): TopPost[] {
	return Array.from({ length: 10 }, (_, i) =>
		makePost({
			postId: i + 1,
			slug: `post-${i + 1}`,
			title: `Post ${i + 1}`,
			count: (i + 1) * 10,
		}),
	);
}

function renderTable(
	topPosts: TopPost[],
	locale: "en" | "pt-br" = "en",
	onRowClick = vi.fn(),
) {
	mocks.setLocale(locale);
	return {
		onRowClick,
		...render(
			React.createElement(TopPostsTable, { topPosts, locale, onRowClick }),
		),
	};
}

// ── Cleanup ───────────────────────────────────────────────────────────────────

beforeEach(() => {
	mocks.setLocale("en");
});

afterEach(cleanup);

// ── Rendering: row count ──────────────────────────────────────────────────────

describe("TopPostsTable — row count (AC-1)", () => {
	it("renders wrapper with data-testid='top-posts-table'", () => {
		renderTable([makePost()]);
		expect(screen.getByTestId("top-posts-table")).toBeDefined();
	});

	it("renders 10 rows for a 10-element topPosts array", () => {
		renderTable(make10Posts());
		const table = screen.getByTestId("top-posts-table");
		// Each row has role="button"
		const rows = within(table).getAllByRole("button");
		expect(rows).toHaveLength(10);
	});

	it("renders 1 row for a single-item array", () => {
		renderTable([makePost()]);
		const table = screen.getByTestId("top-posts-table");
		const rows = within(table).getAllByRole("button");
		expect(rows).toHaveLength(1);
	});

	it("renders null (no DOM output) for an empty topPosts array (AC-6)", () => {
		const { container } = renderTable([]);
		// Container is the testing-library wrapper div — inner content should be empty.
		expect(container.firstChild).toBeNull();
	});
});

// ── Rendering: column content ─────────────────────────────────────────────────

describe("TopPostsTable — column content (AC-2)", () => {
	it("renders the post title in each row", () => {
		renderTable([makePost({ title: "My Great Post" })]);
		expect(screen.getByText("My Great Post")).toBeDefined();
	});

	it("renders the visit count for each row", () => {
		renderTable([makePost({ count: 99 })]);
		expect(screen.getByText("99")).toBeDefined();
	});

	it("renders a sparkline LineChart per row", () => {
		renderTable([makePost({ sparkline: [10, 20, 30] })]);
		const chart = screen.getByTestId("line-chart");
		// Sparkline data: [10,20,30] → 3 points
		expect(chart.getAttribute("data-count")).toBe("3");
	});

	it("renders one LineChart per row for 5 posts", () => {
		const posts = Array.from({ length: 5 }, (_, i) =>
			makePost({ postId: i + 1, slug: `p${i}`, sparkline: [1, 2] }),
		);
		renderTable(posts);
		const charts = screen.getAllByTestId("line-chart");
		expect(charts).toHaveLength(5);
	});

	it("sparkline data-count equals sparkline array length", () => {
		renderTable([makePost({ sparkline: [5, 10, 15, 20] })]);
		const chart = screen.getByTestId("line-chart");
		expect(chart.getAttribute("data-count")).toBe("4");
	});
});

// ── Language badge (AC-2, subtask 15.5) ──────────────────────────────────────

describe("TopPostsTable — language badge", () => {
	it("renders 'EN' badge for lang='en' rows", () => {
		renderTable([makePost({ lang: "en" })]);
		expect(screen.getByText("EN")).toBeDefined();
	});

	it("renders 'PT-BR' badge for lang='pt-br' rows", () => {
		renderTable([makePost({ lang: "pt-br" })]);
		expect(screen.getByText("PT-BR")).toBeDefined();
	});

	it("renders correct badge for each row in a mixed-locale list", () => {
		const posts = [
			makePost({ postId: 1, slug: "p1", lang: "en", title: "EN Post" }),
			makePost({ postId: 2, slug: "p2", lang: "pt-br", title: "PT Post" }),
		];
		renderTable(posts);
		expect(screen.getByText("EN")).toBeDefined();
		expect(screen.getByText("PT-BR")).toBeDefined();
	});
});

// ── Row click (AC-3) ──────────────────────────────────────────────────────────

describe("TopPostsTable — row click (AC-3)", () => {
	it("calls onRowClick with the correct postId on click", () => {
		const { onRowClick } = renderTable([makePost({ postId: 7 })]);
		const table = screen.getByTestId("top-posts-table");
		const row = within(table).getByRole("button");
		fireEvent.click(row);
		expect(onRowClick).toHaveBeenCalledWith(7);
	});

	it("calls onRowClick exactly once per click", () => {
		const { onRowClick } = renderTable([makePost({ postId: 3 })]);
		const table = screen.getByTestId("top-posts-table");
		const row = within(table).getByRole("button");
		fireEvent.click(row);
		expect(onRowClick).toHaveBeenCalledTimes(1);
	});

	it("calls onRowClick with the postId of the specific clicked row", () => {
		const posts = [
			makePost({ postId: 10, slug: "p10", title: "Post A" }),
			makePost({ postId: 20, slug: "p20", title: "Post B" }),
		];
		const { onRowClick } = renderTable(posts);
		const table = screen.getByTestId("top-posts-table");
		const rows = within(table).getAllByRole("button");
		// Click second row (postId=20)
		fireEvent.click(rows[1]);
		expect(onRowClick).toHaveBeenCalledWith(20);
	});
});

// ── Keyboard activation (AC-4) ────────────────────────────────────────────────

describe("TopPostsTable — keyboard activation (AC-4)", () => {
	it("calls onRowClick on Enter key", () => {
		const { onRowClick } = renderTable([makePost({ postId: 5 })]);
		const table = screen.getByTestId("top-posts-table");
		const row = within(table).getByRole("button");
		fireEvent.keyDown(row, { key: "Enter" });
		expect(onRowClick).toHaveBeenCalledWith(5);
	});

	it("calls onRowClick on Space key", () => {
		const { onRowClick } = renderTable([makePost({ postId: 5 })]);
		const table = screen.getByTestId("top-posts-table");
		const row = within(table).getByRole("button");
		fireEvent.keyDown(row, { key: " " });
		expect(onRowClick).toHaveBeenCalledWith(5);
	});

	it("does not call onRowClick on other keys (e.g. Tab)", () => {
		const { onRowClick } = renderTable([makePost({ postId: 5 })]);
		const table = screen.getByTestId("top-posts-table");
		const row = within(table).getByRole("button");
		fireEvent.keyDown(row, { key: "Tab" });
		expect(onRowClick).not.toHaveBeenCalled();
	});

	it("rows have tabIndex=0 (keyboard-focusable)", () => {
		renderTable([makePost()]);
		const table = screen.getByTestId("top-posts-table");
		const row = within(table).getByRole("button");
		expect(row.getAttribute("tabindex")).toBe("0");
	});
});

// ── Widget title locale (AC-1) ────────────────────────────────────────────────

describe("TopPostsTable — widget title", () => {
	it("renders widget title from en strings", () => {
		renderTable([makePost()]);
		expect(
			screen.getByText(strings.en.admin.analytics.widgets.topPosts),
		).toBeDefined();
	});

	it("renders widget title from pt-br strings", () => {
		renderTable([makePost()], "pt-br");
		expect(
			screen.getByText(strings["pt-br"].admin.analytics.widgets.topPosts),
		).toBeDefined();
	});

	it("widget title differs between en and pt-br", () => {
		expect(strings.en.admin.analytics.widgets.topPosts).not.toBe(
			strings["pt-br"].admin.analytics.widgets.topPosts,
		);
	});
});

// ── Column headers locale ─────────────────────────────────────────────────────

describe("TopPostsTable — column headers", () => {
	it("renders en column headers (Title, Language, Visits)", () => {
		renderTable([makePost()]);
		const t = strings.en.admin.analytics.topPostsTable;
		expect(screen.getByText(t.columnTitle)).toBeDefined();
		expect(screen.getByText(t.columnLanguage)).toBeDefined();
		expect(screen.getByText(t.columnVisits)).toBeDefined();
	});

	it("renders pt-br column headers (Título, Idioma, Visitas)", () => {
		renderTable([makePost()], "pt-br");
		const t = strings["pt-br"].admin.analytics.topPostsTable;
		expect(screen.getByText(t.columnTitle)).toBeDefined();
		expect(screen.getByText(t.columnLanguage)).toBeDefined();
		expect(screen.getByText(t.columnVisits)).toBeDefined();
	});
});

// ── Functional updater pattern (ADR-006) ─────────────────────────────────────
// Tests the spread-updater pattern used by the dashboard's handleRowClick:
//   navigate({ search: (prev) => ({ ...prev, postId }) })
// Verifies that setting postId does NOT lose the active range.

describe("TopPostsTable — functional updater preserves range (ADR-006)", () => {
	type AnalyticsSearch = { range: string; postId?: number };

	it("spread updater preserves range when adding postId", () => {
		const prev: AnalyticsSearch = { range: "30d" };
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			postId: 42,
		});
		expect(updater(prev)).toEqual({ range: "30d", postId: 42 });
	});

	it("spread updater preserves range='90d' when setting postId=7", () => {
		const prev: AnalyticsSearch = { range: "90d" };
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			postId: 7,
		});
		expect(updater(prev)).toEqual({ range: "90d", postId: 7 });
	});

	it("spread updater replaces an existing postId with a new one", () => {
		const prev: AnalyticsSearch = { range: "7d", postId: 5 };
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			postId: 42,
		});
		expect(updater(prev)).toEqual({ range: "7d", postId: 42 });
	});

	it("spread updater keeps postId undefined when not set", () => {
		const prev: AnalyticsSearch = { range: "all" };
		const updater = (p: AnalyticsSearch): AnalyticsSearch => ({
			...p,
			postId: undefined,
		});
		const result = updater(prev);
		expect(result.range).toBe("all");
		expect(result.postId).toBeUndefined();
	});
});
