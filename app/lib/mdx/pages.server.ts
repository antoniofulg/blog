import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import matter from "gray-matter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Locale } from "#/lib/locale";
import { renderMdx } from "#/lib/mdx/renderer.server";

export type PageFrontmatter = {
	title: string;
	description?: string;
};

export type PageEntry = {
	slug: string;
	locale: Locale;
	filePath: string;
	frontmatter: PageFrontmatter;
};

// Slugs containing .., /, \, or null bytes are rejected as unsafe path components.
// If this corpus grows past ~5 pages or needs queryable metadata, see ADR-001 promotion trigger.
const UNSAFE_SLUG_RE = /\.\.|[/\\]/;

function hasNullByte(slug: string): boolean {
	for (let i = 0; i < slug.length; i++) {
		if (slug.charCodeAt(i) === 0) return true;
	}
	return false;
}

function isSafeSlug(slug: string): boolean {
	return !UNSAFE_SLUG_RE.test(slug) && !hasNullByte(slug);
}

function pagesContentDir(locale: Locale): string {
	return join(process.cwd(), "app", "content", "pages", locale);
}

function pageFilePath(slug: string, locale: Locale): string {
	return join(pagesContentDir(locale), `${slug}.mdx`);
}

export async function loadStaticPage(
	slug: string,
	locale: Locale,
): Promise<{ entry: PageEntry; html: string } | null> {
	if (!isSafeSlug(slug)) return null;

	const filePath = pageFilePath(slug, locale);
	let source: string;
	try {
		source = await readFile(filePath, "utf-8");
	} catch {
		return null;
	}

	const { data, content: body } = matter(source);
	if (!data.title) {
		throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
	}
	const frontmatter: PageFrontmatter = {
		title: data.title as string,
		...(data.description !== undefined
			? { description: data.description as string }
			: {}),
	};

	const Content = await renderMdx(body);
	const html = renderToStaticMarkup(createElement(Content, {}));

	return {
		entry: { slug, locale, filePath, frontmatter },
		html,
	};
}

export function staticPageHasTwin(slug: string, targetLocale: Locale): boolean {
	if (!isSafeSlug(slug)) return false;
	return existsSync(pageFilePath(slug, targetLocale));
}

export async function enumerateStaticPages(
	locale: Locale,
): Promise<PageEntry[]> {
	const dir = pagesContentDir(locale);
	let names: string[];
	try {
		names = await readdir(dir);
	} catch {
		return [];
	}

	const entries: PageEntry[] = [];
	for (const name of names) {
		if (extname(name) !== ".mdx") continue;
		const slug = basename(name, ".mdx");
		const filePath = join(dir, name);
		try {
			const source = await readFile(filePath, "utf-8");
			const { data } = matter(source);
			if (!data.title) continue;
			entries.push({
				slug,
				locale,
				filePath,
				frontmatter: {
					title: data.title as string,
					...(data.description !== undefined
						? { description: data.description as string }
						: {}),
				},
			});
		} catch {
			// skip unreadable or malformed files
		}
	}

	return entries;
}
