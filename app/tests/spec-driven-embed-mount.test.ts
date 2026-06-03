// @vitest-environment jsdom
/**
 * task_07 (client side) — twin of `spec-driven-embed-render.test.ts`. That node
 * suite proves the real spec-driven post compiles the `<Embed name="tic-tac-toe" />`
 * marker into the exact placeholder reconstructed below; this jsdom suite proves
 * the client island mount turns that placeholder into the interactive TicTacToe,
 * locale injected, fallback gone (AC-3 client side). jsdom cannot read the post
 * file via `node:fs`, so the placeholder is rebuilt from the same DOM contract the
 * `Embed` component emits (ADR-004): `<div data-embed data-props='{}'>` + fallback.
 *
 * File is .ts per project convention — no JSX.
 */

import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Locale } from "#/lib/locale";
import { mountEmbeds } from "#/lib/mdx/post-enhancements.client";

// TicTacToe headings per locale — proof the island mounted with `locale` injected
// (see app/components/posts/tic-tac-toe COPY).
const TTT_HEADING: Record<Locale, string> = {
	en: "Try it: tic-tac-toe",
	"pt-br": "Experimente: jogo da velha",
};

/** Rebuild the placeholder the real post emits (verified in the node twin):
 *  `Embed` with no extra props → `data-props="{}"` + the no-JS fallback span. */
function appendPlaceholder(root: HTMLElement): HTMLElement {
	const node = document.createElement("div");
	node.setAttribute("data-embed", "tic-tac-toe");
	node.setAttribute("data-props", "{}");
	const fallback = document.createElement("span");
	fallback.className = "embed-fallback";
	fallback.textContent = "Interactive demo — requires JavaScript.";
	node.appendChild(fallback);
	root.appendChild(node);
	return node;
}

let root: HTMLElement;

beforeEach(() => {
	root = document.createElement("div");
	document.body.appendChild(root);
});

afterEach(() => {
	cleanup();
	root.remove();
});

describe.each([
	"en",
	"pt-br",
] as const)("spec-driven post embed mounts and is playable (%s, AC-3)", (locale) => {
	it("replaces the placeholder with the interactive TicTacToe", async () => {
		appendPlaceholder(root);

		let dispose: () => void = () => {};
		await act(async () => {
			dispose = mountEmbeds(root, locale);
		});

		const node = root.querySelector<HTMLElement>('[data-embed="tic-tac-toe"]');
		// Heading proves the registered component mounted with `locale` injected.
		expect(node?.textContent).toContain(TTT_HEADING[locale]);
		// The live status output (`Turn: X` / `Vez de: X`) confirms it is the
		// interactive game, not the static fallback.
		expect(node?.querySelector("output")?.textContent).toBeTruthy();
		// The no-JS fallback was replaced by the fresh createRoot mount.
		expect(node?.querySelector(".embed-fallback")).toBeNull();

		// Roots are unmounted on cleanup (no leaked createRoot — ADR-004 risk).
		await act(async () => {
			dispose();
		});
		expect(
			root.querySelector('[data-embed="tic-tac-toe"]')?.textContent ?? "",
		).not.toContain(TTT_HEADING[locale]);
	});
});
