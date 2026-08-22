import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import React from "react";
import {
	buildLocaleHead,
	collapseDefaultLocalePath,
	DEFAULT_LOCALE,
	detectLocaleFromRequest,
	getTwinAvailabilityForCurrentRoute,
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

// ─── unit: getTwinAvailabilityForCurrentRoute ────────────────────────────────

describe("unit: getTwinAvailabilityForCurrentRoute", () => {
	test("post with twin → available: true, renderSwitcher: true", () => {
		expect(
			getTwinAvailabilityForCurrentRoute(
				{ kind: "post", slug: "my-post", hasTwin: true },
				"pt-br",
			),
		).toEqual({ available: true, renderSwitcher: true });
	});

	test("post without twin → available: false, renderSwitcher: true (AC-1)", () => {
		expect(
			getTwinAvailabilityForCurrentRoute(
				{ kind: "post", slug: "x", hasTwin: false },
				"pt-br",
			),
		).toEqual({ available: false, renderSwitcher: true });
	});

	test("page with twin → available: true, renderSwitcher: true", () => {
		expect(
			getTwinAvailabilityForCurrentRoute(
				{ kind: "page", slug: "about", hasTwin: true },
				"pt-br",
			),
		).toEqual({ available: true, renderSwitcher: true });
	});

	test("page without twin → available: false, renderSwitcher: true", () => {
		expect(
			getTwinAvailabilityForCurrentRoute(
				{ kind: "page", slug: "about", hasTwin: false },
				"pt-br",
			),
		).toEqual({ available: false, renderSwitcher: true });
	});

	test("structural → available: true, renderSwitcher: true (AC-2)", () => {
		expect(
			getTwinAvailabilityForCurrentRoute({ kind: "structural" }, "pt-br"),
		).toEqual({ available: true, renderSwitcher: true });
	});

	test("structural → same result for en target", () => {
		expect(
			getTwinAvailabilityForCurrentRoute({ kind: "structural" }, "en"),
		).toEqual({ available: true, renderSwitcher: true });
	});

	// Admin used to hide the switcher (renderSwitcher: false) and pin it to
	// the sidebar. It now lives in the Header for admin too, consistent with
	// reader pages; the admin branch in useLangSwitcher short-circuits the
	// URL navigate so setLocale alone updates the locale context.
	test("admin → renderSwitcher: true (switcher moved to Header)", () => {
		const result = getTwinAvailabilityForCurrentRoute(
			{ kind: "admin" },
			"pt-br",
		);
		expect(result.renderSwitcher).toBe(true);
	});

	test("admin → available: true (no twin concept; both locales always reachable)", () => {
		const result = getTwinAvailabilityForCurrentRoute(
			{ kind: "admin" },
			"pt-br",
		);
		expect(result.available).toBe(true);
	});

	test("post with twin targeting en → available: true", () => {
		expect(
			getTwinAvailabilityForCurrentRoute(
				{ kind: "post", slug: "hello", hasTwin: true },
				"en",
			),
		).toEqual({ available: true, renderSwitcher: true });
	});
});

// ─── unit: collapseDefaultLocalePath ────────────────────────────────────────

describe("unit: collapseDefaultLocalePath", () => {
	test("'/' stays '/'", () => {
		expect(collapseDefaultLocalePath("/")).toBe("/");
	});

	test(`'/${DEFAULT_LOCALE}/' collapses to '/'`, () => {
		expect(collapseDefaultLocalePath(`/${DEFAULT_LOCALE}/`)).toBe("/");
	});

	test(`'/${DEFAULT_LOCALE}/about/' collapses to '/about/'`, () => {
		expect(collapseDefaultLocalePath(`/${DEFAULT_LOCALE}/about/`)).toBe(
			"/about/",
		);
	});

	test("'/pt-br/' stays '/pt-br/' (non-default locale kept)", () => {
		expect(collapseDefaultLocalePath("/pt-br/")).toBe("/pt-br/");
	});

	test("'/pt-br/about/' stays '/pt-br/about/'", () => {
		expect(collapseDefaultLocalePath("/pt-br/about/")).toBe("/pt-br/about/");
	});

	test("'/other/' stays '/other/' (arbitrary path untouched)", () => {
		expect(collapseDefaultLocalePath("/other/")).toBe("/other/");
	});
});

// ─── unit: localeHref ───────────────────────────────────────────────────────

describe("unit: localeHref", () => {
	test("en feed → '/'", () => {
		expect(localeHref("en")).toBe("/");
	});

	test("pt-br feed → '/pt-br/'", () => {
		expect(localeHref("pt-br")).toBe("/pt-br/");
	});

	test("en post → '/slug'", () => {
		expect(localeHref("en", "my-post")).toBe("/my-post");
	});

	test("pt-br post → '/pt-br/slug'", () => {
		expect(localeHref("pt-br", "my-post")).toBe("/pt-br/my-post");
	});

	test("en href has no /en/ prefix", () => {
		expect(localeHref("en", "slug")).not.toContain("/en/");
	});

	test("en feed has no /en/ prefix", () => {
		expect(localeHref("en")).not.toContain("/en");
	});
});

// ─── unit: detectLocaleFromRequest ──────────────────────────────────────────

describe("unit: detectLocaleFromRequest", () => {
	test("pt-BR,pt;q=0.9,en-US;q=0.8 → 'pt-br'", () => {
		expect(
			detectLocaleFromRequest(makeRequest("pt-BR,pt;q=0.9,en-US;q=0.8")),
		).toBe("pt-br");
	});

	test("en-US,en;q=0.9 → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest("en-US,en;q=0.9"))).toBe("en");
	});

	test("'pt' → 'pt-br'", () => {
		expect(detectLocaleFromRequest(makeRequest("pt"))).toBe("pt-br");
	});

	test("missing header → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest())).toBe("en");
	});

	test("empty header → 'en'", () => {
		expect(detectLocaleFromRequest(makeRequest(""))).toBe(DEFAULT_LOCALE);
	});

	test("cookie locale=en overrides Accept-Language: pt-BR", () => {
		expect(
			detectLocaleFromRequest(
				makeRequest("pt-BR,pt;q=0.9,en-US;q=0.8", "locale=en"),
			),
		).toBe("en");
	});

	test("cookie locale=pt-br overrides Accept-Language: en-US", () => {
		expect(
			detectLocaleFromRequest(makeRequest("en-US,en;q=0.9", "locale=pt-br")),
		).toBe("pt-br");
	});

	test("invalid cookie locale falls back to Accept-Language", () => {
		expect(
			detectLocaleFromRequest(makeRequest("pt-BR,pt;q=0.9", "locale=fr")),
		).toBe("pt-br");
	});

	test("cookie among multiple cookies → locale=en wins", () => {
		expect(
			detectLocaleFromRequest(
				makeRequest("pt-BR,pt;q=0.9", "theme=dark; locale=en; other=value"),
			),
		).toBe("en");
	});

	test("en-US,en;q=0.9,pt;q=0.1 → 'en' (English wins by weight)", () => {
		expect(
			detectLocaleFromRequest(makeRequest("en-US,en;q=0.9,pt;q=0.1")),
		).toBe("en");
	});

	test("en;q=1.0,pt;q=0.0 → 'en' (pt explicitly declined)", () => {
		expect(detectLocaleFromRequest(makeRequest("en;q=1.0,pt;q=0.0"))).toBe(
			"en",
		);
	});

	test("zh-CN,zh;q=0.9,en-US;q=0.8,pt-BR;q=0.1 → 'en' (en beats pt by weight)", () => {
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

	test("initializes with 'en' when localStorage has no 'locale' key", async () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		await act(async () => {});
		expect(result.current.locale).toBe("en");
	});

	test("setLocale('pt-br') writes 'pt-br' to localStorage", async () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		await act(async () => {
			result.current.setLocale("pt-br");
		});
		expect(localStorage.getItem("locale")).toBe("pt-br");
		expect(result.current.locale).toBe("pt-br");
	});

	test("useLocale() returns { locale, setLocale } shape", () => {
		const { result } = renderHook(() => useLocale(), { wrapper });
		expect(result.current).toHaveProperty("locale");
		expect(typeof result.current.setLocale).toBe("function");
	});
});

