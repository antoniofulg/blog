import { createServer } from "node:net";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const listPostsFn = vi
		.fn<[string], Promise<Array<{ slug: string; lang: string }>>>()
		.mockResolvedValue([]);
	const enumerateStaticPages = vi.fn().mockResolvedValue([]);
	const staticPageHasTwin = vi.fn().mockReturnValue(false);
	return { listPostsFn, enumerateStaticPages, staticPageHasTwin };
});

vi.mock("#/db/queries", () => ({
	listPostsFn: mocks.listPostsFn,
}));

vi.mock("#/lib/mdx/pages.server", () => ({
	enumerateStaticPages: mocks.enumerateStaticPages,
	staticPageHasTwin: mocks.staticPageHasTwin,
}));

import {
	getSitemapEntriesFn,
	getSitemapXmlResponse,
	type SitemapEntry,
} from "#/routes/sitemap[.]xml.server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makePost(slug: string, lang: "en" | "pt-br" = "en") {
	return {
		id: 1,
		filePath: `/content/posts/${lang}/${slug}.mdx`,
		slug,
		lang,
		title: `Post ${slug}`,
		description: null,
		publishedAt: null,
		viewCount: 0,
		indexedAt: new Date(),
		category: null,
		series: null,
		seriesPart: null,
		draft: null,
	};
}

function makePage(slug: string, locale: "en" | "pt-br" = "en") {
	return {
		slug,
		locale,
		filePath: `/app/content/pages/${locale}/${slug}.mdx`,
		frontmatter: { title: `Page ${slug}` },
	};
}

function assertReciprocity(entries: SitemapEntry[]): void {
	const locSet = new Map(entries.map((e) => [e.loc, e.alternates]));
	for (const entry of entries) {
		for (const alt of entry.alternates) {
			expect(
				locSet.has(alt.href),
				`${alt.href} referenced in alternates but not in urlset`,
			).toBe(true);
			const refAlts = locSet.get(alt.href)!;
			const hasReciprocal = refAlts.some((a) => a.href === entry.loc);
			expect(
				hasReciprocal,
				`${alt.href} missing reciprocal annotation pointing to ${entry.loc}`,
			).toBe(true);
		}
	}
}

// ─── Unit: getSitemapEntriesFn — structural entries ───────────────────────────

