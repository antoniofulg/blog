import { notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { Post } from "#/db/schema";
import { LOCALES, type Locale } from "#/lib/locale";
import type { PageEntry } from "#/lib/mdx/pages.server";

export type PostLoaderResult = {
	kind: "post";
	post: Post;
	html: string;
	requestedLang: Locale;
	notTranslated: boolean;
	availableLang: Locale | null;
	alternateLang: Locale | null;
};

export type PageLoaderResult = {
	kind: "page";
	entry: PageEntry;
	html: string;
	requestedLang: Locale;
	hasTwin: boolean;
};

export type SlugLoaderResult = PostLoaderResult | PageLoaderResult;

export async function getPostBySlugWithLangFn(
	slug: string,
	requestedLang: Locale,
	// biome-ignore lint/suspicious/noExplicitAny: renderMdx injected by handler (server) or mock (tests)
	renderFn: (body: string) => Promise<any> = async () => () => null,
): Promise<SlugLoaderResult> {
	const [
		{ readFile },
		{ and, eq, sql },
		{ createElement },
		{ renderToStaticMarkup },
		{ db },
		{ posts },
		{ default: matter },
	] = await Promise.all([
		import("node:fs/promises"),
		import("drizzle-orm"),
		import("react"),
		import("react-dom/server"),
		import("#/db/client"),
		import("#/db/schema"),
		import("gray-matter"),
	]);
	const [exactPost] = await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.slug, slug),
				eq(posts.lang, requestedLang),
				sql`${posts.draft} IS NOT TRUE`,
			),
		);

	// Read the post's MDX file; on ENOENT (stale DB row pointing at a moved/deleted
	// file) fall through to the next lookup branch instead of crashing the route.
	async function safeReadMdx(filePath: string): Promise<string | null> {
		try {
			return await readFile(filePath, "utf-8");
		} catch (err) {
			const code = (err as NodeJS.ErrnoException).code;
			if (code === "ENOENT") return null;
			throw err;
		}
	}

	if (exactPost) {
		const source = await safeReadMdx(exactPost.filePath);
		if (source !== null) {
			// renderMdx expects a frontmatter-stripped body; strip here so the
			// renderer stays pure and doesn't double-parse callers that already
			// pass body (e.g. loadStaticPage).
			const { content: body } = matter(source);
			const Content = await renderFn(body);
			const html = renderToStaticMarkup(createElement(Content, {}));

			const otherLang: Locale = requestedLang === "en" ? "pt-br" : "en";
			const [altPost] = await db
				.select()
				.from(posts)
				.where(
					and(
						eq(posts.slug, slug),
						eq(posts.lang, otherLang),
						sql`${posts.draft} IS NOT TRUE`,
					),
				);

			return {
				kind: "post",
				post: exactPost,
				html,
				requestedLang,
				notTranslated: false,
				availableLang: null,
				alternateLang: altPost ? otherLang : null,
			};
		}
		// Stale DB row — drop through to fallback / page lookup.
	}

	const [fallbackPost] = await db
		.select()
		.from(posts)
		.where(and(eq(posts.slug, slug), sql`${posts.draft} IS NOT TRUE`));

	if (fallbackPost) {
		const source = await safeReadMdx(fallbackPost.filePath);
		if (source !== null) {
			const { content: body } = matter(source);
			const Content = await renderFn(body);
			const html = renderToStaticMarkup(createElement(Content, {}));
			return {
				kind: "post",
				post: fallbackPost,
				html,
				requestedLang,
				notTranslated: true,
				availableLang: fallbackPost.lang as Locale,
				alternateLang: null,
			};
		}
		// Stale DB row — drop through to static-page lookup.
	}

	const { loadStaticPage, staticPageHasTwin } = await import(
		"#/lib/mdx/pages.server"
	);
	const page = await loadStaticPage(slug, requestedLang);
	if (page) {
		const otherLang: Locale = requestedLang === "en" ? "pt-br" : "en";
		const hasTwin = staticPageHasTwin(slug, otherLang);
		return {
			kind: "page",
			entry: page.entry,
			html: page.html,
			requestedLang,
			hasTwin,
		};
	}

	throw notFound();
}

export async function incrementViewCountFn(id: number): Promise<void> {
	const [{ db }, { posts }, { eq, sql }] = await Promise.all([
		import("#/db/client"),
		import("#/db/schema"),
		import("drizzle-orm"),
	]);
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
