/**
 * Unit tests for app/lib/share/platforms.ts
 *
 * Coverage targets:
 *   AC-1: buildTaggedUrl format for each of the 5 tagged platforms
 *   AC-2: buildTaggedUrl preserves existing query params (appends with &)
 *   AC-3: buildTaggedUrl returns canonical URL unchanged for "copy"
 *   AC-4: SHARE_PLATFORMS.length === 6; every labelKey in strings.en.postShare.chips
 *   AC-5: module compiles + lints clean (enforced by CI; smoke-checked here via import)
 */

import { describe, expect, it } from "vitest";

// ── Mocks (hoisted before all imports) ────────────────────────────────────────

// #/lib/locale is mocked so lucide-react icons import correctly in Node.
// platforms.ts does not import from locale directly, but the strings import
// for the coupling test needs LOCALES.
import { vi } from "vitest";

vi.mock("#/lib/locale", () => ({
	LOCALES: ["en", "pt-br"],
	DEFAULT_LOCALE: "en",
	localeHref: (locale: string, slug: string) =>
		locale === "en" ? `/${slug}` : `/${locale}/${slug}`,
	toBcp47: (l: string) => l,
	useLocale: () => ({ locale: "en", setLocale: () => {} }),
}));

import { strings } from "#/lib/i18n/strings";
// Import under test — AFTER mocks
import {
	buildTaggedUrl,
	type PlatformId,
	SHARE_PLATFORMS,
} from "#/lib/share/platforms";

// ── Constants ─────────────────────────────────────────────────────────────────

const BASE_URL = "https://blog.example/my-post";
const SLUG = "my-post";

/** All 5 platform ids that receive UTM tagging. */
const TAGGED_PLATFORMS: PlatformId[] = [
	"twitter",
	"linkedin",
	"reddit",
	"whatsapp",
	"email",
];

// ── Unit: buildTaggedUrl — tagged platforms (AC-1) ────────────────────────────

describe("unit: buildTaggedUrl — tagged platforms (AC-1)", () => {
	it.each(
		TAGGED_PLATFORMS,
	)('platform "%s": returns URL with correct utm_source, utm_medium=social, utm_campaign', (platform) => {
		const result = buildTaggedUrl(BASE_URL, platform, SLUG);
		const u = new URL(result);
		expect(u.searchParams.get("utm_source")).toBe(platform);
		expect(u.searchParams.get("utm_medium")).toBe("social");
		expect(u.searchParams.get("utm_campaign")).toBe(SLUG);
	});

	it("twitter: full URL matches documented format", () => {
		expect(buildTaggedUrl("https://blog.com/foo", "linkedin", "foo")).toBe(
			"https://blog.com/foo?utm_source=linkedin&utm_medium=social&utm_campaign=foo",
		);
	});
});

// ── Unit: buildTaggedUrl — copy unchanged (AC-3) ──────────────────────────────

describe("unit: buildTaggedUrl — 'copy' returns canonical unchanged (AC-3)", () => {
	it("returns canonical URL without any UTM params", () => {
		expect(buildTaggedUrl("https://blog.com/foo", "copy", "foo")).toBe(
			"https://blog.com/foo",
		);
	});

	it("does not modify a URL that already has query params when platform is copy", () => {
		const url = "https://blog.com/foo?ref=newsletter";
		expect(buildTaggedUrl(url, "copy", "foo")).toBe(url);
	});
});

// ── Unit: buildTaggedUrl — preserves existing query params (AC-2) ─────────────

describe("unit: buildTaggedUrl — preserves existing query params (AC-2)", () => {
	it("appends UTM params with & when URL already has a query param", () => {
		const result = buildTaggedUrl(
			"https://blog.com/foo?ref=x",
			"twitter",
			"foo",
		);
		const u = new URL(result);
		// existing param preserved
		expect(u.searchParams.get("ref")).toBe("x");
		// UTM params appended
		expect(u.searchParams.get("utm_source")).toBe("twitter");
		expect(u.searchParams.get("utm_medium")).toBe("social");
		expect(u.searchParams.get("utm_campaign")).toBe("foo");
	});

	it("result contains & between existing param and utm_source (not ?)", () => {
		const result = buildTaggedUrl(
			"https://blog.com/foo?ref=x",
			"linkedin",
			"foo",
		);
		// utm_source must NOT start a new query string (no double ?)
		expect(result).not.toMatch(/\?.*\?/);
		expect(result).toContain("ref=x");
		expect(result).toContain("utm_source=linkedin");
	});
});

