import type { ShikiTransformer } from "@shikijs/types";
import type { Element } from "hast";

/**
 * Stable class the client initializer (task_04) uses to locate each copy button.
 * Keep in sync with `post-enhancements.client.ts`.
 */
export const COPY_BUTTON_CLASS = "code-copy-button";

/**
 * Class on the non-scrolling wrapper the transformer puts around each `<pre>`.
 * It is the `relative` / `group` positioning context for the copy button, so the
 * button stays pinned top-right while the `<pre>` scrolls horizontally.
 */
export const CODE_BLOCK_WRAPPER_CLASS = "code-block-wrapper";

/**
 * Data attribute set on each `<pre>` holding the block's RAW source string, so
 * the client copies plain text — never the highlighted `<span>` token markup.
 * The client reads it via `pre.getAttribute(RAW_SOURCE_ATTR)`.
 */
export const RAW_SOURCE_ATTR = "data-raw-source";

/**
 * Token-styled Tailwind utility classes for the injected button (muted slab,
 * accent focus ring) so it reads as a first-class affordance over the code slab.
 *
 * `opacity-0` hides it by default; `group-hover:opacity-100` reveals it when the
 * surrounding wrapper (tagged `group`) is hovered, and `focus-visible:opacity-100`
 * reveals it for keyboard users (AC-3). Visibility is class-driven on hover-capable
 * pointers; coarse/no-hover pointers (touch) can never fire `:hover`, so the
 * `@media (hover: none)` rule on `.code-copy-button` in `global.css` pins the button
 * visible there (issue 001) — keep the two in sync.
 */
const BUTTON_CLASSES = [
	COPY_BUTTON_CLASS,
	"absolute",
	"right-3",
	"top-3",
	"flex",
	"h-8",
	"w-8",
	"items-center",
	"justify-center",
	"rounded-md",
	"border",
	"border-border",
	"bg-muted",
	"text-foreground-muted",
	"transition-opacity",
	"opacity-0",
	"group-hover:opacity-100",
	"focus-visible:opacity-100",
	"focus-visible:outline-none",
	"focus-visible:ring-2",
	"focus-visible:ring-accent",
];

/**
 * Stable classes the stylesheet hooks to swap the glyph: the copy icon shows by
 * default, and the check icon shows once the client sets `data-copied="true"` on
 * the button (see `.code-copy-button` rules in `global.css`). Both icons ship in
 * the compile-time markup so the swap is pure CSS — no client DOM construction.
 */
export const COPY_ICON_CLASS = "code-copy-icon";
export const CHECK_ICON_CLASS = "code-copy-check";

/** Build a 16px lucide-style inline SVG carrying `className` + the given paths. */
function iconSvg(className: string, paths: Element[]): Element {
	return {
		type: "element",
		tagName: "svg",
		properties: {
			class: [className],
			width: 16,
			height: 16,
			viewBox: "0 0 24 24",
			fill: "none",
			stroke: "currentColor",
			strokeWidth: 2,
			strokeLinecap: "round",
			strokeLinejoin: "round",
			"aria-hidden": "true",
		},
		children: paths,
	};
}

function svgPath(d: string): Element {
	return { type: "element", tagName: "path", properties: { d }, children: [] };
}

/** Two overlapping rounded rectangles — the standard "copy" glyph. */
function copyIcon(): Element {
	return iconSvg(COPY_ICON_CLASS, [
		{
			type: "element",
			tagName: "rect",
			properties: { width: 14, height: 14, x: 8, y: 8, rx: 2, ry: 2 },
			children: [],
		},
		svgPath("M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"),
	]);
}

/** A checkmark — the post-copy confirmation glyph, hidden until `data-copied`. */
function checkIcon(): Element {
	return iconSvg(CHECK_ICON_CLASS, [svgPath("M20 6 9 17l-5-5")]);
}

/**
 * Custom thin Shiki transformer (ADR-003) that turns every fenced code block
 * into a copyable surface at compile time:
 *
 * 1. Stashes the block's RAW source on the `<pre>` (`data-raw-source`) so the
 *    client copies plain text, not highlighted token markup.
 * 2. Injects one `<button class="code-copy-button">` carrying design-token
 *    classes, hidden by default and revealed on `:hover` / `:focus-visible`.
 *
 * The button ships a localized static `aria-label` (`copyLabel`, e.g. "Copy code" /
 * "Copiar código") so it has an accessible name in the reader's language before
 * client JS runs (WCAG 4.1.2) and for no-JS readers; the post initializer (task_04)
 * re-applies the localized label and wires the click handler and "Copied!" feedback.
 * This transformer owns only the compile-time markup. Inline `code` spans never
 * reach the `pre` hook (Shiki runs on fenced blocks only), so they get no button.
 */
export function copyButtonTransformer(copyLabel: string): ShikiTransformer {
	return {
		name: "copy-button",
		pre(hast) {
			hast.properties = hast.properties ?? {};
			hast.properties[RAW_SOURCE_ATTR] = this.source;
			const button: Element = {
				type: "element",
				tagName: "button",
				properties: {
					type: "button",
					// Localized static accessible name so the focusable control is named
					// in the reader's language before client JS runs (WCAG 4.1.2) and for
					// no-JS readers; `wireCopyButtons` re-applies the label once wired.
					"aria-label": copyLabel,
					class: [...BUTTON_CLASSES],
				},
				// Both glyphs ship in the markup; `[data-copied]` CSS toggles which is
				// visible (copy → check) so sighted users get visible feedback (G1).
				children: [copyIcon(), checkIcon()],
			};
			// Wrap the <pre> in a non-scrolling positioning context. The <pre> keeps
			// its own `overflow-x: auto`; the button lives on the wrapper (a sibling
			// of the <pre>), so `absolute right-3 top-3` pins it to the block's
			// top-right and it does NOT travel with the <pre>'s horizontal scroll.
			// `relative` anchors the button; `group` drives the hover/focus reveal.
			return {
				type: "element",
				tagName: "div",
				properties: { class: [CODE_BLOCK_WRAPPER_CLASS, "relative", "group"] },
				children: [button, hast],
			};
		},
	};
}
