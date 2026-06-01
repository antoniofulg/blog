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
	/** Absolute URL of the OG image resolved via coverImage → auto-PNG → fallback. */
	ogImagePath: string;
};

export type PageLoaderResult = {
	kind: "page";
	entry: PageEntry;
	html: string;
	requestedLang: Locale;
	hasTwin: boolean;
};

export type SlugLoaderResult = PostLoaderResult | PageLoaderResult;

/** Narrows an unknown frontmatter value to a non-empty string or `undefined`. */
function normalizeCoverImage(raw: unknown): string | undefined {
	return typeof raw === "string" && raw.length > 0 ? raw : undefined;
}

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
		{ resolveOgImagePath },
		{ getSiteOrigin },
	] = await Promise.all([
		import("node:fs/promises"),
		import("drizzle-orm"),
		import("react"),
		import("react-dom/server"),
		import("#/db/client"),
		import("#/db/schema"),
		import("gray-matter"),
		import("#/lib/og/resolve.server"),
		import("#/lib/site-origin"),
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
			const { content: body, data: frontmatterData } = matter(source);
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

			const ogImagePath = resolveOgImagePath({
				coverImage: normalizeCoverImage(frontmatterData.coverImage),
				locale: requestedLang,
				slug,
				origin: getSiteOrigin(),
			});

			return {
				kind: "post",
				post: exactPost,
				html,
				requestedLang,
				notTranslated: false,
				availableLang: null,
				alternateLang: altPost ? otherLang : null,
				ogImagePath,
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
			const { content: body, data: frontmatterData } = matter(source);
			const Content = await renderFn(body);
			const html = renderToStaticMarkup(createElement(Content, {}));

			const fallbackLang = fallbackPost.lang as Locale;
			const ogImagePath = resolveOgImagePath({
				coverImage: normalizeCoverImage(frontmatterData.coverImage),
				locale: fallbackLang,
				slug,
				origin: getSiteOrigin(),
			});

			return {
				kind: "post",
				post: fallbackPost,
				html,
				requestedLang,
				notTranslated: true,
				availableLang: fallbackLang,
				alternateLang: null,
				ogImagePath,
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

export type IncrementViewCountInput = {
	id: number;
	/**
	 * Client-reported `document.referrer` at the moment the post mounted.
	 * `null` when the navigation had no referrer (direct visit / fresh tab).
	 * Override the request's `Referer` header because the browser sets that
	 * header to the current post URL on same-origin server-fn fetches, which
	 * loses the original upstream source.
	 */
	referrer: string | null;
	/**
	 * Value of the `utm_source` query param on the post URL at the moment
	 * the page mounted. Forwarded so the server can prefer it over the
	 * `Referer` fallback — share-intent redirects (wa.me, twitter intent,
	 * etc.) routinely strip the referrer, leaving the UTM as the only
	 * surviving attribution signal. `null` when the param is absent.
	 */
	utmSource: string | null;
};

export async function incrementViewCountFn(
	input: IncrementViewCountInput,
): Promise<void> {
	const { id, referrer, utmSource } = input;

	// Gate on bot check first — no DB I/O for bot requests.
	const [{ getRequest }, { isBotUserAgent }] = await Promise.all([
		import("@tanstack/react-start/server"),
		import("#/lib/analytics/bot-filter"),
	]);

	const request = getRequest();

	if (isBotUserAgent(request.headers.get("User-Agent"))) return;

	// Read lang server-side so the client only forwards `{ id, referrer }`.
	const [{ db }, { posts }, { eq }] = await Promise.all([
		import("#/db/client"),
		import("#/db/schema"),
		import("drizzle-orm"),
	]);

	const [post] = await db
		.select({ lang: posts.lang })
		.from(posts)
		.where(eq(posts.id, id));

	if (!post) return;

	const lang = post.lang as "en" | "pt-br";

	const { recordPostView } = await import(
		"#/lib/analytics/record-event.server"
	);
	await recordPostView({ postId: id, request, lang, referrer, utmSource });
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
	.inputValidator((input: IncrementViewCountInput) => {
		if (
			typeof input?.id !== "number" ||
			!Number.isInteger(input.id) ||
			input.id <= 0
		) {
			throw new Error("incrementViewCount: id must be a positive integer");
		}
		const cap = (s: string | null, max: number): string | null =>
			typeof s === "string" && s.length > 0 ? s.slice(0, max) : null;
		const referrer = cap(input.referrer, 2048);
		const utmSource = cap(input.utmSource, 64);
		return { id: input.id, referrer, utmSource };
	})
	.handler(async ({ data }) => incrementViewCountFn(data));
