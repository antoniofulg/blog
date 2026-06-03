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
 * Token-styled Tailwind utility classes for the injected button. Mirrors the
 * hand-rolled `CodeBlock` affordance (muted slab, accent focus ring) so the MDX
 * copy button reads identically to the component-rendered one.
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
 * Custom thin Shiki transformer (ADR-003) that turns every fenced code block
 * into a copyable surface at compile time:
 *
 * 1. Stashes the block's RAW source on the `<pre>` (`data-raw-source`) so the
 *    client copies plain text, not highlighted token markup.
 * 2. Injects one `<button class="code-copy-button">` carrying design-token
 *    classes, hidden by default and revealed on `:hover` / `:focus-visible`.
 *
 * The localized `aria-label`, click handler, and "Copied!" feedback are wired
 * client-side by the post initializer (task_04) — this transformer owns only the
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
				properties: { type: "button", class: [...BUTTON_CLASSES] },
				children: [],
			};
			hast.children.unshift(button);
		},
	};
}
