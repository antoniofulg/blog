import { listPostsFn } from "#/db/queries";
import { LOCALES, type Locale, localeHref, toBcp47 } from "#/lib/locale";
import {
	enumerateStaticPages,
	staticPageHasTwin,
} from "#/lib/mdx/pages.server";

export type SitemapEntry = {
	loc: string;
	alternates: Array<{ hreflang: string; href: string }>;
	isDefault?: boolean;
};

function escapeXml(str: string): string {
	return str
		.replace(/&/g, "&amp;")
		.replace(/</g, "&lt;")
		.replace(/>/g, "&gt;")
		.replace(/"/g, "&quot;");
}

function renderXml(entries: SitemapEntry[]): string {
	const urlElements = entries.map((entry) => {
		const altLines = [
			...entry.alternates.map(
				({ hreflang, href }) =>
					`    <xhtml:link rel="alternate" hreflang="${escapeXml(hreflang)}" href="${escapeXml(href)}"/>`,
			),
			...(entry.isDefault
				? [
						`    <xhtml:link rel="alternate" hreflang="x-default" href="${escapeXml(entry.loc)}"/>`,
					]
				: []),
		];
		return [
			"  <url>",
			`    <loc>${escapeXml(entry.loc)}</loc>`,
			...altLines,
			"  </url>",
		].join("\n");
	});

	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">',
		...urlElements,
		"</urlset>",
	].join("\n");
}

function getSiteOrigin(): string {
	return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

function buildAlternates(
	origin: string,
	slug?: string,
): Array<{ hreflang: string; href: string }> {
	return LOCALES.map((l: Locale) => ({
		hreflang: toBcp47(l),
		href: `${origin}${localeHref(l, slug)}`,
	}));
}

export async function getSitemapEntriesFn(): Promise<SitemapEntry[]> {
	const origin = getSiteOrigin();
	const entries: SitemapEntry[] = [];

	// Structural: homepages (both locales always exist, EN gets x-default)
	entries.push({
		loc: `${origin}${localeHref("en")}`,
		alternates: buildAlternates(origin),
		isDefault: true,
	});
	entries.push({
		loc: `${origin}${localeHref("pt-br")}`,
		alternates: buildAlternates(origin),
	});

	// Posts: query both locales from DB
	const [enPosts, ptbrPosts] = await Promise.all([
		listPostsFn("en"),
		listPostsFn("pt-br"),
	]);
	const ptbrPostSlugs = new Set(ptbrPosts.map((p) => p.slug));
	const enPostSlugs = new Set(enPosts.map((p) => p.slug));

	for (const post of enPosts) {
		entries.push({
			loc: `${origin}${localeHref("en", post.slug)}`,
			alternates: ptbrPostSlugs.has(post.slug)
				? buildAlternates(origin, post.slug)
				: [],
		});
	}
	for (const post of ptbrPosts) {
		entries.push({
			loc: `${origin}${localeHref("pt-br", post.slug)}`,
			alternates: enPostSlugs.has(post.slug)
				? buildAlternates(origin, post.slug)
				: [],
		});
	}

	// Static pages: enumerate from filesystem (both locales)
	const [enPages, ptbrPages] = await Promise.all([
		enumerateStaticPages("en"),
		enumerateStaticPages("pt-br"),
	]);

	for (const page of enPages) {
		entries.push({
			loc: `${origin}${localeHref("en", page.slug)}`,
			alternates: staticPageHasTwin(page.slug, "pt-br")
				? buildAlternates(origin, page.slug)
				: [],
		});
	}
	for (const page of ptbrPages) {
		entries.push({
			loc: `${origin}${localeHref("pt-br", page.slug)}`,
			alternates: staticPageHasTwin(page.slug, "en")
				? buildAlternates(origin, page.slug)
				: [],
		});
	}

	return entries;
}

export async function getSitemapXmlResponse(): Promise<Response> {
	const entries = await getSitemapEntriesFn();
	const xml = renderXml(entries);
	return new Response(xml, {
		status: 200,
		headers: { "content-type": "application/xml" },
	});
}
