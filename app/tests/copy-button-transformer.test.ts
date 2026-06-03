/**
 * Tests for app/lib/mdx/copy-button.transformer.ts — the custom thin Shiki
 * transformer (ADR-003) that stashes raw source on each `<pre>` and injects a
 * hidden-by-default copy button into every fenced code block.
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
	COPY_BUTTON_CLASS,
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

/** Highlight `code` with the copy-button transformer wired in, return the <pre>. */
function highlightToPre(code: string): Element {
	const root = highlighter.codeToHast(code, {
		lang: "typescript",
		themes: { light: "github-light", dark: "github-dark" },
		transformers: [copyButtonTransformer()],
	}) as Root;
	const pre = root.children.find(
		(n): n is Element => n.type === "element" && n.tagName === "pre",
	);
	if (!pre) throw new Error("no <pre> in highlighted output");
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
	// Shiki stores classes under the `class` property (array, normalized by
	// addClassToHast); the injected button mirrors that convention.
	const cls = el.properties?.class;
	return Array.isArray(cls) ? cls.map(String) : [];
}

describe("copyButtonTransformer", () => {
	it("stashes the exact raw source on <pre> (3-line TS block, no token markup)", () => {
		const source = "const a = 1\nconst b = 2\nconst c = 3";
		const pre = highlightToPre(source);
		const raw = pre.properties?.[RAW_SOURCE_ATTR];
		expect(raw).toBe(source);
		// The stashed value is plain text — never the highlighted <span> markup.
		expect(String(raw)).not.toContain("<span");
		expect(String(raw)).not.toContain("shiki");
	});

	it("injects exactly one copy button per fenced block", () => {
		const pre = highlightToPre("const x: number = 1");
		const buttons = collectByTag(pre, "button");
		expect(buttons).toHaveLength(1);
		expect(buttons[0].properties?.type).toBe("button");
	});

	it("button carries the stable client-hook class", () => {
		const pre = highlightToPre("const x = 1");
		const [button] = collectByTag(pre, "button");
		expect(classList(button)).toContain(COPY_BUTTON_CLASS);
	});

	it("button is hidden by default and revealed on hover/focus via classes (AC-3)", () => {
		const pre = highlightToPre("const x = 1");
		const [button] = collectByTag(pre, "button");
		const classes = classList(button);
		expect(classes).toContain("opacity-0");
		expect(classes).toContain("group-hover:opacity-100");
		expect(classes).toContain("focus-visible:opacity-100");
		// The <pre> must be the hover/positioning context for the reveal to work.
		expect(classList(pre)).toEqual(
			expect.arrayContaining(["relative", "group"]),
		);
	});

	it("button carries design-token utility classes", () => {
		const pre = highlightToPre("const x = 1");
		const [button] = collectByTag(pre, "button");
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

	it("leaves highlighted token spans intact (does not corrupt highlighting)", () => {
		const pre = highlightToPre("const value: string = 'hi'");
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

	it("preserves the existing <pre> children (button is added, not replaced)", () => {
		const pre = highlightToPre("const x = 1");
		const codeEls = collectByTag(pre, "code");
		expect(codeEls).toHaveLength(1);
		// Button is prepended; the <code> block remains.
		expect(pre.children.length).toBeGreaterThanOrEqual(2);
	});
});