// ── Unit: buildTaggedUrl — URL-encoding of slug (AC-1 extension) ──────────────

describe("unit: buildTaggedUrl — slug URL-encoding", () => {
	it("URL-encodes spaces in slug (URL API uses + for spaces in query params)", () => {
		const result = buildTaggedUrl(BASE_URL, "linkedin", "hello world");
		const u = new URL(result);
		// URL.searchParams serializes spaces as + in application/x-www-form-urlencoded
		expect(result).toContain("utm_campaign=hello+world");
		// decoded value must still round-trip correctly
		expect(u.searchParams.get("utm_campaign")).toBe("hello world");
	});

	it("URL-encodes special chars in slug", () => {
		const result = buildTaggedUrl(BASE_URL, "reddit", "foo/bar&baz");
		const u = new URL(result);
		expect(u.searchParams.get("utm_campaign")).toBe("foo/bar&baz");
	});
});

// ── Unit: buildTaggedUrl — relative URL fallback (SSR safety) ─────────────────

describe("unit: buildTaggedUrl — relative URL fallback (SSR safety)", () => {
	it("does not throw for a relative URL path", () => {
		expect(() =>
			buildTaggedUrl("/my-slug", "twitter", "my-slug"),
		).not.toThrow();
	});

	it("relative URL fallback appends utm params via naive concat", () => {
		const result = buildTaggedUrl("/my-slug", "linkedin", "my-slug");
		expect(result).toContain("utm_source=linkedin");
		expect(result).toContain("utm_medium=social");
		expect(result).toContain("utm_campaign=my-slug");
	});

	it("relative URL with existing params uses & separator in fallback", () => {
		const result = buildTaggedUrl("/my-slug?foo=bar", "reddit", "my-slug");
		// should use & not ? as separator
		expect(result).toMatch(/foo=bar&utm_source=reddit/);
	});
});

// ── Unit: SHARE_PLATFORMS array integrity (AC-4) ──────────────────────────────

describe("unit: SHARE_PLATFORMS array integrity (AC-4)", () => {
	it("SHARE_PLATFORMS.length === 6", () => {
		expect(SHARE_PLATFORMS.length).toBe(6);
	});

	const EXPECTED_IDS: PlatformId[] = [
		"twitter",
		"linkedin",
		"reddit",
		"whatsapp",
		"email",
		"copy",
	];

	it("contains all expected platform ids", () => {
		const ids = SHARE_PLATFORMS.map((p) => p.id);
		for (const id of EXPECTED_IDS) {
			expect(ids).toContain(id);
		}
	});

	it('"copy" entry has no utmSource (ADR-001 amendment)', () => {
		const copy = SHARE_PLATFORMS.find((p) => p.id === "copy");
		expect(copy?.utmSource).toBeUndefined();
	});

	it('"copy" entry has no href (clipboard action, not share-intent)', () => {
		const copy = SHARE_PLATFORMS.find((p) => p.id === "copy");
		expect(copy?.href).toBeUndefined();
	});

	it("all non-copy entries have utmSource defined", () => {
		for (const p of SHARE_PLATFORMS.filter((p) => p.id !== "copy")) {
			expect(p.utmSource, `${p.id} should have utmSource`).toBeDefined();
		}
	});

	it("all non-copy entries have href defined", () => {
		for (const p of SHARE_PLATFORMS.filter((p) => p.id !== "copy")) {
			expect(p.href, `${p.id} should have href`).toBeDefined();
		}
	});

	it("all entries have an Icon component (truthy, callable React component)", () => {
		for (const p of SHARE_PLATFORMS) {
			expect(p.Icon, `${p.id} should have Icon`).toBeDefined();
			// lucide icons are forwardRef objects (typeof "object"), not plain functions —
			// check truthy existence rather than function typeof.
			expect(p.Icon).toBeTruthy();
		}
	});
});

