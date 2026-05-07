import { readFile } from "node:fs/promises";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { and, eq, sql } from "drizzle-orm";
import { createElement, useEffect } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TranslationNotice } from "#/components/ui/translation-notice";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";
import type { Locale } from "#/lib/locale";

type PostLoaderResult = {
	post: Post;
	html: string;
	requestedLang: Locale;
	notTranslated: boolean;
	availableLang: Locale | null;
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
		return {
			post: exactPost,
			html,
			requestedLang,
			notTranslated: false,
			availableLang: null,
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
	};
}

export async function incrementViewCountFn(id: number): Promise<void> {
	await db
		.update(posts)
		.set({ viewCount: sql`view_count + 1` })
		.where(eq(posts.id, id));
}

const getPostBySlugWithLang = createServerFn({ method: "GET" })
	.inputValidator((data: { slug: string; lang: Locale }) => data)
	.handler(async ({ data: { slug, lang } }) => {
		const { renderMdx } = await import("#/lib/mdx/renderer.server");
		return getPostBySlugWithLangFn(slug, lang, renderMdx);
	});

const incrementViewCount = createServerFn({ method: "POST" })
	.inputValidator((id: number) => id)
	.handler(async ({ data: id }) => incrementViewCountFn(id));

export const Route = createFileRoute("/$lang/$slug")({
	loader: async ({ params }) => {
		return getPostBySlugWithLang({
			data: { slug: params.slug, lang: params.lang as Locale },
		});
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: loaderData?.post?.title ?? "Blog" },
			...(loaderData?.post?.description
				? [{ name: "description", content: loaderData.post.description }]
				: []),
			...(loaderData?.post?.title
				? [{ property: "og:title", content: loaderData.post.title }]
				: []),
			...(loaderData?.post?.description
				? [
						{
							property: "og:description",
							content: loaderData.post.description,
						},
					]
				: []),
		],
	}),
	component: LocalePostDetail,
	notFoundComponent: () => (
		<main>
			<h1>Post not found</h1>
		</main>
	),
});

function LocalePostDetail() {
	const { post, html, notTranslated, requestedLang, availableLang } =
		Route.useLoaderData();
	useEffect(() => {
		incrementViewCount({ data: post.id });
	}, [post.id]);
	return (
		<div className="px-5 py-12 lg:px-20">
			<article className="mx-auto max-w-3xl">
				{notTranslated && availableLang && (
					<div className="mb-6">
						<TranslationNotice
							requestedLang={requestedLang}
							availableLang={availableLang}
						/>
					</div>
				)}
				<header className="mb-8 flex flex-col gap-4">
					{post.publishedAt && (
						<time
							dateTime={new Date(post.publishedAt).toISOString()}
							className="text-sm text-foreground-muted"
						>
							{new Date(post.publishedAt).toLocaleDateString("pt-BR", {
								day: "numeric",
								month: "long",
								year: "numeric",
							})}
						</time>
					)}
					<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
						{post.title}
					</h1>
					{post.description && (
						<p className="text-lg leading-relaxed text-foreground-secondary">
							{post.description}
						</p>
					)}
				</header>
				<div
					className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-a:text-accent prose-code:rounded prose-code:bg-code-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foreground-code prose-pre:bg-code-bg prose-pre:text-foreground-code"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</article>
		</div>
	);
}
