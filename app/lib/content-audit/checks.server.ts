import "@tanstack/react-start/server-only";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import matter from "gray-matter";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";
import { extractLinks } from "#/lib/content-audit/link-parser.server";
import { LOCALES, type Locale } from "#/lib/locale";
import { enumerateStaticPages, type PageEntry } from "#/lib/mdx/pages.server";
import type { PostEntry } from "#/lib/site-model.server";
import { getPostInventory, getRouteInventory } from "#/lib/site-model.server";

export type Severity = "blocker" | "major" | "minor";

export type FindingCategory =
	| "frontmatter-invalid"
	| "translation-gap"
	| "broken-link"
	| "missing-alt-text"
	| "series-gap"
	| "slug-collision";

export type Finding = {
	category: FindingCategory;
	severity: Severity;
	filePath: string;
	line?: number;
	message: string;
	detail?: Record<string, string | number>;
};

const EXTERNAL_PREFIXES = ["http://", "https://", "//", "mailto:"];

function isExternalOrRelative(href: string): boolean {
	return (
		href.startsWith("#") ||
		EXTERNAL_PREFIXES.some((p) => href.startsWith(p)) ||
		!href.startsWith("/")
	);
}

function stripFragment(href: string): string {
	const idx = href.indexOf("#");
	return idx === -1 ? href : href.slice(0, idx);
}

const LOCALE_PREFIXES = LOCALES.map((l) => `/${l}/`);

function extractSlugFromPath(path: string): string {
	for (const prefix of LOCALE_PREFIXES) {
		if (path.startsWith(prefix)) return path.slice(prefix.length);
	}
	return path.startsWith("/") ? path.slice(1) : path;
}

async function findMdxFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	async function walk(current: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true }).catch(
			() => null,
		);
		if (!entries) return;
		for (const entry of entries) {
			const full = join(current, entry.name as string);
			if (entry.isDirectory()) {
				await walk(full);
			} else if ((entry.name as string).endsWith(".mdx")) {
				results.push(full);
			}
		}
	}
	try {
		await walk(dir);
	} catch {
		// content dir may not exist
	}
	return results;
}

export async function checkFrontmatter(
	filePaths: string[],
): Promise<Finding[]> {
	const findings: Finding[] = [];
	for (const filePath of filePaths) {
		try {
			const source = await readFile(filePath, "utf-8");
			const { data } = matter(source);
			if (
				!data.title ||
				(typeof data.title === "string" && data.title.trim() === "")
			) {
				findings.push({
					category: "frontmatter-invalid",
					severity: "blocker",
					filePath,
					message: "Missing required frontmatter field: title",
				});
			}
		} catch (err) {
			findings.push({
				category: "frontmatter-invalid",
				severity: "blocker",
				filePath,
				message: `Failed to parse frontmatter: ${err instanceof Error ? err.message : String(err)}`,
			});
		}
	}
	return findings;
}

export function checkTranslationGaps(posts: PostEntry[]): Finding[] {
	const findings: Finding[] = [];
	for (const post of posts) {
		if (post.frontmatter.noTranslation) continue;
		if (!post.hasTwin) {
			findings.push({
				category: "translation-gap",
				severity: "major",
				filePath: post.filePath,
				message: `Post "${post.slug}" (${post.lang}) has no translation twin. Add the translation or set noTranslation: true in frontmatter.`,
			});
		}
	}
	return findings;
}

export async function checkBrokenLinks(
	posts: PostEntry[],
	knownSlugs: Set<string>,
	knownPaths: Set<string>,
): Promise<Finding[]> {
	const findings: Finding[] = [];
	for (const post of posts) {
		const links = await extractLinks(post.filePath);
		for (const link of links) {
			if (link.kind === "skipped-dynamic") {
				findings.push({
					category: "broken-link",
					severity: "minor",
					filePath: post.filePath,
					line: link.line,
					message: `Dynamic href expression at line ${link.line} could not be statically resolved and was not validated.`,
					detail: { href: "(dynamic)" },
				});
				continue;
			}
			if (isExternalOrRelative(link.href)) continue;
			const path = stripFragment(link.href);
			if (!path) continue;
			const slug = extractSlugFromPath(path);
			const isKnown =
				knownPaths.has(path) || (slug.length > 0 && knownSlugs.has(slug));
			if (!isKnown) {
				findings.push({
					category: "broken-link",
					severity: !post.frontmatter.draft ? "blocker" : "minor",
					filePath: post.filePath,
					line: link.line,
					message: `Broken internal link: ${link.href}`,
					detail: { href: link.href },
				});
			}
		}
	}
	return findings;
}

