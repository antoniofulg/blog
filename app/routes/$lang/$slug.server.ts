import { readFile } from "node:fs/promises";
import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";
import { LOCALES, type Locale } from "#/lib/locale";

export type PostLoaderResult = {
	post: Post;
	html: string;
	requestedLang: Locale;
	notTranslated: boolean;
	availableLang: Locale | null;
	alternateLang: Locale | null;
};

export async function getPostBySlugWithLangFn(
	slug: string,
	requestedLang: Locale,
	// biome-ignore lint/suspicious/noExplicitAny: renderMdx injected by handler (server) or mock (tests)
	renderFn: (source: string) => Promise<any> = async () => () => null,
): Promise<PostLoaderResult> {
	const [exactPost] = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.slug, slug),
				eq(posts.lang, requestedLang),
				eq(posts.isPublished, true),
			),
		);

	if (exactPost) {
		const source = await readFile(exactPost.filePath, "utf-8");
		const Content = await renderFn(source);
		const html = renderToStaticMarkup(createElement(Content, {}));

		const otherLang: Locale = requestedLang === "en" ? "pt-br" : "en";
		const [altPost] = await db
			.select()
			.from(posts)
			.where(
				and(
					eq(posts.slug, slug),
					eq(posts.lang, otherLang),
					eq(posts.isPublished, true),
				),
			);

		return {
			post: exactPost,
			html,
			requestedLang,
			notTranslated: false,
			availableLang: null,
			alternateLang: altPost ? otherLang : null,
		};
	}

	const [fallbackPost] = await db
		.select()
		.from(posts)
		.where(and(eq(posts.slug, slug), eq(posts.isPublished, true)));

	if (!fallbackPost) {
		throw notFound();
	}

	const source = await readFile(fallbackPost.filePath, "utf-8");
	const Content = await renderFn(source);
	const html = renderToStaticMarkup(createElement(Content, {}));
	return {
		post: fallbackPost,
		html,
		requestedLang,
		notTranslated: true,
		availableLang: fallbackPost.lang as Locale,
		alternateLang: null,
	};
}

export async function incrementViewCountFn(id: number): Promise<void> {
	await db
		.update(posts)
		.set({ viewCount: sql`view_count + 1` })
		.where(eq(posts.id, id));
}

export function validateLocaleInput(data: { slug: string; lang: string }): {
	slug: string;
	lang: Locale;
} {
	if (!(LOCALES as readonly string[]).includes(data.lang)) {
		throw new Error(
			`Invalid locale: "${data.lang}". Expected one of: ${LOCALES.join(", ")}`,
		);
	}
	return { slug: data.slug, lang: data.lang as Locale };
}

export const getPostBySlugWithLang = createServerFn({ method: "GET" })
	.inputValidator(validateLocaleInput)
	.handler(async ({ data: { slug, lang } }) => {
		const { renderMdx } = await import("#/lib/mdx/renderer.server");
		return getPostBySlugWithLangFn(slug, lang, renderMdx);
	});

export const incrementViewCount = createServerFn({ method: "POST" })
	.inputValidator((id: number) => id)
	.handler(async ({ data: id }) => incrementViewCountFn(id));
