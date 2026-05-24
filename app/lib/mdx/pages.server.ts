import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import matter from "gray-matter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import type { Locale } from "#/lib/locale";
import { renderMdx } from "#/lib/mdx/renderer.server";

export const socialKindEnum = z.enum([
	"github",
	"linkedin",
	"x",
	"instagram",
	"rss",
	"email",
]);

export type SocialKind = z.infer<typeof socialKindEnum>;

// Links uses optional string values to allow any subset of enum keys.
// z.record(enumKey, z.string()) in Zod v4 requires ALL enum keys; using
// z.string().optional() as the value type allows partial records while
// still rejecting any key that is not in socialKindEnum.
export const pageFrontmatterSchema = z
	.object({
		title: z.string().min(1),
		description: z.string().optional(),
		avatar: z.string().optional(),
		links: z.record(socialKindEnum, z.string().optional()).optional(),
	})
	.passthrough();

// Strip the index signature added by .passthrough() so that PageFrontmatter
// remains serializable through TanStack Start server functions. Passthrough
// fields (e.g. tagline, nowUpdatedAt) still flow through at runtime — they are
// just not reflected in the exported TypeScript type.
type StripIndex<T> = {
	[K in keyof T as string extends K ? never : K]: T[K];
};
export type PageFrontmatter = StripIndex<z.infer<typeof pageFrontmatterSchema>>;

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
	// pageFrontmatterSchema.parse throws ZodError on invalid frontmatter
	// (e.g. missing title, unrecognized links keys). Error surfaces via the
	// existing route-level error boundary.
	const frontmatter = pageFrontmatterSchema.parse(data);

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
			const parsed = pageFrontmatterSchema.safeParse(data);
			if (!parsed.success) continue;
			entries.push({
				slug,
				locale,
				filePath,
				frontmatter: parsed.data,
			});
		} catch {
			// skip unreadable or malformed files
		}
	}

	return entries;
}
