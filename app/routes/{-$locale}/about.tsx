import { createFileRoute } from "@tanstack/react-router";
import { SocialLink } from "#/components/ui/social-link";
import { TranslationNotice } from "#/components/ui/translation-notice";
import {
	DEFAULT_LOCALE,
	LOCALES,
	type Locale,
	localeHref,
	toBcp47,
} from "#/lib/locale";
import { loadAboutFn } from "./about.server";

const AUTHOR_NAME = "Antonio Fulgencio";

const eyebrowByLocale: Record<Locale, string> = {
	en: "About",
	"pt-br": "Sobre",
};

const nowLabelByLocale: Record<Locale, string> = {
	en: "Updated",
	"pt-br": "Atualizado em",
};

const dateLocale: Record<Locale, string> = {
	en: "en-US",
	"pt-br": "pt-BR",
};

export const Route = createFileRoute("/{-$locale}/about")({
	loader: async ({ params }) => {
		const locale = (params.locale ?? DEFAULT_LOCALE) as Locale;
		return loadAboutFn({ data: locale });
	},
	head: ({ loaderData }) => ({
		meta: [
			{
				title: `${loaderData?.frontmatter?.title ?? "About"} · ${AUTHOR_NAME}`,
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

	const updatedDate = frontmatter.nowUpdatedAt
		? new Date(frontmatter.nowUpdatedAt).toLocaleDateString(
				dateLocale[locale],
				{ month: "long", year: "numeric" },
			)
		: null;

	return (
		<div className="px-5 py-16 lg:px-20 lg:py-24">
			<article
				className="mx-auto max-w-3xl"
				lang={toBcp47(locale)}
				aria-labelledby="about-name"
			>
				{fallbackLocale && (
					<div className="mb-10">
						<TranslationNotice
							requestedLang={requestedLang}
							availableLang={fallbackLocale}
						/>
					</div>
				)}

				<p className="animate-fade-up text-xs font-medium uppercase tracking-[0.18em] text-accent">
					{eyebrowByLocale[locale]}
				</p>

				<h1
					id="about-name"
					className="animate-fade-up mt-3 font-heading text-[clamp(2rem,5.5vw,3.5rem)] font-bold leading-[1.05] tracking-tight text-foreground"
					style={{ animationDelay: "80ms" }}
				>
					{AUTHOR_NAME}
				</h1>

				{frontmatter.tagline && (
					<p
						className="animate-fade-up mt-6 max-w-2xl text-xl leading-relaxed text-foreground-secondary lg:text-2xl"
						style={{ animationDelay: "160ms" }}
					>
						{frontmatter.tagline}
					</p>
				)}

				{/* Portrait — always render zone; placeholder when avatar absent */}
				<figure
					className="animate-fade-up mt-12"
					style={{ animationDelay: "240ms" }}
				>
					{frontmatter.avatar ? (
						<img
							src={frontmatter.avatar}
							alt={`Portrait of ${AUTHOR_NAME}`}
							width={192}
							height={192}
							className="h-48 w-48 rounded-lg border border-border bg-muted object-cover"
						/>
					) : (
						<div className="h-48 w-48 rounded-lg border border-border bg-muted" />
					)}
				</figure>

				<hr
					className="animate-fade-up mt-16 border-border"
					style={{ animationDelay: "300ms" }}
				/>

				<div
					className="animate-fade-up prose prose-lg prose-neutral mt-12 max-w-none dark:prose-invert prose-headings:font-heading prose-headings:font-bold prose-headings:tracking-tight prose-h2:mt-12 prose-h2:text-2xl prose-h2:text-foreground prose-p:text-foreground-secondary prose-p:leading-relaxed prose-a:text-accent prose-a:underline-offset-4 hover:prose-a:text-accent-hover prose-strong:text-foreground prose-code:rounded prose-code:bg-code-bg prose-code:px-1.5 prose-code:py-0.5 prose-code:font-code prose-code:text-foreground-code prose-code:before:content-none prose-code:after:content-none prose-pre:bg-code-bg prose-pre:text-foreground-code"
					style={{ animationDelay: "300ms" }}
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>

				{updatedDate && (
					<p className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-foreground-muted">
						{nowLabelByLocale[locale]} {updatedDate}
					</p>
				)}

				{frontmatter.links.length > 0 && (
					<>
						<hr className="mt-16 border-border" />
						<div
							className="animate-fade-up mt-12 flex flex-wrap gap-3"
							style={{ animationDelay: "360ms" }}
						>
							{frontmatter.links.map((link) => (
								<SocialLink
									key={link.url}
									label={link.label}
									url={link.url}
									kind={link.kind}
								/>
							))}
						</div>
					</>
				)}
			</article>
		</div>
	);
}
