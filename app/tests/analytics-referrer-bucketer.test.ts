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
