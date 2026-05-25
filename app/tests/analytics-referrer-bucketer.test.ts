import { describe, expect, it } from "vitest";
import type { ReferrerSource } from "#/lib/analytics/referrer-bucketer";
import { bucketReferrer } from "#/lib/analytics/referrer-bucketer";

// AC-6: importing the module must not trigger any DB connection.
// Verified implicitly: referrer-bucketer.ts has no DB imports; this import
// succeeds in a pure Node environment with no database configured.

describe("bucketReferrer", () => {
	// ── V1 bucket table ──────────────────────────────────────────────────────────
	// Each row: [raw Referer header, expected ReferrerSource]

	const cases: Array<[string, ReferrerSource]> = [
		// LinkedIn
		["https://www.linkedin.com/feed/", "linkedin"],
		["https://linkedin.com/in/username", "linkedin"],
		["https://lnkd.in/abc123", "linkedin"],
		// HackerNews
		["https://news.ycombinator.com/item?id=42", "hackernews"],
		// Reddit
		["https://reddit.com/r/webdev/comments/abc/post", "reddit"],
		["https://www.reddit.com/r/programming", "reddit"],
		// Google (bare domain + country variants)
		["https://google.com/search?q=tanstack", "google"],
		["https://google.co.uk/search?q=bun", "google"],
		["https://google.com.br/search?q=react", "google"],
		["https://www.google.com/search?q=drizzle", "google"],
		// GitHub
		["https://github.com/tanstack/router", "github"],
		["https://github.com/", "github"],
		// Twitter / X
		["https://twitter.com/username/status/123", "twitter"],
		["https://x.com/username/status/123", "twitter"],
		["https://t.co/abc123", "twitter"],
		// Bluesky
		["https://bsky.app/profile/username.bsky.social", "bluesky"],
		// dev.to
		["https://dev.to/author/post-title", "dev.to"],
		// Medium
		["https://medium.com/@author/post-title", "medium"],
		// Mastodon
		["https://mastodon.social/@username", "mastodon"],
	];

	it.each(cases)("maps %s → %s", (referer, expected) => {
		expect(bucketReferrer(referer)).toBe(expected);
	});

	// ── Direct (empty / null / undefined) ───────────────────────────────────────

	it("returns direct for null", () => {
		expect(bucketReferrer(null)).toBe("direct");
	});

	it("returns direct for undefined", () => {
		expect(bucketReferrer(undefined)).toBe("direct");
	});

	it("returns direct for empty string", () => {
		expect(bucketReferrer("")).toBe("direct");
	});

	// ── Malformed URL → other ────────────────────────────────────────────────────

	it("returns other for plain text without throwing", () => {
		expect(() => bucketReferrer("not a url")).not.toThrow();
		expect(bucketReferrer("not a url")).toBe("other");
	});

	it("returns other for an unknown domain", () => {
		expect(bucketReferrer("https://unknown-site.example.com/page")).toBe(
			"other",
		);
	});

	it("returns other for a protocol-relative string", () => {
		expect(bucketReferrer("//example.com/page")).toBe("other");
	});

	// ── Google TLD tightening (typosquatting guard) ──────────────────────────────

	it("maps google.com to google (canonical TLD)", () => {
		expect(bucketReferrer("https://google.com/search?q=test")).toBe("google");
	});

	it("maps google.com.br to google (multi-part country TLD)", () => {
		expect(bucketReferrer("https://google.com.br/search?q=test")).toBe(
			"google",
		);
	});

	it("maps www.google.com to google (subdomain variant)", () => {
		expect(bucketReferrer("https://www.google.com/search?q=test")).toBe(
			"google",
		);
	});

	it("returns other for google.evil.com (typosquatting domain starting with google.)", () => {
		expect(bucketReferrer("https://google.evil.com/page")).toBe("other");
	});

	it("returns other for google.example.org (unknown TLD after google.)", () => {
		expect(bucketReferrer("https://google.example.org/page")).toBe("other");
	});

	it("returns other for google.fake (single-word unknown TLD)", () => {
		expect(bucketReferrer("https://google.fake/search")).toBe("other");
	});
});

describe("bucketReferrer — UTM share short-circuit (ADR-002)", () => {
	const POST_URL = "https://myblog.example/en/my-post";
	const SHARE_URL = `${POST_URL}?utm_source=blog&utm_medium=share`;

	// AC-1: null referer + UTM-tagged URL → "share"
	it("returns 'share' when referer is null and URL carries utm_source=blog&utm_medium=share", () => {
		expect(bucketReferrer(null, SHARE_URL)).toBe("share");
	});

	// AC-2: UTM wins over Referer hostname
	it("returns 'share' when UTM tags present even with a known LinkedIn Referer", () => {
		expect(bucketReferrer("https://linkedin.com/feed/", SHARE_URL)).toBe(
			"share",
		);
	});

	// AC-3: no UTM → hostname logic still works
	it("falls back to hostname logic when no UTM tags present", () => {
		expect(bucketReferrer("https://linkedin.com/feed/", POST_URL)).toBe(
			"linkedin",
		);
	});

	// AC-4: utm_medium is required
	it("returns 'direct' when only utm_source=blog is present (utm_medium missing)", () => {
		expect(bucketReferrer(null, `${POST_URL}?utm_source=blog`)).toBe("direct");
	});

	// utm_medium must be exactly "share"
	it("returns 'direct' when utm_medium is not 'share'", () => {
		expect(
			bucketReferrer(null, `${POST_URL}?utm_source=blog&utm_medium=organic`),
		).toBe("direct");
	});

	// utm_source must be exactly "blog"
	it("returns 'direct' when utm_source is not 'blog'", () => {
		expect(
			bucketReferrer(null, `${POST_URL}?utm_source=twitter&utm_medium=share`),
		).toBe("direct");
	});

	// AC-5: malformed currentUrl → no throw, falls through to direct (null referer)
	it("does not throw for malformed currentUrl; returns 'direct' (null referer fallback)", () => {
		expect(() => bucketReferrer(null, "not-a-url")).not.toThrow();
		expect(bucketReferrer(null, "not-a-url")).toBe("direct");
	});

	// Extra UTM params do not break attribution
	it("returns 'share' when extra UTM params are present alongside the required pair", () => {
		expect(
			bucketReferrer(
				null,
				`${POST_URL}?utm_source=blog&utm_medium=share&utm_campaign=extra`,
			),
		).toBe("share");
	});

	// Backward-compatible: no 2nd arg still works
	it("works with single argument — backward compatible with existing callers", () => {
		expect(bucketReferrer("https://github.com/test")).toBe("github");
	});
});
