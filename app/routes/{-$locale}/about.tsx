import { createFileRoute } from "@tanstack/react-router";
import { TranslationNotice } from "#/components/ui/translation-notice";
import {
	DEFAULT_LOCALE,
	LOCALES,
	type Locale,
	localeHref,
	toBcp47,
} from "#/lib/locale";
import { loadAboutFn } from "./about.server";

export const Route = createFileRoute("/{-$locale}/about")({
	loader: async ({ params }) => {
		const locale = (params.locale ?? DEFAULT_LOCALE) as Locale;
		return loadAboutFn({ data: locale });
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.frontmatter?.title ?? "About"} — Antonio Fulgencio`,
			},
		],
		links: LOCALES.map((l) => ({
			rel: "alternate",
			hrefLang: toBcp47(l),
			href: localeHref(l, "about"),
		})),
	}),
	component: AboutPage,
});

function AboutPage() {
	const { frontmatter, html, locale, fallbackLocale } = Route.useLoaderData();
	const { locale: requestedLocale } = Route.useParams();
	const requestedLang = (requestedLocale ?? DEFAULT_LOCALE) as Locale;

	return (
		<div className="px-5 py-12 lg:px-20">
			<article className="mx-auto max-w-3xl" lang={locale}>
				{fallbackLocale && (
					<div className="mb-6">
						<TranslationNotice
							requestedLang={requestedLang}
							availableLang={fallbackLocale}
						/>
					</div>
				)}
				<header className="mb-8">
					<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
						{frontmatter.title}
					</h1>
				</header>
				<div
					className="prose prose-neutral max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-a:text-accent prose-code:rounded prose-code:bg-code-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:text-foreground-code prose-pre:bg-code-bg prose-pre:text-foreground-code"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>
				{frontmatter.links.length > 0 && (
					<div className="mt-8 flex flex-wrap gap-4">
						{frontmatter.links.map((link) => (
							<a
								key={link.url}
								href={link.url}
								className="inline-flex items-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground-secondary hover:text-foreground"
								rel="noopener noreferrer"
							>
								{link.label}
							</a>
						))}
					</div>
				)}
			</article>
		</div>
	);
}
