// The createServerFn RPC wrapper for this handler lives in dispatch-theme-event.ts
// (a non-.server. file) so the client bundle can import it without TanStack Start's
// import-protection plugin rejecting it. Do not add a createServerFn call here.
import "@tanstack/react-start/server-only";
import { isBotUserAgent } from "#/lib/analytics/bot-filter";
import { detectDevice } from "#/lib/analytics/device-detector";
import { bucketReferrer } from "#/lib/analytics/referrer-bucketer";

/**
 * Input for the cs16 theme activation telemetry server function.
 * Matches the TechSpec "Core Interfaces" contract.
 */
export type RecordThemeEventInput = {
	theme: "cs16";
	source: "long-press" | "keyboard";
	lang: "en" | "pt-br";
};

/**
 * Result from the theme event analytics boundary.
 * Callers receive a typed boolean and can ignore it.
 */
export type RecordThemeEventResult = { recorded: boolean };

/**
 * Handler implementation extracted for direct unit testing without requiring
 * TanStack Start server fn mock infrastructure.
 *
 * Receives `{ data, request }` as destructured from the server fn context.
 * Called by `recordThemeEvent` server fn and directly in unit tests.
 */
export async function recordThemeEventHandler({
	data,
	request,
}: {
	data: RecordThemeEventInput;
	request: Request;
}): Promise<RecordThemeEventResult> {
	const ua = request.headers.get("User-Agent");
	const referer = request.headers.get("Referer");

	// Bot gate: short-circuit before any DB access.
	// Bots are rejected here; no event row inserted.
	if (isBotUserAgent(ua)) {
		return { recorded: false };
	}

	const device = detectDevice(ua);
	const referrerSource = bucketReferrer(referer, request.url);
	const { theme, source, lang } = data;

	try {
		// Dynamic imports keep DB modules out of the client bundle —
		// same pattern as app/lib/analytics/record-event.server.ts.
		const [{ db }, { themeEvents }] = await Promise.all([
			import("#/db/client"),
			import("#/db/schema"),
		]);

		await db.insert(themeEvents).values({
			theme,
			source,
			lang,
			device,
			referrerSource,
		});

		return { recorded: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			JSON.stringify({
				event: "theme_event_record_failed",
				theme,
				source,
				lang,
				error: message,
			}),
		);
		return { recorded: false };
	}
}
