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

function hostnameToSource(hostname: string): ReferrerSource {
	for (const [suffix, source] of SUFFIX_MAP) {
		if (hostname === suffix || hostname.endsWith(`.${suffix}`)) {
			return source;
		}
	}
	// Google country variants: google.com, google.co.uk, google.com.br,
	// www.google.com, maps.google.com, etc.
	if (hostname.startsWith("google.") || hostname.includes(".google.")) {
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
