/**
 * Client-callable wrapper for the cs16 theme activation server fn.
 *
 * Problem: `theme.tsx` (client code) cannot dynamically import `*.server.*`
 * files — TanStack Start's import-protection plugin blocks any such import in
 * the client bundle, regardless of whether the imported file uses
 * `createServerFn()`.
 *
 * Solution: This file is named WITHOUT `.server.` so the import-protection
 * check passes. `theme.tsx` imports `dispatchThemeEvent` from here.
 * TanStack Start's Vite plugin still extracts the `.handler()` to the server
 * bundle; the client gets a typed RPC stub that POST-es to the server fn route.
 *
 * The handler delegates to `recordThemeEventHandler` in the co-located
 * `.server.ts` file via dynamic imports — those run server-side only.
 *
 * ADR-004, ADR-002.
 */

import { createServerFn } from "@tanstack/react-start";

export type DispatchThemeEventInput = {
	theme: "cs16";
	source: "long-press" | "keyboard";
	lang: "en" | "pt-br";
};

export type DispatchThemeEventResult = { recorded: boolean };

/**
 * Records a cs16 theme activation event via server fn RPC.
 * Called from `theme.tsx` on the client side; executes on the server.
 *
 * Callers MUST swallow failures — analytics MUST NOT surface to visitors.
 */
export const dispatchThemeEvent = createServerFn({ method: "POST" })
	.inputValidator((data: DispatchThemeEventInput) => data)
	.handler(async ({ data }) => {
		// Dynamic imports keep server-only dependencies out of the client bundle.
		// These run server-side only (TanStack Start extracts this handler).
		const [{ getRequest }, { recordThemeEventHandler }] = await Promise.all([
			import("@tanstack/react-start/server"),
			import("#/lib/analytics/record-theme-event.server"),
		]);
		return recordThemeEventHandler({ data, request: getRequest() });
	});
