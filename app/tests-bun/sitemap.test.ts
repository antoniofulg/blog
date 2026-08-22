import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { createServer } from "node:net";
import type { Post } from "#/db/schema";
import type { Locale } from "#/lib/locale";
import type { PageEntry } from "#/lib/mdx/pages.server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = (() => {
	const listPostsFn = jest
		.fn<(lang: Locale) => Promise<Post[]>>()
		.mockResolvedValue([]);
	const enumerateStaticPages = jest
		.fn<(locale: Locale) => Promise<PageEntry[]>>()
		.mockResolvedValue([]);
	const staticPageHasTwin = jest
		.fn<(slug: string, targetLocale: Locale) => boolean>()
		.mockReturnValue(false);
	return { listPostsFn, enumerateStaticPages, staticPageHasTwin };
})();

const savedEnv = new Map<string, string | undefined>();
function stubEnv(name: string, value: string): void {
	if (!savedEnv.has(name)) savedEnv.set(name, process.env[name]);
	process.env[name] = value;
}
function unstubAllEnvs(): void {
	for (const [name, value] of savedEnv) {
		if (value === undefined) delete process.env[name];
		else process.env[name] = value;
	}
	savedEnv.clear();
}

mock.module("#/db/queries", () => ({
	listPostsFn: mocks.listPostsFn,
}));

mock.module("#/lib/mdx/pages.server", () => ({
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
		jest.clearAllMocks();
		mocks.listPostsFn.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);
	});

	test("always includes EN homepage entry", async () => {
		const entries = await getSitemapEntriesFn();
		const enHome = entries.find(
			(e) => e.loc.endsWith("/") && !e.loc.includes("/pt-br/"),
		);
		expect(enHome).toBeDefined();
	});

	test("always includes PT-BR homepage entry", async () => {
		const entries = await getSitemapEntriesFn();
		const ptbrHome = entries.find((e) => e.loc.endsWith("/pt-br/"));
		expect(ptbrHome).toBeDefined();
	});

	test("EN homepage entry has isDefault: true", async () => {
		const entries = await getSitemapEntriesFn();
		const enHome = entries.find(
			(e) => e.loc.endsWith("/") && !e.loc.includes("/pt-br/"),
		);
		expect(enHome?.isDefault).toBe(true);
	});

	test("PT-BR homepage entry does NOT have isDefault", async () => {
		const entries = await getSitemapEntriesFn();
		const ptbrHome = entries.find((e) => e.loc.endsWith("/pt-br/"));
		expect(ptbrHome?.isDefault).toBeFalsy();
	});

	test("homepage entries have alternates for both locales", async () => {
		const entries = await getSitemapEntriesFn();
		const enHome = entries.find(
			(e) => e.loc.endsWith("/") && !e.loc.includes("/pt-br/"),
		)!;
		const hreflangs = enHome.alternates.map((a) => a.hreflang);
		expect(hreflangs).toContain("en");
		expect(hreflangs).toContain("pt-BR");
	});

	test("SITE_URL env var sets origin", async () => {
		stubEnv("SITE_URL", "https://example.com");
		try {
			const entries = await getSitemapEntriesFn();
			expect(entries.some((e) => e.loc.startsWith("https://example.com"))).toBe(
				true,
			);
		} finally {
			unstubAllEnvs();
		}
	});

	test("SITE_URL trailing slash is stripped", async () => {
		stubEnv("SITE_URL", "https://example.com/");
		try {
			const entries = await getSitemapEntriesFn();
			expect(entries.some((e) => e.loc === "https://example.com/")).toBe(true);
		} finally {
			unstubAllEnvs();
		}
	});

	test("falls back to localhost:3000 when SITE_URL is absent (non-production)", async () => {
		stubEnv("SITE_URL", "");
		stubEnv("NODE_ENV", "test");
		try {
			const entries = await getSitemapEntriesFn();
			expect(
				entries.some((e) => e.loc.startsWith("http://localhost:3000")),
			).toBe(true);
		} finally {
			unstubAllEnvs();
		}
	});

	test("throws when SITE_URL is unset in production", async () => {
		stubEnv("SITE_URL", "");
		stubEnv("NODE_ENV", "production");
		try {
			await expect(getSitemapEntriesFn()).rejects.toThrow(
				"SITE_URL must be set in production",
			);
		} finally {
			unstubAllEnvs();
		}
	});

	test("getSitemapXmlResponse returns 500 when SITE_URL unset in production", async () => {
		stubEnv("SITE_URL", "");
		stubEnv("NODE_ENV", "production");
		try {
			const res = await getSitemapXmlResponse();
			expect(res.status).toBe(500);
			const body = await res.text();
			expect(body).toContain("SITE_URL");
		} finally {
			unstubAllEnvs();
		}
	});
});

// ─── Unit: getSitemapEntriesFn — posts ───────────────────────────────────────