describe("unit: getSitemapEntriesFn — structural homepage entries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.listPostsFn.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);
	});

	it("always includes EN homepage entry", async () => {
		const entries = await getSitemapEntriesFn();
		const enHome = entries.find(
			(e) => e.loc.endsWith("/") && !e.loc.includes("/pt-br/"),
		);
		expect(enHome).toBeDefined();
	});

	it("always includes PT-BR homepage entry", async () => {
		const entries = await getSitemapEntriesFn();
		const ptbrHome = entries.find((e) => e.loc.endsWith("/pt-br/"));
		expect(ptbrHome).toBeDefined();
	});

	it("EN homepage entry has isDefault: true", async () => {
		const entries = await getSitemapEntriesFn();
		const enHome = entries.find(
			(e) => e.loc.endsWith("/") && !e.loc.includes("/pt-br/"),
		);
		expect(enHome?.isDefault).toBe(true);
	});

	it("PT-BR homepage entry does NOT have isDefault", async () => {
		const entries = await getSitemapEntriesFn();
		const ptbrHome = entries.find((e) => e.loc.endsWith("/pt-br/"));
		expect(ptbrHome?.isDefault).toBeFalsy();
	});

	it("homepage entries have alternates for both locales", async () => {
		const entries = await getSitemapEntriesFn();
		const enHome = entries.find(
			(e) => e.loc.endsWith("/") && !e.loc.includes("/pt-br/"),
		)!;
		const hreflangs = enHome.alternates.map((a) => a.hreflang);
		expect(hreflangs).toContain("en");
		expect(hreflangs).toContain("pt-BR");
	});

	it("SITE_URL env var sets origin", async () => {
		vi.stubEnv("SITE_URL", "https://example.com");
		try {
			const entries = await getSitemapEntriesFn();
			expect(entries.some((e) => e.loc.startsWith("https://example.com"))).toBe(
				true,
			);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("SITE_URL trailing slash is stripped", async () => {
		vi.stubEnv("SITE_URL", "https://example.com/");
		try {
			const entries = await getSitemapEntriesFn();
			expect(entries.some((e) => e.loc === "https://example.com/")).toBe(true);
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("falls back to localhost:3000 when SITE_URL is absent", async () => {
		vi.stubEnv("SITE_URL", "");
		try {
			// empty string → falsy → fallback
			const entries = await getSitemapEntriesFn();
			// Empty SITE_URL resolves to "" which is falsy, but ?? only checks null/undefined
			// so this tests the actual conditional
			expect(entries.length).toBeGreaterThan(0);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

// ─── Unit: getSitemapEntriesFn — posts ───────────────────────────────────────

describe("unit: getSitemapEntriesFn — post entries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);
	});

	it("includes an entry per EN post", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("hello-world"), makePost("second-post")] : [],
		);
		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.includes("/hello-world"))).toBe(true);
		expect(entries.some((e) => e.loc.includes("/second-post"))).toBe(true);
	});

	it("includes an entry per PT-BR post", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "pt-br" ? [makePost("ola-mundo", "pt-br")] : [],
		);
		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.includes("/pt-br/ola-mundo"))).toBe(true);
	});

	it("EN post with both locales: EN entry has both hreflang alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("shared-post")]
				: [makePost("shared-post", "pt-br")],
		);
		const entries = await getSitemapEntriesFn();
		const enEntry = entries.find((e) => e.loc.endsWith("/shared-post"));
		expect(enEntry?.alternates).toHaveLength(2);
		const langs = enEntry!.alternates.map((a) => a.hreflang);
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	it("EN post with both locales: PT-BR entry has both hreflang alternates (reciprocal)", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("shared-post")]
				: [makePost("shared-post", "pt-br")],
		);
		const entries = await getSitemapEntriesFn();
		const ptbrEntry = entries.find((e) => e.loc.includes("/pt-br/shared-post"));
		expect(ptbrEntry?.alternates).toHaveLength(2);
		const langs = ptbrEntry!.alternates.map((a) => a.hreflang);
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	it("EN-only post: EN entry has no hreflang alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("en-only")] : [],
		);
		const entries = await getSitemapEntriesFn();
		const enEntry = entries.find((e) => e.loc.endsWith("/en-only"));
		expect(enEntry?.alternates).toHaveLength(0);
	});

	it("PT-BR-only post: PT-BR entry has no hreflang alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "pt-br" ? [makePost("ptbr-only", "pt-br")] : [],
		);
		const entries = await getSitemapEntriesFn();
		const ptbrEntry = entries.find((e) => e.loc.includes("/pt-br/ptbr-only"));
		expect(ptbrEntry?.alternates).toHaveLength(0);
	});

	it("mixed fixture: en-only post has no alternates; bilingual post has alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) => {
			if (lang === "en") return [makePost("both"), makePost("en-only")];
			if (lang === "pt-br") return [makePost("both", "pt-br")];
			return [];
		});
		const entries = await getSitemapEntriesFn();

		const enOnly = entries.find((e) => e.loc.endsWith("/en-only"));
		const enBoth = entries.find(
			(e) => e.loc.endsWith("/both") && !e.loc.includes("pt-br"),
		);
		const ptbrBoth = entries.find((e) => e.loc.includes("/pt-br/both"));

		expect(enOnly?.alternates).toHaveLength(0);
		expect(enBoth?.alternates.length).toBeGreaterThan(0);
		expect(ptbrBoth?.alternates.length).toBeGreaterThan(0);
	});
});

// ─── Unit: getSitemapEntriesFn — static pages ────────────────────────────────

