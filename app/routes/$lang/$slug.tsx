import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { TranslationNotice } from "#/components/ui/translation-notice";
import type { Locale } from "#/lib/locale";
import { getPostBySlugWithLang, incrementViewCount } from "./$slug.server";

const dateLocale: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" };

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
		links: loaderData?.alternateLang
			? [
					{
						rel: "alternate",
						hrefLang: loaderData.post.lang,
						href: `/${loaderData.post.lang}/${loaderData.post.slug}`,
					},
					{
						rel: "alternate",
						hrefLang: loaderData.alternateLang,
						href: `/${loaderData.alternateLang}/${loaderData.post.slug}`,
					},
				]
			: [],
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
							{new Date(post.publishedAt).toLocaleDateString(
								dateLocale[requestedLang],
								{
									day: "numeric",
									month: "long",
									year: "numeric",
								},
							)}
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
