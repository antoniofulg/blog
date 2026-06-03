import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
	COPY_BUTTON_CLASS,
	RAW_SOURCE_ATTR,
} from "#/lib/mdx/copy-button.transformer";
import { Embed } from "#/lib/mdx/embeds";
import { renderMdx, shikiTransformers } from "#/lib/mdx/renderer.server";

const FIXTURES = join(import.meta.dirname, "fixtures");

// A fenced block whose RAW source the copy transformer must stash verbatim.
const TS_BLOCK = "```ts\nconst a = 1\n```";

// ─── Unit: shiki transformer registration ─────────────────────────────────────

describe("unit: shikiTransformers", () => {
	it("registers the copy-button transformer in the shiki pipeline (task_02)", () => {
		expect(shikiTransformers.some((t) => t.name === "copy-button")).toBe(true);
	});
});

// ─── Integration: copy button wiring (AC-1) ───────────────────────────────────

describe("integration: renderMdx copy button", () => {
	it("fenced block output carries the copy button hook + raw-source attr", async () => {
		const Content = await renderMdx(TS_BLOCK);
		const html = renderToStaticMarkup(createElement(Content, {}));
		// Client initializer (task_04) locates the button by this class and reads
		// the plain-text source off the <pre> via the raw-source attribute.
		expect(html).toContain(COPY_BUTTON_CLASS);
		expect(html).toContain(RAW_SOURCE_ATTR);
	});
});

// ─── Integration: embed placeholder (AC-2) ────────────────────────────────────

describe("integration: renderMdx embed placeholder", () => {
	it("<Embed name='tic-tac-toe' /> renders a data-embed placeholder", async () => {
		const Content = await renderMdx('<Embed name="tic-tac-toe" />');
		// The components map is supplied at the render site (mirrors
		// $slug.server.ts / pages.server.ts) so the capitalized JSX tag resolves.
		const html = renderToStaticMarkup(
			createElement(Content, { components: { Embed } }),
		);
		expect(html).toContain('data-embed="tic-tac-toe"');
	});
});

// ─── Integration: no regression on existing posts (AC-3) ──────────────────────

describe("integration: renderMdx existing post body", () => {
	it("renders a code-bearing post body with shiki markup and no throw", async () => {
		const source = readFileSync(join(FIXTURES, "en/with-code.mdx"), "utf-8");
		// renderMdx expects a frontmatter-stripped body (real call path strips first).
		const { content: body } = matter(source);
		const Content = await renderMdx(body);
		const html = renderToStaticMarkup(
			createElement(Content, { components: { Embed } }),
		);
		expect(html).toContain("shiki");
		expect(html).toContain(COPY_BUTTON_CLASS);
	});
});
