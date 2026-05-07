import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { parseFrontmatter } from "#/lib/mdx/parser.server";
import { renderMdx } from "#/lib/mdx/renderer.server";

const FIXTURES = join(import.meta.dirname, "fixtures");

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
