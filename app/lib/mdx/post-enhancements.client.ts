import { createElement } from "react";
import { createRoot } from "react-dom/client";
import type { Locale } from "#/lib/locale";
import {
	COPY_BUTTON_CLASS,
	RAW_SOURCE_ATTR,
} from "#/lib/mdx/copy-button.transformer";
import { EMBEDS } from "#/lib/mdx/embeds";

/**
 * Client initializer for the static post HTML (ADR-003 / ADR-004).
 *
 * `renderMdx` flattens prose to a static HTML string injected via
 * `dangerouslySetInnerHTML`, so the copy buttons are inert markup and the embed
 * markers are placeholders. After the body mounts, the route (task_05) calls the
 * functions here over the post container to make both interactive, and calls the
 * returned cleanups on navigation. Everything is fresh `createRoot` mounts (never
 * hydration), so there is no hydration-mismatch class. This module imports no
 * server-only code — it is a pure client boundary.
 */

/** Localized copy-button labels supplied by the route (task_05). */
export type CopyLabels = {
	/** Default `aria-label` — e.g. "Copy code". */
	copy: string;
	/** Post-copy `aria-label` + live announcement — e.g. "Copied!". */
	copied: string;
};

export type PostEnhancementsOptions = {
	/** Injected into every embed's props at mount time (ADR-004). */
	locale: Locale;
	/** Labels for the copy buttons. */
	copyLabels: CopyLabels;
};

/** How long the "Copied!" state lingers before reverting (ADR-003: ~2s). */
const COPIED_REVERT_MS = 2000;

/** Flag attribute the stylesheet can hook to render the "Copied!" affordance. */
const COPIED_ATTR = "data-copied";

/**
 * Wire every copy button rendered by `copyButtonTransformer` inside `root`.
 *
 * For each `button.code-copy-button`: sets the localized `aria-label`, and on
 * click copies the RAW source stashed on the sibling `<pre>` (never the
 * highlighted token markup) via the Clipboard API, swaps to a "Copied!" state,
 * and reverts after ~2s. A single polite live region appended to `root`
 * announces the confirmation to screen-reader users (ADR-003).
 *
 * Returns a cleanup that detaches every listener, clears pending revert timers,
 * and removes the live region — call it on navigation.
 */
export function wireCopyButtons(
	root: HTMLElement,
	labels: CopyLabels,
): () => void {
	const buttons = root.querySelectorAll<HTMLButtonElement>(
		`button.${COPY_BUTTON_CLASS}`,
	);

	// One shared polite live region for every button in this container. <output>
	// carries an implicit role="status"; aria-atomic re-announces on each change.
	const liveRegion = document.createElement("output");
	liveRegion.setAttribute("aria-live", "polite");
	liveRegion.setAttribute("aria-atomic", "true");
	liveRegion.className = "sr-only";
	root.appendChild(liveRegion);

	const detachers: Array<() => void> = [];

	for (const button of buttons) {
		button.setAttribute("aria-label", labels.copy);
		let timer: ReturnType<typeof setTimeout> | undefined;

		const onClick = () => {
			// The button is a sibling of the <pre> inside the code-block wrapper (the
			// <pre> is the horizontal-scroll container, so the button cannot live
			// inside it). Reach the <pre> through the shared wrapper parent.
			const pre = button.parentElement?.querySelector("pre");
			const raw = pre?.getAttribute(RAW_SOURCE_ATTR) ?? "";
			void navigator.clipboard
				.writeText(raw)
				.then(() => {
					button.setAttribute("aria-label", labels.copied);
					button.setAttribute(COPIED_ATTR, "true");
					liveRegion.textContent = labels.copied;
					if (timer) clearTimeout(timer);
					timer = setTimeout(() => {
						button.setAttribute("aria-label", labels.copy);
						button.removeAttribute(COPIED_ATTR);
						liveRegion.textContent = "";
					}, COPIED_REVERT_MS);
				})
				.catch(() => {
					// Clipboard API unavailable (non-secure context) — fail silently.
				});
		};

		button.addEventListener("click", onClick);
		detachers.push(() => {
			button.removeEventListener("click", onClick);
			if (timer) clearTimeout(timer);
		});
	}

	return () => {
		for (const detach of detachers) detach();
		liveRegion.remove();
	};
}

/**
 * Mount every embed marker inside `root` as an isolated React island (ADR-004).
 *
 * For each `[data-embed]`: resolves the name in the `EMBEDS` allowlist, parses
 * `data-props` (JSON), injects `locale`, and `createRoot(node).render(...)` — a
 * fresh mount that replaces the static no-JS fallback. An unknown name is left
 * untouched (fallback retained) and logged. Malformed `data-props` degrades to
 * empty props rather than throwing.
 *
 * Returns a cleanup that unmounts every island root — call it on navigation.
 */
export function mountEmbeds(root: HTMLElement, locale: Locale): () => void {
	const roots: Array<ReturnType<typeof createRoot>> = [];

	for (const node of root.querySelectorAll<HTMLElement>("[data-embed]")) {
		const name = node.dataset.embed ?? "";
		const Comp = EMBEDS[name];
		if (!Comp) {
			console.warn(
				`[mdx] Unknown embed "${name}" — keeping fallback (not in EMBEDS allowlist).`,
			);
			continue;
		}

		let props: Record<string, unknown> = {};
		try {
			props = JSON.parse(node.dataset.props || "{}");
		} catch (error) {
			console.warn(
				`[mdx] Invalid data-props for embed "${name}" — using empty props.`,
				error,
			);
		}

		const islandRoot = createRoot(node);
		islandRoot.render(createElement(Comp, { ...props, locale }));
		roots.push(islandRoot);
	}

	return () => {
		for (const islandRoot of roots) islandRoot.unmount();
	};
}

/**
 * Run both enhancers over a freshly mounted post container and return a single
 * combined cleanup (unmount islands first, then detach copy handlers). This is
 * the one entry point the route's `useEffect` calls (task_05).
 */
export function initPostEnhancements(
	root: HTMLElement,
	{ locale, copyLabels }: PostEnhancementsOptions,
): () => void {
	const detachCopy = wireCopyButtons(root, copyLabels);
	const unmountEmbeds = mountEmbeds(root, locale);
	return () => {
		unmountEmbeds();
		detachCopy();
	};
}
