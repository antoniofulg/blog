import type { ShikiTransformer } from "@shikijs/types";
import type { Element } from "hast";

/**
 * Stable class the client initializer (task_04) uses to locate each copy button.
 * Keep in sync with `post-enhancements.client.ts`.
 */
export const COPY_BUTTON_CLASS = "code-copy-button";

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
 * surrounding `<pre>` (tagged `group`) is hovered, and `focus-visible:opacity-100`
 * reveals it for keyboard users (AC-3). Visibility is fully class-driven.
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
 * The button ships a generic static `aria-label` ("Copy code") so it has an
 * accessible name before client JS runs (WCAG 4.1.2) and for no-JS readers; the
 * post initializer (task_04) overwrites it with the localized label and wires the
 * click handler and "Copied!" feedback. This transformer owns only the
 * compile-time markup. Inline `code` spans never reach the `pre` hook (Shiki runs
 * on fenced blocks only), so they get no button.
 */
export function copyButtonTransformer(): ShikiTransformer {
	return {
		name: "copy-button",
		pre(hast) {
			hast.properties = hast.properties ?? {};
			hast.properties[RAW_SOURCE_ATTR] = this.source;
			// `relative` anchors the absolutely-positioned button; `group` enables
			// the group-hover reveal from the surrounding <pre>.
			this.addClassToHast(hast, ["relative", "group"]);
			const button: Element = {
				type: "element",
				tagName: "button",
				properties: {
					type: "button",
					// Generic static accessible name so the focusable control is named
					// before client JS runs (WCAG 4.1.2) and for no-JS readers;
					// `wireCopyButtons` overwrites it with the localized label once wired.
					"aria-label": "Copy code",
					class: [...BUTTON_CLASSES],
				},
				// Both glyphs ship in the markup; `[data-copied]` CSS toggles which is
				// visible (copy → check) so sighted users get visible feedback (G1).
				children: [copyIcon(), checkIcon()],
			};
			hast.children.unshift(button);
		},
	};
}