// ── Unit: labelKey / i18n coupling (AC-4) ────────────────────────────────────

describe("unit: labelKey / i18n coupling (AC-4)", () => {
	it("every SHARE_PLATFORMS entry labelKey is a valid key in strings.en.postShare.chips", () => {
		const chips = strings.en.postShare.chips;
		for (const p of SHARE_PLATFORMS) {
			expect(
				Object.hasOwn(chips, p.labelKey),
				`strings.en.postShare.chips["${p.labelKey}"] must exist`,
			).toBe(true);
		}
	});

	it("every labelKey chip value is a non-empty string in en locale", () => {
		const chips = strings.en.postShare.chips;
		for (const p of SHARE_PLATFORMS) {
			const val = (chips as Record<string, string>)[p.labelKey];
			expect(typeof val, `chips["${p.labelKey}"] type`).toBe("string");
			expect(val.length, `chips["${p.labelKey}"] non-empty`).toBeGreaterThan(0);
		}
	});

	it("every labelKey chip value is a non-empty string in pt-br locale", () => {
		const chips = strings["pt-br"].postShare.chips;
		for (const p of SHARE_PLATFORMS) {
			const val = (chips as Record<string, string>)[p.labelKey];
			expect(typeof val, `pt-br chips["${p.labelKey}"] type`).toBe("string");
			expect(
				val.length,
				`pt-br chips["${p.labelKey}"] non-empty`,
			).toBeGreaterThan(0);
		}
	});
});

// ── Unit: href builders sanity-check ─────────────────────────────────────────

describe("unit: href builders — sanity checks", () => {
	const TITLE = "Hello World";
	const TAGGED =
		"https://blog.com/foo?utm_source=twitter&utm_medium=social&utm_campaign=foo";

	it("twitter href starts with twitter.com/intent/tweet", () => {
		const twitter = SHARE_PLATFORMS.find((p) => p.id === "twitter");
		const href = twitter?.href?.(TAGGED, TITLE) ?? "";
		expect(href).toMatch(/^https:\/\/twitter\.com\/intent\/tweet/);
		expect(href).toContain(encodeURIComponent(TITLE));
		expect(href).toContain(encodeURIComponent(TAGGED));
	});

	it("linkedin href starts with linkedin.com/sharing/share-offsite", () => {
		const linkedin = SHARE_PLATFORMS.find((p) => p.id === "linkedin");
		const href = linkedin?.href?.(TAGGED, TITLE) ?? "";
		expect(href).toMatch(/linkedin\.com\/sharing\/share-offsite/);
		expect(href).toContain(encodeURIComponent(TAGGED));
	});

	it("reddit href starts with reddit.com/submit", () => {
		const reddit = SHARE_PLATFORMS.find((p) => p.id === "reddit");
		const href = reddit?.href?.(TAGGED, TITLE) ?? "";
		expect(href).toMatch(/reddit\.com\/submit/);
	});

	it("whatsapp href starts with wa.me", () => {
		const whatsapp = SHARE_PLATFORMS.find((p) => p.id === "whatsapp");
		const href = whatsapp?.href?.(TAGGED, TITLE) ?? "";
		expect(href).toMatch(/^https:\/\/wa\.me\//);
		expect(href).toContain(encodeURIComponent(TITLE));
	});

	it("email href starts with mailto:", () => {
		const email = SHARE_PLATFORMS.find((p) => p.id === "email");
		const href = email?.href?.(TAGGED, TITLE) ?? "";
		expect(href).toMatch(/^mailto:\?subject=/);
		expect(href).toContain(encodeURIComponent(TITLE));
		expect(href).toContain(encodeURIComponent(TAGGED));
	});
});
