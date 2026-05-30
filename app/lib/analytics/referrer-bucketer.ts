/**
 * V1 referrer source buckets.
 * Aligns with the `referrer_source` column domain in `analytics_events`.
 *
 * The legacy "share" bucket and hasShareUTM short-circuit were removed in
 * favour of per-platform utm_source attribution (ADR-001).
 */
export type ReferrerSource =
	| "linkedin"
	| "google"
	| "github"
	| "twitter"
	| "reddit"
	| "hackernews"
	| "dev.to"
	| "medium"
	| "bluesky"
	| "mastodon"
	| "whatsapp"
	| "email"
	| "direct"
	| "other";

/**
 * Canonical ordered enumeration of every `ReferrerSource` member.
 *
 * Use this in:
 *  - the dashboard's referrer-sources-bar widget (stable render order for
 *    stacked Bar series, basis for the `activeSources` filter that keeps the
 *    chart legend clean)
 *  - unit tests that need the exact set of valid source names (e.g. asserting
 *    a gap-fill sentinel does NOT pollute the legend)
 *
 * Exporting from this module — rather than the component — keeps the
 * canonical list one import away from the type itself, so adding a new
 * `ReferrerSource` member is a single co-located edit.
 */
export const ALL_SOURCES: readonly ReferrerSource[] = [
	"linkedin",
	"google",
	"github",
	"twitter",
	"reddit",
	"hackernews",
	"dev.to",
	"medium",
	"bluesky",
	"mastodon",
	"whatsapp",
	"email",
	"direct",
	"other",
] as const;

/**
 * [domain-suffix, bucket] pairs checked in order; first match wins.
 * Match rule: hostname === suffix  OR  hostname.endsWith("." + suffix)
 * This covers bare domains and their www/subdomain variants.
 */
const SUFFIX_MAP: ReadonlyArray<readonly [string, ReferrerSource]> = [
	["lnkd.in", "linkedin"],
	["linkedin.com", "linkedin"],
	["t.co", "twitter"],
	["twitter.com", "twitter"],
	["x.com", "twitter"],
	["news.ycombinator.com", "hackernews"],
	["reddit.com", "reddit"],
	["dev.to", "dev.to"],
	["medium.com", "medium"],
	["bsky.app", "bluesky"],
	["mastodon.social", "mastodon"],
	["fosstodon.org", "mastodon"],
	["mas.to", "mastodon"],
	["github.com", "github"],
] as const;

/**
 * Well-known TLD suffixes for Google country-variant domains.
 * Restricting to this set prevents typosquatting domains that merely start
 * with "google." (e.g. `google.evil.com`) from being bucketed as "google".
 */
const GOOGLE_TLDS = new Set([
	"com",
	"co.uk",
	"co.jp",
	"com.br",
	"com.mx",
	"com.au",
	"de",
	"fr",
	"it",
	"es",
	"ca",
	"nl",
	"pl",
	"pt",
	"ru",
	"ch",
	"be",
	"at",
	"se",
	"no",
	"dk",
	"fi",
	"cz",
	"gr",
	"hu",
	"ro",
	"ie",
	"co.in",
	"co.kr",
	"co.nz",
	"com.ar",
	"com.co",
	"com.pe",
	"com.uy",
	"com.ve",
]);

function hostnameToSource(hostname: string): ReferrerSource {
	for (const [suffix, source] of SUFFIX_MAP) {
		if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
			return source;
		}
	}
	// Google country variants: google.com, google.co.uk, google.com.br, etc.
	// Two cases:
	//   1. Bare domain: google.<tld>  (e.g. google.com.br)
	//   2. Subdomain:   <sub>.google.<tld>  (e.g. www.google.com.br)
	// Both require a recognised TLD to prevent typosquatting (e.g. google.evil.com).
	const dotIdx = hostname.indexOf(".");
	const tldSuffix = dotIdx >= 0 ? hostname.slice(dotIdx + 1) : "";
	if (hostname.startsWith("google.") && GOOGLE_TLDS.has(tldSuffix)) {
		return "google";
	}
	const googleDotIdx = hostname.indexOf(".google.");
	if (googleDotIdx >= 0) {
		const afterGoogle = hostname.slice(googleDotIdx + ".google.".length);
		if (GOOGLE_TLDS.has(afterGoogle)) {
			return "google";
		}
	}
	return "other";
}

