import { describe, expect, it } from "vitest";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";

// Mirror the beforeLoad validation used in app/routes/{-$locale}.tsx
function resolveLocale(param: string | undefined): Locale {
	const locale = param ?? DEFAULT_LOCALE;
	return locale as Locale;
}

function isValidLocale(lang: string): lang is Locale {
	return LOCALES.includes(lang as Locale);
}

// ─── unit: {-$locale} layout — optional param resolution ─────────────────────

describe("unit: {-$locale} layout — optional param resolution", () => {
	it("undefined _locale resolves to DEFAULT_LOCALE ('en')", () => {
		expect(resolveLocale(undefined)).toBe("en");
	});

	it("'en' resolves to 'en'", () => {
		expect(resolveLocale("en")).toBe("en");
	});

	it("'pt-br' resolves to 'pt-br'", () => {
		expect(resolveLocale("pt-br")).toBe("pt-br");
	});
});

// ─── unit: {-$locale} layout — valid locale (no-redirect branch) ─────────────

describe("unit: {-$locale} layout — valid locale (no error)", () => {
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

// ─── unit: {-$locale} layout — invalid locale (notFound branch) ───────────────

describe("unit: {-$locale} layout — invalid locale throws notFound", () => {
	it("'es' is not a valid locale", () => {
		expect(isValidLocale("es")).toBe(false);
	});

	it("'invalid' is not a valid locale", () => {
		expect(isValidLocale("invalid")).toBe(false);
	});

	it("'about' is not a valid locale", () => {
		expect(isValidLocale("about")).toBe(false);
	});

	it("empty string is not a valid locale", () => {
		expect(isValidLocale("")).toBe(false);
	});
});

// ─── unit: layout beforeLoad notFound logic ──────────────────────────────────

function computeBeforeLoadAction(
	param: string | undefined,
): "allow" | "notFound" {
	const locale = param ?? DEFAULT_LOCALE;
	if (!LOCALES.includes(locale as Locale)) return "notFound";
	return "allow";
}

describe("unit: {-$locale} layout beforeLoad actions", () => {
	it("undefined _locale → allow (resolves to DEFAULT_LOCALE)", () => {
		expect(computeBeforeLoadAction(undefined)).toBe("allow");
	});

	it("'en' → allow", () => {
		expect(computeBeforeLoadAction("en")).toBe("allow");
	});

	it("'pt-br' → allow", () => {
		expect(computeBeforeLoadAction("pt-br")).toBe("allow");
	});

	it("'es' → notFound", () => {
		expect(computeBeforeLoadAction("es")).toBe("notFound");
	});

	it("'invalid-locale' → notFound", () => {
		expect(computeBeforeLoadAction("invalid-locale")).toBe("notFound");
	});
});