// ─── unit: buildLocaleHead ───────────────────────────────────────────────────

describe("unit: buildLocaleHead", () => {
	test("does not emit a canonical link (single source = __root.tsx)", () => {
		// Canonical emission was moved to __root.tsx (locale-aware via pathname
		// collapse) so the rendered HTML has exactly one `<link rel="canonical">`.
		// Duplicate canonicals confuse the audit's strict-mode getAttribute call
		// AND search engines.
		const { links } = buildLocaleHead("en");
		expect(links.find((l) => l.rel === "canonical")).toBeUndefined();
	});

	test("og:url still includes locale-specific canonical pathname", () => {
		// og:url stays in buildLocaleHead because it is a meta property and does
		// not collide with the root layout's link[rel=canonical]. Keeps the
		// per-locale canonical intent visible to social-card scrapers.
		// Path assertion only — the origin comes from `getSiteOrigin()` at
		// request time (SITE_URL env / window.location.origin) and shouldn't
		// be hardcoded in the test.
		const en = buildLocaleHead("en");
		const ogUrlEn = en.meta.find(
			(m) => "property" in m && m.property === "og:url",
		);
		const enContent =
			ogUrlEn && "content" in ogUrlEn ? String(ogUrlEn.content) : "";
		expect(new URL(enContent, "http://x").pathname).toBe("/");

		const ptBr = buildLocaleHead("pt-br");
		const ogUrlPt = ptBr.meta.find(
			(m) => "property" in m && m.property === "og:url",
		);
		const ptContent =
			ogUrlPt && "content" in ogUrlPt ? String(ogUrlPt.content) : "";
		expect(new URL(ptContent, "http://x").pathname).toBe("/pt-br/");
	});

	test("en → og:locale 'en_US'", () => {
		const { meta } = buildLocaleHead("en");
		const ogLocale = meta.find(
			(m) => "property" in m && m.property === "og:locale",
		);
		expect(ogLocale && "content" in ogLocale ? ogLocale.content : null).toBe(
			"en_US",
		);
	});

	test("pt-br → og:locale 'pt_BR'", () => {
		const { meta } = buildLocaleHead("pt-br");
		const ogLocale = meta.find(
			(m) => "property" in m && m.property === "og:locale",
		);
		expect(ogLocale && "content" in ogLocale ? ogLocale.content : null).toBe(
			"pt_BR",
		);
	});

	test("en → description matches en copy", () => {
		const { meta } = buildLocaleHead("en");
		const desc = meta.find((m) => "name" in m && m.name === "description");
		expect(desc && "content" in desc ? desc.content : null).toContain(
			"Articles about",
		);
	});

	test("pt-br → description matches pt-br copy", () => {
		const { meta } = buildLocaleHead("pt-br");
		const desc = meta.find((m) => "name" in m && m.name === "description");
		expect(desc && "content" in desc ? desc.content : null).toContain(
			"Artigos sobre",
		);
	});

	test("no descriptor → emits zero hreflang links (default = no-twin)", () => {
		const { links } = buildLocaleHead("en");
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(alternates).toHaveLength(0);
	});

	test("no-twin descriptor → emits zero hreflang links (AC-2)", () => {
		const { links } = buildLocaleHead("en", { kind: "no-twin" });
		expect(links.filter((l) => l.rel === "alternate")).toHaveLength(0);
	});

	test("has-twin descriptor → emits two locale alternates without x-default", () => {
		const { links } = buildLocaleHead("en", { kind: "has-twin" });
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(alternates).toHaveLength(2);
		const langs = alternates.map((l) => ("hrefLang" in l ? l.hrefLang : null));
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
		expect(langs).not.toContain("x-default");
	});

	test("homepage descriptor (en) → emits x-default + both locale alternates (AC-3)", () => {
		const { links } = buildLocaleHead("en", { kind: "homepage" });
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(alternates).toHaveLength(3);
		const langs = alternates.map((l) => ("hrefLang" in l ? l.hrefLang : null));
		expect(langs).toContain("x-default");
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	test("homepage descriptor (pt-br) → emits x-default + both locale alternates (AC-3)", () => {
		const { links } = buildLocaleHead("pt-br", { kind: "homepage" });
		const alternates = links.filter((l) => l.rel === "alternate");
		expect(alternates).toHaveLength(3);
		const langs = alternates.map((l) => ("hrefLang" in l ? l.hrefLang : null));
		expect(langs).toContain("x-default");
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	test("homepage descriptor → x-default href points to EN root '/'", () => {
		const { links } = buildLocaleHead("en", { kind: "homepage" });
		const xDefault = links.find(
			(l) => "hrefLang" in l && l.hrefLang === "x-default",
		);
		const href = xDefault && "href" in xDefault ? String(xDefault.href) : "";
		// Path assertion only — `getSiteOrigin()` prepends the runtime origin
		// (SITE_URL on SSR, window.location.origin on client) so the full URL
		// can't be hardcoded here.
		expect(new URL(href, "http://x").pathname).toBe("/");
	});

	test("homepage descriptor → pt-br locale href is '/pt-br/'", () => {
		const { links } = buildLocaleHead("en", { kind: "homepage" });
		const ptBrLink = links.find(
			(l) => "hrefLang" in l && l.hrefLang === "pt-BR",
		);
		const href = ptBrLink && "href" in ptBrLink ? String(ptBrLink.href) : "";
		expect(new URL(href, "http://x").pathname).toBe("/pt-br/");
	});
});