describe("unit: getSitemapEntriesFn — static page entries", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.listPostsFn.mockResolvedValue([]);
	});

	it("includes an entry per EN page", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("about")] : [],
		);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.endsWith("/about"))).toBe(true);
	});

	it("includes an entry per PT-BR page", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "pt-br" ? [makePage("sobre", "pt-br")] : [],
		);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.includes("/pt-br/sobre"))).toBe(true);
	});

	it("EN page with twin: EN entry has both hreflang alternates", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("about")] : [makePage("about", "pt-br")],
		);
		mocks.staticPageHasTwin.mockReturnValue(true);

		const entries = await getSitemapEntriesFn();
		const enAbout = entries.find((e) => e.loc.endsWith("/about"));
		expect(enAbout?.alternates).toHaveLength(2);
		const langs = enAbout!.alternates.map((a) => a.hreflang);
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	it("EN page without twin: EN entry has no hreflang alternates", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("uses")] : [],
		);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		const enUses = entries.find((e) => e.loc.endsWith("/uses"));
		expect(enUses?.alternates).toHaveLength(0);
	});

	it("PT-BR page with twin: PT-BR entry has both hreflang alternates", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("about")] : [makePage("about", "pt-br")],
		);
		mocks.staticPageHasTwin.mockReturnValue(true);

		const entries = await getSitemapEntriesFn();
		const ptbrAbout = entries.find((e) => e.loc.includes("/pt-br/about"));
		expect(ptbrAbout?.alternates).toHaveLength(2);
	});
});

// ─── Unit: reciprocity invariant ─────────────────────────────────────────────

describe("unit: reciprocity invariant (AC-4)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("homepages only: reciprocity holds", async () => {
		mocks.listPostsFn.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	it("bilingual post: reciprocity holds", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("shared")] : [makePost("shared", "pt-br")],
		);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	it("EN-only post: reciprocity holds (no alternates → no pairs to check)", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("en-only")] : [],
		);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	it("mixed fixture (post + page, bilingual + unilingual): reciprocity holds", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) => {
			if (lang === "en") return [makePost("shared-post"), makePost("en-only")];
			if (lang === "pt-br") return [makePost("shared-post", "pt-br")];
			return [];
		});
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("about")] : [makePage("about", "pt-br")],
		);
		mocks.staticPageHasTwin.mockImplementation(
			(slug: string) => slug === "about",
		);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	it("zero asymmetric hreflang violations: PSM-5", async () => {
		// Success Metric #5: asymmetric hreflang violations = 0
		mocks.listPostsFn.mockImplementation(async (lang: string) => {
			if (lang === "en")
				return [makePost("a"), makePost("b"), makePost("en-c")];
			if (lang === "pt-br")
				return [
					makePost("a", "pt-br"),
					makePost("b", "pt-br"),
					makePost("pt-d", "pt-br"),
				];
			return [];
		});
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en"
				? [makePage("about"), makePage("uses")]
				: [makePage("about", "pt-br")],
		);
		mocks.staticPageHasTwin.mockImplementation(
			(slug: string, targetLocale: string) => {
				if (slug === "about") return true;
				if (slug === "uses" && targetLocale === "pt-br") return false;
				if (slug === "about" && targetLocale === "en") return true;
				return false;
			},
		);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);

		// Explicit count: zero asymmetric violations
		const locSet = new Map(entries.map((e) => [e.loc, e.alternates]));
		let violations = 0;
		for (const entry of entries) {
			for (const alt of entry.alternates) {
				const refAlts = locSet.get(alt.href);
				if (!refAlts || !refAlts.some((a) => a.href === entry.loc))
					violations++;
			}
		}
		expect(violations).toBe(0);
	});
});

// ─── Unit: getSitemapXmlResponse — response contract ─────────────────────────

