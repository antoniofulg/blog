import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { renderMdx } from "#/lib/mdx/renderer.server";

const FIXTURES = join(import.meta.dirname, "fixtures");
const SAMPLE_SOURCE = readFileSync(join(FIXTURES, "sample.mdx"), "utf-8");

// ─── Integration: renderMdx ───────────────────────────────────────────────────

describe("integration: renderMdx", () => {
	it("rendering fixture to string produces <h1> matching the first heading", async () => {
		const Component = await renderMdx(SAMPLE_SOURCE);
		const html = renderToStaticMarkup(createElement(Component, {}));
		expect(html).toContain("<h1>Sample Post</h1>");
	});

	it("renders **bold** as <strong> (remark-gfm active)", async () => {
		const Component = await renderMdx("**bold text**");
		const html = renderToStaticMarkup(createElement(Component, {}));
		expect(html).toContain("<strong>bold text</strong>");
	});

	it("mdx modules are protected from client bundle in vite.config.ts", () => {
		const viteConfig = readFileSync(
			join(import.meta.dirname, "../../vite.config.ts"),
			"utf-8",
		);
		expect(viteConfig).toContain("#/lib/mdx/renderer.server");
		expect(viteConfig).toContain("#/lib/mdx/parser.server");
		expect(viteConfig).toContain("serverOnlyStubPlugin");
	});
});
