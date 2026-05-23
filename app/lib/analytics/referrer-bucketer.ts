/**
 * V1 referrer source buckets.
 * Aligns with the `referrer_source` column domain in `analytics_events`.
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
	| "direct"
	| "other";

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
	// Require a recognised TLD suffix after "google." to avoid mis-classifying
	// typosquatting domains like `google.evil.com` as "google".
	const dotIdx = hostname.indexOf(".");
	const tldSuffix = dotIdx >= 0 ? hostname.slice(dotIdx + 1) : "";
	if (
		(hostname.startsWith("google.") && GOOGLE_TLDS.has(tldSuffix)) ||
		(hostname.includes(".google.") &&
			/\.google\.(com|[a-z]{2})$/.test(hostname))
	) {
		return "google";
	}
	return "other";
}

/**
 * Maps a raw Referer header value to a named source bucket.
 * - Empty / null / undefined → "direct"
 * - Malformed URL           → "other" (never throws)
 * - Known hostname          → named bucket
 * - Unknown hostname        → "other"
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
