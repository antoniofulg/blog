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
 * Maps a raw Referer header value to a named source bucket.
 *
 * Hostname logic:
 * - Empty / null / undefined Referer → "direct"
 * - Malformed Referer URL            → "other" (never throws)
 * - Known hostname                   → named bucket
 * - Unknown hostname                 → "other"
 *
 * The legacy UTM short-circuit (hasShareUTM / "share" bucket) was removed.
 * Per-platform attribution now relies solely on Referer hostname mapping (ADR-001).
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
