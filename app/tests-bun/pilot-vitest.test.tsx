import { describe, expect, mock, test } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Badge } from "../tests-bun/fixtures/Badge";
import { groupByLang, type Post, slugify } from "../tests-bun/fixtures/subject";

describe("pure logic", () => {
	test("slugify strips accents and punctuation", () => {
		expect(slugify("Olá, Mundo!")).toBe("ola-mundo");
		expect(slugify("  Bun 1.4 — Benchmark  ")).toBe("bun-1-4-benchmark");
	});

	test("slugify collapses repeated separators", () => {
		expect(slugify("a---b___c")).toBe("a-b-c");
	});

	test("groupByLang buckets by locale and keeps order", () => {
		const posts: Post[] = [
			{ slug: "a", title: "A", lang: "en" },
			{ slug: "b", title: "B", lang: "pt-br" },
			{ slug: "c", title: "C", lang: "en" },
		];
		const grouped = groupByLang(posts);
		expect(grouped.en.map((p) => p.slug)).toEqual(["a", "c"]);
		expect(grouped["pt-br"].map((p) => p.slug)).toEqual(["b"]);
	});

	test("groupByLang returns an empty object for no posts", () => {
		expect(groupByLang([])).toEqual({});
	});
});

mock.module("../tests-bun/fixtures/reader", () => ({
	readTitle: (slug: string) => `mocked:${slug}`,
}));

describe("module mocking", () => {
	test("mock.module replaces the dependency", async () => {
		const { loadTitle } = await import("../tests-bun/fixtures/subject");
		expect(await loadTitle("hello")).toBe("mocked:hello");
	});
});

describe("component rendering", () => {
	test("renders the accessible name", () => {
		render(<Badge label="Drafts" count={3} />);
		expect(screen.getByRole("status", { name: "Drafts: 3" })).toBeDefined();
	});

	test("renders the visible text", () => {
		render(<Badge label="Posts" count={12} />);
		expect(screen.getByText("Posts (12)")).toBeDefined();
	});

	test("renders a zero count without collapsing it", () => {
		render(<Badge label="Empty" count={0} />);
		expect(screen.getByRole("status", { name: "Empty: 0" })).toBeDefined();
	});
});