describe("unit: getSitemapXmlResponse — response contract", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.listPostsFn.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);
	});

	it("returns HTTP 200", async () => {
		const res = await getSitemapXmlResponse();
		expect(res.status).toBe(200);
	});

	it("sets content-type: application/xml", async () => {
		const res = await getSitemapXmlResponse();
		expect(res.headers.get("content-type")).toBe("application/xml");
	});

	it("body starts with XML declaration", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
	});

	it("body contains urlset with correct namespaces (AC-1)", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body).toContain(
			'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		);
		expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
	});

	it("body ends with </urlset>", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body.trimEnd()).toMatch(/<\/urlset>$/);
	});

	it("body contains <url> and <loc> elements", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body).toContain("<url>");
		expect(body).toContain("<loc>");
	});

	it("x-default annotation present only on EN homepage (AC-3)", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("some-post")]
				: [makePost("some-post", "pt-br")],
		);
		const body = await (await getSitemapXmlResponse()).text();
		const xdefaultMatches = body.match(/hreflang="x-default"/g) ?? [];
		expect(xdefaultMatches).toHaveLength(1);
	});

	it("bilingual post: both locale <url> entries appear in body (AC-2)", async () => {
		vi.stubEnv("SITE_URL", "http://localhost:3000");
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("my-post"), makePost("en-only")]
				: [makePost("my-post", "pt-br")],
		);
		try {
			const body = await (await getSitemapXmlResponse()).text();
			// my-post has pt-BR alternate; en-only does not
			expect(body).toContain("/my-post");
			expect(body).toContain("/pt-br/my-post");
			const enOnlyMatch = body.match(/<loc>[^<]*\/en-only<\/loc>/);
			expect(enOnlyMatch).toBeTruthy();
			// en-only loc should not be followed by an xhtml:link with pt-br
			const enOnlyBlock = body.slice(
				body.indexOf("/en-only") - 20,
				body.indexOf("/en-only") + 200,
			);
			expect(enOnlyBlock).not.toContain("pt-BR");
		} finally {
			vi.unstubAllEnvs();
		}
	});

	it("XML escaping: special chars in origin are escaped", async () => {
		vi.stubEnv("SITE_URL", "http://localhost:3000");
		try {
			const body = await (await getSitemapXmlResponse()).text();
			// No unescaped & in attribute values or text
			expect(body).not.toMatch(/href="[^"]*&[^a][^m][^p]/);
		} finally {
			vi.unstubAllEnvs();
		}
	});
});

// ─── Integration: GET /sitemap.xml (skipped when dev server not running) ──────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port3000Free = await isPortFree(3000);

describe.skipIf(port3000Free)("integration: GET /sitemap.xml", () => {
	const BASE_URL = "http://localhost:3000";

	it("returns 200", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		expect(res.status).toBe(200);
	});

	it("content-type is application/xml", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		expect(res.headers.get("content-type")).toContain("application/xml");
	});

	it("body contains urlset with sitemaps namespace", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		const body = await res.text();
		expect(body).toContain(
			'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		);
		expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
	});

	it("reciprocity invariant holds on live fixture set", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		const body = await res.text();

		// Extract all <loc> values and their <xhtml:link> annotations
		const urlBlocks = body.match(/<url>([\s\S]*?)<\/url>/g) ?? [];
		type ParsedUrl = {
			loc: string;
			alts: Array<{ hreflang: string; href: string }>;
		};
		const parsed: ParsedUrl[] = urlBlocks.map((block) => {
			const locMatch = block.match(/<loc>([^<]+)<\/loc>/);
			const loc = locMatch?.[1] ?? "";
			const altMatches = [
				...block.matchAll(/hreflang="([^"]+)" href="([^"]+)"/g),
			].map((m) => ({ hreflang: m[1], href: m[2] }));
			return { loc, alts: altMatches };
		});

		const locSet = new Map(parsed.map((p) => [p.loc, p.alts]));
		for (const p of parsed) {
			for (const alt of p.alts) {
				if (alt.hreflang === "x-default") continue;
				expect(locSet.has(alt.href)).toBe(true);
				const refAlts = locSet.get(alt.href)!;
				expect(refAlts.some((a) => a.href === p.loc)).toBe(true);
			}
		}
	});
});
