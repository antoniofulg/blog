import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo } from "react";
import { PostFooter } from "#/components/ui/post-footer";
import { PostHeader } from "#/components/ui/post-header";
import { PostShare } from "#/components/ui/post-share";
import { StaticPageProfile } from "#/components/ui/static-page-profile";
import { TranslationNotice } from "#/components/ui/translation-notice";
import { DEFAULT_LOCALE, type Locale, localeHref, toBcp47 } from "#/lib/locale";
import { readingTimeMinutes } from "#/lib/reading-time";
import {
	getPostBySlugWithLang,
	incrementViewCount,
	type PageLoaderResult,
	type PostLoaderResult,
} from "./$slug.server";

export const Route = createFileRoute("/{-$locale}/$slug")({
	loader: async ({ params }) => {
		const lang = (params.locale ?? DEFAULT_LOCALE) as Locale;
		return getPostBySlugWithLang({
			data: { slug: params.slug, lang },
		});
	},
	head: ({ loaderData }) => {
		if (loaderData?.kind === "post") {
			return {
				meta: [
					{ title: loaderData.post.title ?? "Blog" },
					...(loaderData.post.description
						? [{ name: "description", content: loaderData.post.description }]
						: []),
					...(loaderData.post.title
						? [{ property: "og:title", content: loaderData.post.title }]
						: []),
					...(loaderData.post.description
						? [
								{
									property: "og:description",
									content: loaderData.post.description,
								},
							]
						: []),
				],
				links: loaderData.alternateLang
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
			};
		}
		if (loaderData?.kind === "page") {
			const otherLang: Locale =
				loaderData.requestedLang === "en" ? "pt-br" : "en";
			return {
				meta: [
					{ title: loaderData.entry.frontmatter.title ?? "Blog" },
					...(loaderData.entry.frontmatter.description
						? [
								{
									name: "description",
									content: loaderData.entry.frontmatter.description,
								},
							]
						: []),
					...(loaderData.entry.frontmatter.title
						? [
								{
									property: "og:title",
									content: loaderData.entry.frontmatter.title,
								},
							]
						: []),
					...(loaderData.entry.frontmatter.description
						? [
								{
									property: "og:description",
									content: loaderData.entry.frontmatter.description,
								},
							]
						: []),
				],
				links: loaderData.hasTwin
					? [
							{
								rel: "alternate",
								hrefLang: toBcp47(loaderData.requestedLang),
								href: localeHref(
									loaderData.requestedLang,
									loaderData.entry.slug,
								),
							},
							{
								rel: "alternate",
								hrefLang: toBcp47(otherLang),
								href: localeHref(otherLang, loaderData.entry.slug),
							},
						]
					: [],
			};
		}
		return { meta: [{ title: "Blog" }], links: [] };
	},
	component: LocalePostDetail,
	notFoundComponent: () => {
		const { locale } = Route.useParams();
		const lang = (locale ?? DEFAULT_LOCALE) as Locale;
		const copy = {
			en: {
				title: "Post not found",
				body: "This post doesn't exist or was removed.",
				cta: "← Posts",
			},
			"pt-br": {
				title: "Post não encontrado",
				body: "Este post não existe ou foi removido.",
				cta: "← Posts",
			},
		} satisfies Record<Locale, { title: string; body: string; cta: string }>;
		const t = copy[lang] ?? copy.en;
		return (
			<div className="flex flex-col items-center justify-center gap-6 px-5 py-20 text-center">
				<h1 className="animate-fade-up font-heading text-2xl font-bold text-foreground lg:text-3xl">
					{t.title}
				</h1>
				<p
					className="animate-fade-up max-w-md text-foreground-secondary"
					style={{ animationDelay: "80ms" }}
				>
					{t.body}
				</p>
				<Link
					to="/{-$locale}/"
					params={{ locale: lang === DEFAULT_LOCALE ? undefined : lang }}
					className="animate-fade-up inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
					style={{ animationDelay: "160ms" }}
				>
					{t.cta}
				</Link>
			</div>
		);
	},
});

export function LocalePostDetail() {
	const loaderData = Route.useLoaderData();

	if (loaderData.kind === "page") {
		return <StaticPageView data={loaderData} />;
	}

	return <PostView data={loaderData} />;
}

function PostView({ data }: { data: PostLoaderResult }) {
	const {
		post,
		html,
		notTranslated,
		requestedLang,
		availableLang,
		alternateLang,
	} = data;

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
			<div
				className="reading-progress fixed inset-x-0 top-0 z-[60] h-[2px]"
				aria-hidden="true"
			>
				<div className="reading-progress-fill h-full origin-left bg-accent" />
			</div>
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

				<hr
					className="animate-fade-up my-8 border-border lg:my-12"
					style={{ animationDelay: "300ms" }}
				/>

				<div
					className="animate-fade-up prose prose-lg prose-neutral max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-h2:text-foreground prose-h3:mt-10 prose-h3:text-xl prose-h3:text-foreground prose-p:text-foreground-secondary prose-p:leading-relaxed prose-a:text-accent prose-a:underline-offset-4 hover:prose-a:text-accent-hover focus-visible:prose-a:outline-none focus-visible:prose-a:ring-2 focus-visible:prose-a:ring-accent focus-visible:prose-a:ring-offset-4 focus-visible:prose-a:ring-offset-background prose-strong:text-foreground prose-code:rounded prose-code:bg-code-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:font-code prose-code:text-foreground-code prose-code:before:content-none prose-code:after:content-none prose-pre:bg-code-bg prose-pre:text-foreground-code prose-li:text-foreground-secondary prose-li:leading-relaxed prose-blockquote:border-border prose-blockquote:text-foreground-secondary prose-hr:border-border"
					style={{ animationDelay: "300ms" }}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>

				<PostShare
					postUrl={localeHref(post.lang as Locale, post.slug)}
					postTitle={post.title ?? ""}
					locale={requestedLang}
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

function StaticPageView({ data }: { data: PageLoaderResult }) {
	return (
		<div className="px-5 py-16 lg:px-20 lg:py-24">
			<article
				className="mx-auto max-w-3xl"
				lang={toBcp47(data.requestedLang)}
				aria-labelledby="page-title"
			>
				<StaticPageProfile
					frontmatter={data.entry.frontmatter}
					locale={data.requestedLang}
					html={data.html}
				/>

				<PostFooter
					publishedAt={null}
					postLang={data.requestedLang}
					requestedLang={data.requestedLang}
				/>
			</article>
		</div>
	);
}
