// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	DEFAULT_LOCALE,
	detectLocaleFromRequest,
	LocaleProvider,
	localeHref,
	useLocale,
} from "#/lib/locale";

// ─── helpers ────────────────────────────────────────────────────────────────

function makeRequest(acceptLanguage?: string, cookie?: string): Request {
	const headers: Record<string, string> = {};
	if (acceptLanguage !== undefined) {
		headers["Accept-Language"] = acceptLanguage;
	}
	if (cookie !== undefined) {
		headers.Cookie = cookie;
	}
	return new Request("http://localhost/", { headers });
}

function wrapper({ children }: { children: React.ReactNode }) {
	return React.createElement(LocaleProvider, null, children);
}

// ─── unit: localeHref ───────────────────────────────────────────────────────

describe("unit: localeHref", () => {
	it("en feed → '/'", () => {
		expect(localeHref("en")).toBe("/");
	});

	it("pt-br feed → '/pt-br/'", () => {
		expect(localeHref("pt-br")).toBe("/pt-br/");
	});

	it("en post → '/slug'", () => {
		expect(localeHref("en", "my-post")).toBe("/my-post");
	});

	it("pt-br post → '/pt-br/slug'", () => {
		expect(localeHref("pt-br", "my-post")).toBe("/pt-br/my-post");
	});

	it("en href has no /en/ prefix", () => {
		expect(localeHref("en", "slug")).not.toContain("/en/");
	});

	it("en feed has no /en/ prefix", () => {
		expect(localeHref("en")).not.toContain("/en");
	});
});

// ─── unit: detectLocaleFromRequest ──────────────────────────────────────────

describe("unit: detectLocaleFromRequest", () => {
	it("pt-BR,pt;q=0.9,en-US;q=0.8 → 'pt-br'", () => {
		expect(
			detectLocaleFromRequest(makeRequest("pt-BR,pt;q=0.9,en-US;q=0.8")),
		).toBe("pt-br");
	});

	it("en-US,en;q=0.9 → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest("en-US,en;q=0.9"))).toBe("en");
	});

	it("'pt' → 'pt-br'", () => {
		expect(detectLocaleFromRequest(makeRequest("pt"))).toBe("pt-br");
	});

	it("missing header → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest())).toBe("en");
	});

	it("empty header → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest(""))).toBe(DEFAULT_LOCALE);
	});

	it("cookie locale=en overrides Accept-Language: pt-BR", () => {
		expect(
			detectLocaleFromRequest(
				makeRequest("pt-BR,pt;q=0.9,en-US;q=0.8", "locale=en"),
			),
		).toBe("en");
	});

	it("cookie locale=pt-br overrides Accept-Language: en-US", () => {
		expect(
			detectLocaleFromRequest(makeRequest("en-US,en;q=0.9", "locale=pt-br")),
		).toBe("pt-br");
	});

	it("invalid cookie locale falls back to Accept-Language", () => {
		expect(
			detectLocaleFromRequest(makeRequest("pt-BR,pt;q=0.9", "locale=fr")),
		).toBe("pt-br");
	});

	it("cookie among multiple cookies → locale=en wins", () => {
		expect(
			detectLocaleFromRequest(
				makeRequest("pt-BR,pt;q=0.9", "theme=dark; locale=en; other=value"),
			),
		).toBe("en");
	});
});

// ─── unit: LocaleProvider + useLocale ───────────────────────────────────────

describe("unit: LocaleProvider + useLocale", () => {
	beforeEach(() => localStorage.clear());
	afterEach(() => localStorage.clear());

	it("initializes with 'en' when localStorage has no 'locale' key", async () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		await act(async () => {});
		expect(result.current.locale).toBe("en");
	});

	it("setLocale('pt-br') writes 'pt-br' to localStorage", async () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		await act(async () => {
			result.current.setLocale("pt-br");
		});
		expect(localStorage.getItem("locale")).toBe("pt-br");
		expect(result.current.locale).toBe("pt-br");
	});

	it("useLocale() returns { locale, setLocale } shape", () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		expect(result.current).toHaveProperty("locale");
		expect(typeof result.current.setLocale).toBe("function");
	});
});
