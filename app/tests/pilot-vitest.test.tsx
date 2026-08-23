// @vitest-environment jsdom
// Vitest twin of app/tests-bun/pilot.test.tsx. Same assertions, same fixtures.
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { Badge } from "../tests-bun/fixtures/Badge";
import { groupByLang, type Post, slugify } from "../tests-bun/fixtures/subject";

describe("pure logic", () => {
	it("slugify strips accents and punctuation", () => {
		expect(slugify("Olá, Mundo!")).toBe("ola-mundo");
		expect(slugify("  Bun 1.4 — Benchmark  ")).toBe("bun-1-4-benchmark");
	});

	it("slugify collapses repeated separators", () => {
		expect(slugify("a---b___c")).toBe("a-b-c");
	});

	it("groupByLang buckets by locale and keeps order", () => {
		const posts: Post[] = [
			{ slug: "a", title: "A", lang: "en" },
			{ slug: "b", title: "B", lang: "pt-br" },
			{ slug: "c", title: "C", lang: "en" },
		];
		const grouped = groupByLang(posts);
		expect(grouped.en.map((p) => p.slug)).toEqual(["a", "c"]);
		expect(grouped["pt-br"].map((p) => p.slug)).toEqual(["b"]);
	});

	it("groupByLang returns an empty object for no posts", () => {
		expect(groupByLang([])).toEqual({});
	});
});

vi.mock("../tests-bun/fixtures/reader", () => ({
	readTitle: (slug: string) => `mocked:${slug}`,
}));

describe("module mocking", () => {
	it("vi.mock replaces the dependency", async () => {
		const { loadTitle } = await import("../tests-bun/fixtures/subject");
		expect(await loadTitle("hello")).toBe("mocked:hello");
	});
});

describe("component rendering", () => {
	it("renders the accessible name", () => {
		render(<Badge label="Drafts" count={3} />);
		expect(screen.getByRole("status", { name: "Drafts: 3" })).toBeDefined();
	});

	it("renders the visible text", () => {
		render(<Badge label="Posts" count={12} />);
		expect(screen.getByText("Posts (12)")).toBeDefined();
	});

	it("renders a zero count without collapsing it", () => {
		render(<Badge label="Empty" count={0} />);
		expect(screen.getByRole("status", { name: "Empty: 0" })).toBeDefined();
	});
});
