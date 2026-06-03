/**
 * Tests for app/lib/mdx/copy-button.transformer.ts — the custom thin Shiki
 * transformer (ADR-003) that stashes raw source on each `<pre>`, wraps the
 * `<pre>` in a non-scrolling positioning context, and injects a
 * hidden-by-default copy button as a sibling of the `<pre>` (so the button stays
 * pinned top-right while the `<pre>` scrolls horizontally).
 *
 * The transformer is exercised through a real Shiki highlighter (same engine /
 * themes / lang wiring as renderer.server.ts) so `this.source`, `this.pre`, and
 * token highlighting are populated by Shiki exactly as in production — not mocked.
 */

import type { Element, Root, RootContent } from "hast";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { beforeAll, describe, expect, it } from "vitest";

import {
	CHECK_ICON_CLASS,
	CODE_BLOCK_WRAPPER_CLASS,
	COPY_BUTTON_CLASS,
	COPY_ICON_CLASS,
	copyButtonTransformer,
	RAW_SOURCE_ATTR,
} from "#/lib/mdx/copy-button.transformer";

let highlighter: Awaited<ReturnType<typeof createHighlighterCore>>;

beforeAll(async () => {
	highlighter = await createHighlighterCore({
		themes: [
			import("@shikijs/themes/github-light"),
			import("@shikijs/themes/github-dark"),
		],
		langs: [import("@shikijs/langs/typescript")],
		engine: createJavaScriptRegexEngine(),
	});
});

/** Highlight `code` with the transformer wired in; return the wrapping <div>. */
function highlightToBlock(code: string): Element {
	const root = highlighter.codeToHast(code, {
		lang: "typescript",
		themes: { light: "github-light", dark: "github-dark" },
		transformers: [copyButtonTransformer()],
	}) as Root;
	const block = root.children.find(
		(n): n is Element => n.type === "element" && n.tagName === "div",
	);
	if (!block) throw new Error("no wrapper <div> in highlighted output");
	return block;
}

/** The <pre> nested inside the wrapper. */
function preIn(block: Element): Element {
	const pre = block.children.find(
		(n): n is Element => n.type === "element" && n.tagName === "pre",
	);
	if (!pre) throw new Error("no <pre> inside the wrapper");
	return pre;
}

/** Collect every element with the given tag name in the subtree. */
function collectByTag(node: Root | RootContent, tag: string): Element[] {
	const out: Element[] = [];
	const visit = (n: Root | RootContent) => {
		if (n.type === "element") {
			if (n.tagName === tag) out.push(n);
			for (const child of n.children) visit(child);
		} else if (n.type === "root") {
			for (const child of n.children) visit(child);
		}
	};
	visit(node);
	return out;
}

function classList(el: Element): string[] {
	const cls = el.properties?.class;
	// Shiki sets the <pre> class as a space-separated string; the transformer sets
	// the button/wrapper classes as an array. Normalize both.
	if (typeof cls === "string") return cls.split(/\s+/).filter(Boolean);
	return Array.isArray(cls) ? cls.map(String) : [];
}

describe("copyButtonTransformer", () => {
	it("stashes the exact raw source on <pre> (3-line TS block, no token markup)", () => {
		const source = "const a = 1\nconst b = 2\nconst c = 3";
		const pre = preIn(highlightToBlock(source));
		const raw = pre.properties?.[RAW_SOURCE_ATTR];
		expect(raw).toBe(source);
		// The stashed value is plain text — never the highlighted <span> markup.
		expect(String(raw)).not.toContain("<span");
		expect(String(raw)).not.toContain("shiki");
	});

	it("wraps the <pre> in a non-scrolling positioning context", () => {
		const block = highlightToBlock("const x = 1");
		expect(block.tagName).toBe("div");
		expect(classList(block)).toEqual(
			expect.arrayContaining([CODE_BLOCK_WRAPPER_CLASS, "relative", "group"]),
		);
		// The button must NOT live inside the <pre>: the <pre> is the horizontal
		// scroll container, so a button inside it would travel with the scroll.
		expect(collectByTag(preIn(block), "button")).toHaveLength(0);
	});

	it("injects exactly one copy button per fenced block", () => {
		const block = highlightToBlock("const x: number = 1");
		const buttons = collectByTag(block, "button");
		expect(buttons).toHaveLength(1);
		expect(buttons[0].properties?.type).toBe("button");
	});

	it("ships a static aria-label so the button is named pre-JS (WCAG 4.1.2)", () => {
		const [button] = collectByTag(highlightToBlock("const x = 1"), "button");
		// The control is focusable and in the a11y tree at compile time; without a
		// static name it has an empty accessible name until `wireCopyButtons` runs.
		expect(button.properties?.["aria-label"]).toBe("Copy code");
	});

	it("button carries the stable client-hook class", () => {
		const [button] = collectByTag(highlightToBlock("const x = 1"), "button");
		expect(classList(button)).toContain(COPY_BUTTON_CLASS);
	});

	it("button is hidden by default and revealed on hover/focus via classes (AC-3)", () => {
		const [button] = collectByTag(highlightToBlock("const x = 1"), "button");
		const classes = classList(button);
		expect(classes).toContain("opacity-0");
		expect(classes).toContain("group-hover:opacity-100");
		expect(classes).toContain("focus-visible:opacity-100");
	});

	it("button carries design-token utility classes", () => {
		const [button] = collectByTag(highlightToBlock("const x = 1"), "button");
		const classes = classList(button);
		expect(classes).toEqual(
			expect.arrayContaining([
				"bg-muted",
				"text-foreground-muted",
				"border-border",
				"focus-visible:ring-accent",
			]),
		);
	});

	it("embeds both copy and check glyphs so the CSS state swap has icons (G1)", () => {
		const [button] = collectByTag(highlightToBlock("const x = 1"), "button");
		const svgs = collectByTag(button, "svg");
		// Two glyphs ship in the markup: the copy icon (default) and the check icon
		// (revealed by the [data-copied] CSS rule). Without these the button is a
		// blank box with no visible feedback on copy.
		expect(svgs).toHaveLength(2);
		const svgClasses = svgs.flatMap(classList);
		expect(svgClasses).toContain(COPY_ICON_CLASS);
		expect(svgClasses).toContain(CHECK_ICON_CLASS);
		// The glyphs are drawn from <path> children — proves real icon geometry, not
		// empty <svg> shells.
		expect(collectByTag(button, "path").length).toBeGreaterThan(0);
	});

	it("leaves highlighted token spans intact (does not corrupt highlighting)", () => {
		const pre = preIn(highlightToBlock("const value: string = 'hi'"));
		const spans = collectByTag(pre, "span");
		// Shiki emits one span per token; the transformer must not strip them.
		expect(spans.length).toBeGreaterThan(0);
		// At least one token span carries Shiki's per-token color styling.
		const styledToken = spans.some((s) => {
			const style = s.properties?.style;
			return typeof style === "string" && style.includes("color");
		});
		expect(styledToken).toBe(true);
		// The original highlighter class survives on the <pre>.
		expect(classList(pre)).toContain("shiki");
	});

	it("wraps the <pre> and keeps its <code> (button added as sibling)", () => {
		const block = highlightToBlock("const x = 1");
		const pre = preIn(block);
		expect(collectByTag(pre, "code")).toHaveLength(1);
		// The wrapper holds exactly the button plus the <pre>.
		expect(block.children).toHaveLength(2);
		expect(collectByTag(block, "button")).toHaveLength(1);
	});
});
