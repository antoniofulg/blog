import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "#/lib/mdx/parser.server";
import { renderMdx } from "#/lib/mdx/renderer.server";

const FIXTURES = join(import.meta.dirname, "fixtures");
const CONTENT_DIR = join(import.meta.dirname, "../../content");

// ─── Unit: parseFrontmatter ───────────────────────────────────────────────────

describe("unit: parseFrontmatter", () => {
	it("returns title, description, and publishedAt matching the YAML block", async () => {
		const fm = await parseFrontmatter(join(FIXTURES, "sample.mdx"));
		expect(fm.title).toBe("Sample Post");
		expect(fm.description).toBe("A sample post for testing.");
		expect(fm.publishedAt).toBe("2026-05-02");
	});

	it("returns undefined for optional fields not present in frontmatter", async () => {
		// no-slug.mdx has title and description but no publishedAt and no slug
		const fm = await parseFrontmatter(join(FIXTURES, "no-slug.mdx"));
		expect(fm.publishedAt).toBeUndefined();
	});

	it("derives slug from filename when frontmatter has no slug field", async () => {
		const fm = await parseFrontmatter(join(FIXTURES, "no-slug.mdx"));
		expect(fm.slug).toBe("no-slug");
	});

	it("uses slug from frontmatter when slug field is present", async () => {
		const fm = await parseFrontmatter(join(FIXTURES, "sample.mdx"));
		expect(fm.slug).toBe("sample-post");
	});

	it("throws when frontmatter has no title field", async () => {
		const err = await parseFrontmatter(join(FIXTURES, "no-title.mdx")).catch(
			(e) => e,
		);
		expect(err).toBeInstanceOf(Error);
		expect((err as Error).message).toContain("Missing required frontmatter");
	});
});

// ─── Unit: renderMdx ─────────────────────────────────────────────────────────

describe("unit: renderMdx", () => {
	it("returns a React component (not null, not a string)", async () => {
		const Component = await renderMdx("# Hello\n\nWorld");
		expect(Component).toBeDefined();
		expect(typeof Component).toBe("function");
	});

	it("rendered output contains Shiki-highlighted code for TypeScript block", async () => {
		const source = "```typescript\nconst x: number = 1\n```";
		const Component = await renderMdx(source);
		const html = renderToStaticMarkup(createElement(Component, {}));
		expect(html).toContain("shiki");
	});
});

// ─── Lint: frontmatter conventions ───────────────────────────────────────────

const VALID_CATEGORIES = [
	"frontend",
	"backend",
	"algorithms",
	"infra",
	"career",
	"tooling",
] as const;

function findMdxFiles(dir: string): string[] {
	const result: string[] = [];
	if (!existsSync(dir)) return result;
	const entries = readdirSync(dir, { withFileTypes: true });
	for (const entry of entries) {
		const fullPath = join(dir, entry.name);
		if (entry.isDirectory()) {
			result.push(...findMdxFiles(fullPath));
		} else if (entry.name.endsWith(".mdx")) {
			result.push(fullPath);
		}
	}
	return result;
}

function lintFrontmatter(filePath: string): void {
	const source = readFileSync(filePath, "utf-8");
	const { data } = matter(source);

	for (const field of [
		"title",
		"description",
		"publishedAt",
		"slug",
	] as const) {
		if (!data[field]) {
			throw new Error(`${filePath}: missing required field "${field}"`);
		}
	}

	if (data.category !== undefined) {
		if (
			!(VALID_CATEGORIES as readonly string[]).includes(data.category as string)
		) {
			throw new Error(
				`${filePath}: unknown category "${data.category}". Valid: ${VALID_CATEGORIES.join(", ")}`,
			);
		}
	}

	const hasSeries = data.series != null && data.series !== "";
	const hasPart = data.seriesPart != null;
	if (hasSeries !== hasPart) {
		throw new Error(
			`${filePath}: "series" and "seriesPart" must both be set or both omitted`,
		);
	}
}

describe("lint: frontmatter conventions", () => {
	it("all post MDX files in content/ pass frontmatter validation", () => {
		// About pages use aboutFrontmatterSchema (different shape); exclude from post lint
		const files = findMdxFiles(CONTENT_DIR).filter(
			(f) => !f.endsWith("/about.mdx"),
		);
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			expect(() => lintFrontmatter(file)).not.toThrow();
		}
	});

	it("lorem-ipsum.mdx has all required fields", () => {
		expect(() =>
			lintFrontmatter(join(FIXTURES, "lorem-ipsum.mdx")),
		).not.toThrow();
	});

	it("component-composition-react.mdx has all required fields", () => {
		expect(() =>
			lintFrontmatter(join(CONTENT_DIR, "en/component-composition-react.mdx")),
		).not.toThrow();
	});

	it("throws on missing title", () => {
		expect(() => lintFrontmatter(join(FIXTURES, "no-title.mdx"))).toThrow(
			/missing required field "title"/,
		);
	});

	it("throws on unknown category value", () => {
		expect(() => lintFrontmatter(join(FIXTURES, "bad-category.mdx"))).toThrow(
			/unknown category/,
		);
	});

	it("throws when series is set without seriesPart", () => {
		expect(() => lintFrontmatter(join(FIXTURES, "series-no-part.mdx"))).toThrow(
			/must both be set or both omitted/,
		);
	});

	it("throws when seriesPart is set without series", () => {
		expect(() => lintFrontmatter(join(FIXTURES, "part-no-series.mdx"))).toThrow(
			/must both be set or both omitted/,
		);
	});

	it("passes when category field is absent", () => {
		expect(() =>
			lintFrontmatter(join(FIXTURES, "lorem-ipsum.mdx")),
		).not.toThrow();
	});
});
