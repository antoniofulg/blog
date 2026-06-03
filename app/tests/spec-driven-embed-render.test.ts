/**
 * task_07 — the spec-driven post is migrated from the removed slug-hardcoded
 * TicTacToe mount to the general `<Embed name="tic-tac-toe" />` marker. This
 * suite renders the REAL post files (both locales) the way `$slug.server.ts`
 * does and asserts the marker compiles to the `data-embed` placeholder + static
 * no-JS fallback (AC-3 SSR side, AC-4 parity). The client island mount is
 * covered in the jsdom twin `spec-driven-embed-mount.test.ts` — jsdom cannot
 * read files via `node:fs`, so the SSR render lives in the default node env.
 *
 * File is .ts per project convention — React.createElement, no JSX.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import matter from "gray-matter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeAll, describe, expect, it } from "vitest";
import { Embed } from "#/lib/mdx/embeds";
import { renderMdx } from "#/lib/mdx/renderer.server";

const POSTS = join(import.meta.dirname, "..", "content", "posts");
const SLUG = "spec-driven-development-with-compozy";

/** Render a real post file the way `$slug.server.ts` does: strip frontmatter,
 *  compile, then renderToStaticMarkup with the `{ Embed }` components map. */
async function renderPost(locale: "en" | "pt-br"): Promise<string> {
	const source = readFileSync(join(POSTS, locale, `${SLUG}.mdx`), "utf-8");
	const { content: body } = matter(source);
	const Content = await renderMdx(body);
	return renderToStaticMarkup(
		createElement(Content, { components: { Embed } }),
	);
}

const html: Record<"en" | "pt-br", string> = { en: "", "pt-br": "" };

beforeAll(async () => {
	html.en = await renderPost("en");
	html["pt-br"] = await renderPost("pt-br");
});

// ─── AC-3 (SSR) / T1 + T2: placeholder + fallback in rendered post HTML ────────

describe.each([
	"en",
	"pt-br",
] as const)("rendered %s post carries the embed placeholder", (locale) => {
	it("contains the data-embed='tic-tac-toe' placeholder", () => {
		expect(html[locale]).toContain('data-embed="tic-tac-toe"');
	});

	it("ships the static no-JS fallback inside the placeholder", () => {
		expect(html[locale]).toContain("embed-fallback");
		expect(html[locale]).toContain("requires JavaScript");
	});

	it("renders exactly one embed placeholder (single demo position)", () => {
		const matches = html[locale].match(/data-embed="tic-tac-toe"/g) ?? [];
		expect(matches).toHaveLength(1);
	});
});

// ─── AC-4: bilingual parity — bridge copy preceding the marker survives ────────

describe("bilingual parity (AC-4)", () => {
	it("keeps the bridge copy that introduces the demo in both locales", () => {
		expect(html.en).toContain("the board just below");
		expect(html["pt-br"]).toContain("o tabuleiro logo abaixo");
	});
});