/**
 * Map a `utm_source` value to a `ReferrerSource` bucket. Returns `null` for
 * unknown / missing / empty values so callers can fall back to Referer-based
 * bucketing without a sentinel string.
 *
 * Why this exists alongside `bucketReferrer`: clicks on platform share
 * intents (wa.me, twitter.com/intent, etc.) often arrive at the post with
 * an empty `document.referrer` — the intermediate redirect strips it — but
 * the `utm_source` query param we emit from PostShare survives the round
 * trip. Without consulting it, every WhatsApp / X / LinkedIn share that
 * came through our own platform links would bucket as `direct`.
 *
 * Matching is case-insensitive against the literal `utm_source` value we
 * emit from `app/lib/share/platforms.ts`; anything not in that set is
 * treated as untrusted and returns `null`.
 *
 * Pure function — no I/O, no side effects.
 */
const UTM_SOURCE_MAP: Readonly<Record<string, ReferrerSource>> = {
	twitter: "twitter",
	x: "twitter",
	linkedin: "linkedin",
	reddit: "reddit",
	whatsapp: "whatsapp",
	email: "email",
	hackernews: "hackernews",
	bluesky: "bluesky",
	mastodon: "mastodon",
	github: "github",
	"dev.to": "dev.to",
	medium: "medium",
};

export function bucketUtmSource(
	utmSource: string | null | undefined,
): ReferrerSource | null {
	if (!utmSource) return null;
	const key = utmSource.trim().toLowerCase();
	if (key.length === 0) return null;
	return UTM_SOURCE_MAP[key] ?? null;
}

/**
 * Maps a raw Referer header value to a named source bucket.
 *
 * Hostname logic:
 * - Empty / null / undefined Referer → "direct"
 * - Malformed Referer URL            → "other" (never throws)
 * - Known hostname                   → named bucket
 * - Unknown hostname                 → "other"
 *
 * `bucketUtmSource` should be consulted FIRST by composite callers (see
 * `bucketEvent`); this function intentionally ignores query strings to keep
 * the hostname-only contract unambiguous.
 *
 * Pure function — no I/O, no side effects.
 */
export function bucketReferrer(
	referer: string | null | undefined,
): ReferrerSource {
	if (!referer) return "direct";
	let url: URL;
	try {
		url = new URL(referer);
	} catch {
		return "other";
	}
	return hostnameToSource(url.hostname);
}

/** Extract the bare hostname from a `Host` header or a full URL string. */
function extractHostname(value: string | null | undefined): string | null {
	if (!value) return null;
	const trimmed = value.trim();
	if (trimmed.length === 0) return null;
	// Only treat the value as a URL when it carries a scheme. `new URL` would
	// otherwise mis-parse a bare `host:port` Host header (e.g. "localhost:4173")
	// as scheme "localhost:" with an empty hostname.
	if (trimmed.includes("://")) {
		try {
			return new URL(trimmed).hostname.toLowerCase() || null;
		} catch {
			return null;
		}
	}
	// Bare `host:port` (the `Host` header form) → strip the port.
	return trimmed.split(":")[0]?.toLowerCase() || null;
}

/**
 * Compose `bucketUtmSource` + `bucketReferrer` with the prefer-utm rule and
 * self-host detection. Callers (e.g. `recordPostView`) should use this rather
 * than calling the sub-bucketers in sequence; the precedence is documented
 * here once:
 *
 *   1. A known `utm_source` wins outright (survives share-intent redirects).
 *   2. A referer whose hostname matches the site's own host (`selfHost`) is
 *      an internal navigation — bucketed `direct`. Without this rule the
 *      second pageview in a session (reader clicks from post A to post B)
 *      carries `document.referrer = https://<selfHost>/post-a`, which the
 *      hostname map does not recognise and would mislabel as `other`. The
 *      WhatsApp arrival that started the session is attributed once (to
 *      `whatsapp`); subsequent internal hops are `direct`.
 *   3. Otherwise fall back to plain hostname bucketing.
 */
export function bucketEvent(input: {
	utmSource?: string | null;
	referer?: string | null;
	/** The site's own host (from the request `Host` header). */
	selfHost?: string | null;
}): ReferrerSource {
	const fromUtm = bucketUtmSource(input.utmSource);
	if (fromUtm) return fromUtm;

	const selfHost = extractHostname(input.selfHost);
	const refererHost = extractHostname(input.referer);
	if (selfHost && refererHost) {
		if (refererHost === selfHost || refererHost.endsWith(`.${selfHost}`)) {
			return "direct";
		}
	}

	return bucketReferrer(input.referer);
}
