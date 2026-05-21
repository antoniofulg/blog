import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PostFooter } from "#/components/ui/post-footer";
import { PostHeader } from "#/components/ui/post-header";
import { TranslationNotice } from "#/components/ui/translation-notice";
import { DEFAULT_LOCALE, type Locale, localeHref, toBcp47 } from "#/lib/locale";
import { readingTimeMinutes } from "#/lib/reading-time";
import { getPostBySlugWithLang, incrementViewCount } from "./$slug.server";

export const Route = createFileRoute("/{-$locale}/$slug")({
	loader: async ({ params }) => {
		const lang = (params.locale ?? DEFAULT_LOCALE) as Locale;
		return getPostBySlugWithLang({
			data: { slug: params.slug, lang },
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
						hrefLang: toBcp47(loaderData.post.lang as Locale),
						href: localeHref(
							loaderData.post.lang as Locale,
							loaderData.post.slug,
						),
					},
					{
						rel: "alternate",
						hrefLang: toBcp47(loaderData.alternateLang as Locale),
						href: localeHref(
							loaderData.alternateLang as Locale,
							loaderData.post.slug,
						),
					},
				]
			: [],
	}),
	component: LocalePostDetail,
	notFoundComponent: () => {
		const { locale } = Route.useParams();
		const lang = (locale ?? DEFAULT_LOCALE) as Locale;
		const copy = {
			en: "Post not found",
			"pt-br": "Post não encontrado",
		} satisfies Record<Locale, string>;
		const message = copy[lang] ?? copy.en;
		return (
			<main className="px-5 py-24 lg:px-20">
				<div className="mx-auto max-w-3xl">
					<h1 className="font-heading text-3xl font-bold text-foreground">
						{message}
					</h1>
				</div>
			</main>
		);
	},
});

export function LocalePostDetail() {
	const {
		post,
		html,
		notTranslated,
		requestedLang,
		availableLang,
		alternateLang,
	} = Route.useLoaderData();

	useEffect(() => {
		// Session guard prevents repeated increments on refresh or dev reload.
		const key = `viewed-${post.id}`;
		if (sessionStorage.getItem(key)) return;
		sessionStorage.setItem(key, "1");
		incrementViewCount({ data: post.id });
	}, [post.id]);

	const readingTime = useMemo(() => readingTimeMinutes(html), [html]);

	return (
		<div className="px-5 py-16 lg:px-20 lg:py-24">
			<div className="reading-progress" aria-hidden="true" />
			<article
				className="mx-auto max-w-3xl"
				lang={toBcp47(post.lang as Locale)}
				aria-labelledby="post-title"
			>
				{notTranslated && availableLang && (
					<div className="mb-10">
						<TranslationNotice
							requestedLang={requestedLang}
							availableLang={availableLang}
						/>
					</div>
				)}

				<PostHeader
					title={post.title}
					description={post.description}
					publishedAt={post.publishedAt}
					postLang={post.lang as Locale}
					requestedLang={requestedLang}
					slug={post.slug}
					readingTime={readingTime}
					viewCount={post.viewCount}
					alternateLang={alternateLang}
				/>

				<hr className="my-8 border-border lg:my-12" />

				<div
					className="prose prose-lg prose-neutral max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-h2:text-foreground prose-h3:mt-10 prose-h3:text-xl prose-h3:text-foreground prose-p:text-foreground-secondary prose-p:leading-relaxed prose-a:text-accent prose-a:underline-offset-4 hover:prose-a:text-accent-hover focus-visible:prose-a:outline-none focus-visible:prose-a:ring-2 focus-visible:prose-a:ring-accent focus-visible:prose-a:ring-offset-4 focus-visible:prose-a:ring-offset-background prose-strong:text-foreground prose-code:rounded prose-code:bg-code-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:font-code prose-code:text-foreground-code prose-code:before:content-none prose-code:after:content-none prose-pre:bg-code-bg prose-pre:text-foreground-code prose-li:text-foreground-secondary prose-li:leading-relaxed prose-blockquote:border-border prose-blockquote:text-foreground-secondary prose-hr:border-border"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>

				<PostFooter
					publishedAt={post.publishedAt}
					postLang={post.lang as Locale}
					requestedLang={requestedLang}
				/>
			</article>
		</div>
	);
}
