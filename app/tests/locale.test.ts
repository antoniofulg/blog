// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
	buildLocaleHead,
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

	it("en-US,en;q=0.9,pt;q=0.1 → 'en' (English wins by weight)", () => {
		expect(
			detectLocaleFromRequest(makeRequest("en-US,en;q=0.9,pt;q=0.1")),
		).toBe("en");
	});

	it("en;q=1.0,pt;q=0.0 → 'en' (pt explicitly declined)", () => {
		expect(detectLocaleFromRequest(makeRequest("en;q=1.0,pt;q=0.0"))).toBe(
			"en",
		);
	});

	it("zh-CN,zh;q=0.9,en-US;q=0.8,pt-BR;q=0.1 → 'en' (en beats pt by weight)", () => {
		expect(
			detectLocaleFromRequest(
				makeRequest("zh-CN,zh;q=0.9,en-US;q=0.8,pt-BR;q=0.1"),
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

// ─── unit: buildLocaleHead ───────────────────────────────────────────────────

describe("unit: buildLocaleHead", () => {
	it("en → canonical '/'", () => {
		const { links } = buildLocaleHead("en");
		const canonical = links.find((l) => l.rel === "canonical");
		expect(canonical?.href).toBe("/");
	});

	it("pt-br → canonical '/pt-br/'", () => {
		const { links } = buildLocaleHead("pt-br");
		const canonical = links.find((l) => l.rel === "canonical");
		expect(canonical?.href).toBe("/pt-br/");
	});

	it("en → og:locale 'en_US'", () => {
		const { meta } = buildLocaleHead("en");
		const ogLocale = meta.find(
			(m) => "property" in m && m.property === "og:locale",
		);
		expect(ogLocale && "content" in ogLocale ? ogLocale.content : null).toBe(
			"en_US",
		);
	});

	it("pt-br → og:locale 'pt_BR'", () => {
		const { meta } = buildLocaleHead("pt-br");
		const ogLocale = meta.find(
			(m) => "property" in m && m.property === "og:locale",
		);
		expect(ogLocale && "content" in ogLocale ? ogLocale.content : null).toBe(
			"pt_BR",
		);
	});

	it("en → description matches en copy", () => {
		const { meta } = buildLocaleHead("en");
		const desc = meta.find((m) => "name" in m && m.name === "description");
		expect(desc && "content" in desc ? desc.content : null).toContain(
			"Articles about",
		);
	});

	it("pt-br → description matches pt-br copy", () => {
		const { meta } = buildLocaleHead("pt-br");
		const desc = meta.find((m) => "name" in m && m.name === "description");
		expect(desc && "content" in desc ? desc.content : null).toContain(
			"Artigos sobre",
		);
	});

	it("alternate hreflang links present for all locales", () => {
		const { links } = buildLocaleHead("en");
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(alternates).toHaveLength(2);
		const langs = alternates.map((l) => ("hrefLang" in l ? l.hrefLang : null));
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});
});
