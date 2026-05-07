import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";

// Mirror the beforeLoad validation used in app/routes/$lang.tsx
function isValidLocale(lang: string): lang is Locale {
	return LOCALES.includes(lang as Locale);
}

// ─── unit: $lang beforeLoad — valid locale (no-redirect branch) ──────────────

describe("unit: $lang beforeLoad — valid locale (no redirect)", () => {
	it("'en' is a valid locale", () => {
		expect(isValidLocale("en")).toBe(true);
	});

	it("'pt-br' is a valid locale", () => {
		expect(isValidLocale("pt-br")).toBe(true);
	});

	it("LOCALES contains exactly the supported locales", () => {
		expect(LOCALES).toHaveLength(2);
		expect(LOCALES).toContain("en");
		expect(LOCALES).toContain("pt-br");
	});
});

// ─── unit: $lang beforeLoad — invalid locale (redirect branch) ───────────────

describe("unit: $lang beforeLoad — invalid locale (redirect)", () => {
	it("'invalid' is not a valid locale", () => {
		expect(isValidLocale("invalid")).toBe(false);
	});

	it("'about' is not a valid locale", () => {
		expect(isValidLocale("about")).toBe(false);
	});

	it("'login' is not a valid locale", () => {
		expect(isValidLocale("login")).toBe(false);
	});

	it("empty string is not a valid locale", () => {
		expect(isValidLocale("")).toBe(false);
	});
});

// ─── unit: $lang beforeLoad — redirect destination for slug-like param ────────

function computeRedirectTarget(lang: string) {
	if (!isValidLocale(lang)) {
		return {
			to: "/$lang/$slug",
			params: { lang: DEFAULT_LOCALE, slug: lang },
		};
	}
	return null;
}

describe("unit: $lang beforeLoad — redirect target when lang is a slug", () => {
	it("redirects slug-like param to /$lang/$slug with default locale", () => {
		expect(computeRedirectTarget("react-suspense")).toEqual({
			to: "/$lang/$slug",
			params: { lang: "en", slug: "react-suspense" },
		});
	});

	it("preserves the full slug value in redirect params", () => {
		expect(computeRedirectTarget("my-post-slug")).toEqual({
			to: "/$lang/$slug",
			params: { lang: "en", slug: "my-post-slug" },
		});
	});

	it("does not redirect for valid locale 'en'", () => {
		expect(computeRedirectTarget("en")).toBeNull();
	});

	it("does not redirect for valid locale 'pt-br'", () => {
		expect(computeRedirectTarget("pt-br")).toBeNull();
	});
});
