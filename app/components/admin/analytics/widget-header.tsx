import type { ReactNode } from "react";

type Props = {
	children: ReactNode;
};

/**
 * WidgetHeader — the `<h2>` row that titles every analytics dashboard widget.
 *
 * Extracted so the muted-token class lives in exactly one place: any future
 * change to the widget-title styling touches this file alone, and any
 * accidental drift back to an undefined token (e.g. `text-muted-foreground`)
 * cannot recur across multiple widget files.
 *
 * Pure-presentational: no DB / route imports.
 */
export function WidgetHeader({ children }: Props) {
	return (
		<h2 className="mb-4 text-sm font-medium text-foreground-muted">
			{children}
		</h2>
	);
}
