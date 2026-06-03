import type { ComponentType } from "react";
import { TicTacToe } from "#/components/ui/tic-tac-toe";

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

export type EmbedProps = { name: string } & Record<string, unknown>;

/**
 * Server-rendered placeholder for an embedded component.
 *
 * Supplied to the MDX components map so `<Embed name="x" .../>` becomes a static
 * `<div data-embed="x" data-props='{…}'>` carrying a no-JS fallback. The client
 * initializer (task_04) scans `[data-embed]`, looks the name up in `EMBEDS`, and
 * `createRoot`-mounts the real component over this node — a fresh mount, not
 * hydration, so there is no hydration-mismatch class (ADR-004).
 */
export function Embed({ name, ...props }: EmbedProps) {
	return (
		<div data-embed={name} data-props={JSON.stringify(props)}>
			<span className="embed-fallback">
				Interactive demo — requires JavaScript.
			</span>
		</div>
	);
}
