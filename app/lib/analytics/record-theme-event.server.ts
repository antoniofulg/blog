import "@tanstack/react-start/server-only";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
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

/**
 * Records a cs16 theme activation event.
 *
 * Composes:
 *  - bot-filter: skips DB writes for known bots
 *  - referrer-bucketer: classifies Referer header into a named source
 *  - device-detector: classifies User-Agent into mobile/tablet/desktop
 *
 * The INSERT runs against the `theme_events` table (ADR-003).
 * Does not write to `analytics_events` — theme events are route-agnostic
 * and carry no post_id.
 *
 * Never throws — analytics failures MUST NOT surface to the visitor.
 * Any exception is caught, logged as a structured JSON line, and returns
 * { recorded: false }.
 *
 * No session check required — theme events fire for anonymous visitors.
 */
export const recordThemeEvent = createServerFn({ method: "POST" })
	.inputValidator((data: RecordThemeEventInput) => data)
	.handler(({ data }) =>
		recordThemeEventHandler({ data, request: getRequest() }),
	);