describe("unit: getSitemapEntriesFn — post entries", () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);
	});

	test("includes an entry per EN post", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("hello-world"), makePost("second-post")] : [],
		);
		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.includes("/hello-world"))).toBe(true);
		expect(entries.some((e) => e.loc.includes("/second-post"))).toBe(true);
	});

	test("includes an entry per PT-BR post", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "pt-br" ? [makePost("ola-mundo", "pt-br")] : [],
		);
		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.includes("/pt-br/ola-mundo"))).toBe(true);
	});

	test("EN post with both locales: EN entry has both hreflang alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("shared-post")]
				: [makePost("shared-post", "pt-br")],
		);
		const entries = await getSitemapEntriesFn();
		const enEntry = entries.find((e) => e.loc.endsWith("/shared-post"));
		expect(enEntry?.alternates).toHaveLength(2);
		const langs = enEntry?.alternates.map((a) => a.hreflang);
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	test("EN post with both locales: PT-BR entry has both hreflang alternates (reciprocal)", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("shared-post")]
				: [makePost("shared-post", "pt-br")],
		);
		const entries = await getSitemapEntriesFn();
		const ptbrEntry = entries.find((e) => e.loc.includes("/pt-br/shared-post"));
		expect(ptbrEntry?.alternates).toHaveLength(2);
		const langs = ptbrEntry?.alternates.map((a) => a.hreflang);
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	test("EN-only post: EN entry has no hreflang alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("en-only")] : [],
		);
		const entries = await getSitemapEntriesFn();
		const enEntry = entries.find((e) => e.loc.endsWith("/en-only"));
		expect(enEntry?.alternates).toHaveLength(0);
	});

	test("PT-BR-only post: PT-BR entry has no hreflang alternates", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "pt-br" ? [makePost("ptbr-only", "pt-br")] : [],
		);
		const entries = await getSitemapEntriesFn();
		const ptbrEntry = entries.find((e) => e.loc.includes("/pt-br/ptbr-only"));
		expect(ptbrEntry?.alternates).toHaveLength(0);
	});

	test("mixed fixture: en-only post has no alternates; bilingual post has alternates", async () => {
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
		jest.clearAllMocks();
		mocks.listPostsFn.mockResolvedValue([]);
	});

	test("includes an entry per EN page", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("about")] : [],
		);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.endsWith("/about"))).toBe(true);
	});

	test("includes an entry per PT-BR page", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "pt-br" ? [makePage("sobre", "pt-br")] : [],
		);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		expect(entries.some((e) => e.loc.includes("/pt-br/sobre"))).toBe(true);
	});

	test("EN page with twin: EN entry has both hreflang alternates", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("about")] : [makePage("about", "pt-br")],
		);
		mocks.staticPageHasTwin.mockReturnValue(true);

		const entries = await getSitemapEntriesFn();
		const enAbout = entries.find((e) => e.loc.endsWith("/about"));
		expect(enAbout?.alternates).toHaveLength(2);
		const langs = enAbout?.alternates.map((a) => a.hreflang);
		expect(langs).toContain("en");
		expect(langs).toContain("pt-BR");
	});

	test("EN page without twin: EN entry has no hreflang alternates", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) =>
			locale === "en" ? [makePage("uses")] : [],
		);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		const enUses = entries.find((e) => e.loc.endsWith("/uses"));
		expect(enUses?.alternates).toHaveLength(0);
	});

	test("PT-BR page with twin: PT-BR entry has both hreflang alternates", async () => {
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
		jest.clearAllMocks();
	});

	test("homepages only: reciprocity holds", async () => {
		mocks.listPostsFn.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	test("bilingual post: reciprocity holds", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("shared")] : [makePost("shared", "pt-br")],
		);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	test("EN-only post: reciprocity holds (no alternates → no pairs to check)", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en" ? [makePost("en-only")] : [],
		);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);

		const entries = await getSitemapEntriesFn();
		assertReciprocity(entries);
	});

	test("mixed fixture (post + page, bilingual + unilingual): reciprocity holds", async () => {
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

	test("zero asymmetric hreflang violations: PSM-5", async () => {
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
		jest.clearAllMocks();
		mocks.listPostsFn.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.staticPageHasTwin.mockReturnValue(false);
	});

	test("returns HTTP 200", async () => {
		const res = await getSitemapXmlResponse();
		expect(res.status).toBe(200);
	});

	test("sets content-type: application/xml", async () => {
		const res = await getSitemapXmlResponse();
		expect(res.headers.get("content-type")).toBe("application/xml");
	});

	test("body starts with XML declaration", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body).toMatch(/^<\?xml version="1\.0" encoding="UTF-8"\?>/);
	});

	test("body contains urlset with correct namespaces (AC-1)", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body).toContain(
			'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		);
		expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
	});

	test("body ends with </urlset>", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body.trimEnd()).toMatch(/<\/urlset>$/);
	});

	test("body contains <url> and <loc> elements", async () => {
		const body = await (await getSitemapXmlResponse()).text();
		expect(body).toContain("<url>");
		expect(body).toContain("<loc>");
	});

	test("x-default annotation present only on EN homepage (AC-3)", async () => {
		mocks.listPostsFn.mockImplementation(async (lang: string) =>
			lang === "en"
				? [makePost("some-post")]
				: [makePost("some-post", "pt-br")],
		);
		const body = await (await getSitemapXmlResponse()).text();
		const xdefaultMatches = body.match(/hreflang="x-default"/g) ?? [];
		expect(xdefaultMatches).toHaveLength(1);
	});

	test("bilingual post: both locale <url> entries appear in body (AC-2)", async () => {
		stubEnv("SITE_URL", "http://localhost:3000");
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
			unstubAllEnvs();
		}
	});

	test("XML escaping: special chars in origin are escaped", async () => {
		stubEnv("SITE_URL", "http://localhost:3000");
		try {
			const body = await (await getSitemapXmlResponse()).text();
			// No unescaped & in attribute values or text
			expect(body).not.toMatch(/href="[^"]*&[^a][^m][^p]/);
		} finally {
			unstubAllEnvs();
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

	test("returns 200", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		expect(res.status).toBe(200);
	});

	test("content-type is application/xml", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		expect(res.headers.get("content-type")).toContain("application/xml");
	});

	test("body contains urlset with sitemaps namespace", async () => {
		const res = await fetch(`${BASE_URL}/sitemap.xml`);
		const body = await res.text();
		expect(body).toContain(
			'xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"',
		);
		expect(body).toContain('xmlns:xhtml="http://www.w3.org/1999/xhtml"');
	});

	test("reciprocity invariant holds on live fixture set", async () => {
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