export async function checkMissingAltText(
	posts: PostEntry[],
): Promise<Finding[]> {
	const findings: Finding[] = [];
	for (const post of posts) {
		const content = await readFile(post.filePath, "utf-8");
		const processor = unified().use(remarkParse).use(remarkMdx);
		const tree = processor.parse(content);
		visit(tree, "image", (node) => {
			const img = node as {
				alt?: string;
				url: string;
				position?: { start: { line: number } };
			};
			if (!img.alt || img.alt.trim() === "") {
				findings.push({
					category: "missing-alt-text",
					severity: "major",
					filePath: post.filePath,
					line: img.position?.start.line,
					message: `Image at "${img.url}" missing alt text.`,
				});
			}
		});
	}
	return findings;
}

export function checkSeriesGaps(posts: PostEntry[]): Finding[] {
	const findings: Finding[] = [];

	type SeriesEntry = { part: number; filePath: string };
	const seriesMap = new Map<string, SeriesEntry[]>();

	for (const post of posts) {
		if (post.frontmatter.draft) continue;
		const { series, seriesPart } = post.frontmatter;
		if (!series || seriesPart == null) continue;
		if (!seriesMap.has(series)) seriesMap.set(series, []);
		seriesMap.get(series)?.push({ part: seriesPart, filePath: post.filePath });
	}

	for (const [seriesName, entries] of seriesMap) {
		const sorted = [...entries].sort((a, b) => a.part - b.part);
		const parts = sorted.map((e) => e.part);
		const partsSet = new Set(parts);
		const maxPart = parts[parts.length - 1];

		for (let expected = 1; expected < maxPart; expected++) {
			if (!partsSet.has(expected)) {
				findings.push({
					category: "series-gap",
					severity: "minor",
					filePath: sorted[0].filePath,
					message: `Series "${seriesName}" has parts [${parts.join(", ")}]; part ${expected} missing or unpublished.`,
					detail: { series: seriesName, expectedPart: expected },
				});
			}
		}
	}

	return findings;
}

export function checkPageTranslationGaps(
	pagesByLocale: Partial<Record<Locale, PageEntry[]>>,
): Finding[] {
	const findings: Finding[] = [];
	const enPages = pagesByLocale["en"] ?? [];
	const ptBrSlugs = new Set((pagesByLocale["pt-br"] ?? []).map((p) => p.slug));

	for (const page of enPages) {
		if (!ptBrSlugs.has(page.slug)) {
			findings.push({
				category: "translation-gap",
				severity: "major",
				filePath: page.filePath,
				message: `Page "${page.slug}" (en) has no translation twin. Add the translation at app/content/pages/pt-br/${page.slug}.mdx.`,
			});
		}
	}
	return findings;
}

export function checkSlugCollisions(
	posts: PostEntry[],
	pagesByLocale: Partial<Record<Locale, PageEntry[]>>,
): Finding[] {
	const findings: Finding[] = [];

	for (const locale of LOCALES) {
		const postSlugs = new Set(
			posts.filter((p) => p.lang === locale).map((p) => p.slug),
		);
		const pagesForLocale = pagesByLocale[locale] ?? [];

		for (const page of pagesForLocale) {
			if (postSlugs.has(page.slug)) {
				findings.push({
					category: "slug-collision",
					severity: "major",
					filePath: page.filePath,
					message: `Slug "${page.slug}" (${locale}) is used by both a static page and a post. The post wins at runtime (ADR-005); rename the page or post to resolve the shadow.`,
					detail: { slug: page.slug, locale },
				});
			}
		}
	}
	return findings;
}

export async function runContentAudit(contentDir?: string): Promise<Finding[]> {
	const dir = contentDir ?? join(process.cwd(), "app", "content", "posts");
	const allFilePaths = await findMdxFiles(dir);

	const posts = await getPostInventory();
	const routes = await getRouteInventory();

	const knownSlugs = new Set(posts.map((p) => p.slug));
	const knownPaths = new Set(
		routes.map((r) => r.path).filter((p) => !p.includes(":")),
	);

	const pagesByLocale: Partial<Record<Locale, PageEntry[]>> = {};
	for (const locale of LOCALES) {
		pagesByLocale[locale] = await enumerateStaticPages(locale);
	}

	const findings: Finding[] = [];

	findings.push(...(await checkFrontmatter(allFilePaths)));
	findings.push(...checkTranslationGaps(posts));
	findings.push(...(await checkBrokenLinks(posts, knownSlugs, knownPaths)));
	findings.push(...(await checkMissingAltText(posts)));
	findings.push(...checkSeriesGaps(posts));
	findings.push(...checkPageTranslationGaps(pagesByLocale));
	findings.push(...checkSlugCollisions(posts, pagesByLocale));

	return findings;
}
