import { type ComponentType, createElement } from "react";
import { TicTacToe } from "#/components/posts/tic-tac-toe";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

/**
 * Allowlist of components embeddable inside MDX posts.
 *
 * This is the ONLY module that imports embeddable components — posts reference a
 * component by name (`<Embed name="tic-tac-toe" />`), never by file path. Adding
 * a new embeddable component is a single entry here (see ADR-001 / ADR-004).
 */
export const EMBEDS: Record<string, ComponentType<Record<string, unknown>>> = {
	"tic-tac-toe": TicTacToe as ComponentType<Record<string, unknown>>,
};

export type EmbedProps = {
	name: string;
	/**
	 * Localized no-JS fallback text. Defaults to English when absent so a bare
	 * `<Embed>` (e.g. unit tests) still renders a sensible string; the render path
	 * binds the reader's locale via `mdxEmbedComponents` (issue 002).
	 */
	fallbackLabel?: string;
} & Record<string, unknown>;

/** English fallback used when no `fallbackLabel` is supplied. */
const DEFAULT_EMBED_FALLBACK = "Interactive demo — requires JavaScript.";

/**
 * Server-rendered placeholder for an embedded component.
 *
 * Supplied to the MDX components map so `<Embed name="x" .../>` becomes a static
 * `<div data-embed="x" data-props='{…}'>` carrying a no-JS fallback. The client
 * initializer (task_04) scans `[data-embed]`, looks the name up in `EMBEDS`, and
 * `createRoot`-mounts the real component over this node — a fresh mount, not
 * hydration, so there is no hydration-mismatch class (ADR-004).
 *
 * `fallbackLabel` is destructured out so it never leaks into `data-props` (which
 * carries only the MDX-author props forwarded to the mounted component).
 */
export function Embed({ name, fallbackLabel, ...props }: EmbedProps) {
	return (
		<div data-embed={name} data-props={JSON.stringify(props)}>
			<span className="embed-fallback">
				{fallbackLabel ?? DEFAULT_EMBED_FALLBACK}
			</span>
		</div>
	);
}

/**
 * Build the MDX components map with an `Embed` bound to `locale`'s fallback text,
 * so the SSR no-JS placeholder ships in the reader's language (issue 002). The
 * client island mount (`mountEmbeds`) replaces the fallback regardless, so this
 * only governs the pre-JS / no-JS HTML — but that HTML must still be bilingual
 * (PRD parity). Use at every `renderToStaticMarkup` site that renders post/page
 * MDX (`$slug.server.ts`, `pages.server.ts`).
 */
export function mdxEmbedComponents(locale: Locale) {
	const fallbackLabel = strings[locale].embed.fallback;
	return {
		Embed: (props: Record<string, unknown>) =>
			createElement(Embed, { ...(props as EmbedProps), fallbackLabel }),
	};
}
