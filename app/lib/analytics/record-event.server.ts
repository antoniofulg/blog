import "@tanstack/react-start/server-only";
import { isBotUserAgent } from "#/lib/analytics/bot-filter";
import { detectDevice } from "#/lib/analytics/device-detector";
import { bucketEvent } from "#/lib/analytics/referrer-bucketer";

/**
 * Input to the analytics boundary.
 * Matches the TechSpec "Core Interfaces" contract.
 */
export type RecordPostViewInput = {
	postId: number;
	request: Request; // source of headers (UA, Accept-Language)
	lang: "en" | "pt-br"; // canonical post locale
	/**
	 * Optional client-reported referrer (`document.referrer`). When provided,
	 * it overrides the request's `Referer` header — the increment server-fn
	 * fetch is same-origin, so the browser always sets that header to the
	 * current post URL, which would otherwise bucket every visit as
	 * "direct"/"other" regardless of the real upstream source. `null` /
	 * empty string means the navigation had no referrer (treated the same
	 * as "direct" by the bucketer).
	 */
	referrer?: string | null;
	/**
	 * Optional client-reported `utm_source` query param from the post URL.
	 * When set to a known platform (twitter / linkedin / whatsapp / …) it
	 * takes precedence over `referrer` for source bucketing — share-intent
	 * redirects routinely strip the referrer, so the UTM is the only
	 * attribution signal that survives wa.me / twitter.com/intent / etc.
	 */
	utmSource?: string | null;
};

/**
 * Result from the analytics boundary.
 * Callers receive a typed boolean result and can ignore it.
 */
export type RecordPostViewResult = {
	recorded: boolean; // true if event row inserted
	counterIncremented: boolean; // true if posts.view_count was bumped
};

/**
 * Records a post view event and increments the post's view counter.
 *
 * Composes:
 *  - bot-filter: skips DB writes for known bots
 *  - referrer-bucketer: classifies Referer header into a named source
 *  - device-detector: classifies User-Agent into mobile/tablet/desktop
 *
 * Both DB writes (counter UPDATE + event INSERT) run inside a single
 * db.transaction() call for atomicity.
 *
 * Never throws — analytics failures MUST NOT take down the post-view request.
 * Any exception is caught, logged as a structured line, and returns
 * { recorded: false, counterIncremented: false }.
 *
 * V1 constraints (per ADR-005):
 *  - country_code is always NULL (MaxMind deferred to V2)
 *  - is_bot is always false (bots are rejected before reaching DB)
 */
export async function recordPostView(
	input: RecordPostViewInput,
): Promise<RecordPostViewResult> {
	const { postId, request, lang, referrer, utmSource } = input;

	const ua = request.headers.get("User-Agent");
	// Prefer the explicit `referrer` argument over the request header. The
	// header is the URL of the page that made the same-origin fetch (always
	// the post itself); the explicit value is `document.referrer` from the
	// browser, which actually identifies the upstream source. `null` is the
	// "client said there is no upstream" signal — empty string is normalised
	// to it too. Only fall back to the request header when the caller did
	// NOT supply the field at all (the integration tests in
	// `analytics-record-event.test.ts` rely on this legacy path).
	let referer: string | null;
	if (referrer === undefined) {
		referer = request.headers.get("Referer");
	} else if (referrer === null || referrer.length === 0) {
		referer = null;
	} else {
		referer = referrer;
	}

	// Bot gate: short-circuit before any DB access.
	// Bots are rejected here; no counter bump, no event row.
	if (isBotUserAgent(ua)) {
		return { recorded: false, counterIncremented: false };
	}

	// `bucketEvent` prefers `utm_source` over `Referer` when present, so a
	// click on a wa.me / twitter.com/intent / etc. share intent — which
	// strips `document.referrer` along the redirect chain — still resolves
	// to the originating platform (whatsapp / twitter / …) rather than
	// `direct`.
	const referrerSource = bucketEvent({
		utmSource: utmSource ?? null,
		referer,
	});
	const device = detectDevice(ua);

	try {
		// Dynamic imports keep the server bundle hygienic —
		// same pattern as app/routes/{-$locale}/$slug.server.ts:151-160.
		const [{ db }, { posts, analyticsEvents }, { eq, sql }] = await Promise.all(
			[import("#/db/client"), import("#/db/schema"), import("drizzle-orm")],
		);

		await db.transaction(async (tx) => {
			await tx
				.update(posts)
				.set({ viewCount: sql`view_count + 1` })
				.where(eq(posts.id, postId));

			await tx.insert(analyticsEvents).values({
				postId,
				referrerSource,
				lang,
				device,
				countryCode: null, // ADR-005: country breakdown deferred to V2
				isBot: false, // V1 never inserts bot rows; column reserved for V2
			});
		});

		return { recorded: true, counterIncremented: true };
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		console.error(
			JSON.stringify({
				event: "analytics_record_failed",
				postId,
				error: message,
			}),
		);
		return { recorded: false, counterIncremented: false };
	}
}
