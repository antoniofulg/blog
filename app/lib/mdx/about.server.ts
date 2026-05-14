import { readFile } from "node:fs/promises";
import matter from "gray-matter";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { z } from "zod";
import { DEFAULT_LOCALE, type Locale } from "#/lib/locale";
import { renderMdx } from "#/lib/mdx/renderer.server";

const linkSchema = z.object({
	label: z.string(),
	url: z.string().url(),
	kind: z.enum(["github", "linkedin", "email", "other"]),
});

export const aboutFrontmatterSchema = z.object({
	title: z.string(),
	locale: z.enum(["en", "pt-br"]),
	links: z.array(linkSchema).optional().default([]),
});

export type AboutFrontmatter = z.infer<typeof aboutFrontmatterSchema>;

export type AboutContent = {
	frontmatter: AboutFrontmatter;
	html: string;
	locale: Locale;
	fallbackLocale?: Locale;
};

function contentPath(locale: Locale): string {
	return `content/${locale}/about.mdx`;
}

export async function loadAbout(locale: Locale): Promise<AboutContent> {
	let source: string;
	let actualLocale = locale;
	let fallbackLocale: Locale | undefined;

	try {
		source = await readFile(contentPath(locale), "utf-8");
	} catch {
		if (locale === DEFAULT_LOCALE) {
			throw new Error(
				`about_load_failed: content/${DEFAULT_LOCALE}/about.mdx not found`,
			);
		}
		source = await readFile(contentPath(DEFAULT_LOCALE), "utf-8");
		actualLocale = DEFAULT_LOCALE;
		fallbackLocale = DEFAULT_LOCALE;
	}

	const { data, content: body } = matter(source);
	const frontmatter = aboutFrontmatterSchema.parse(data);
	const Content = await renderMdx(body);
	const html = renderToStaticMarkup(createElement(Content, {}));

	return {
		frontmatter,
		html,
		locale: actualLocale,
		...(fallbackLocale !== undefined ? { fallbackLocale } : {}),
	};
}
