import { Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import { DEFAULT_LOCALE, type Locale } from "#/lib/locale";

const endOfArticleByLocale: Record<Locale, string> = {
	en: "End of article",
	"pt-br": "Fim do artigo",
};

const publishedByLocale: Record<Locale, string> = {
	en: "Published",
	"pt-br": "Publicado em",
};

const allPostsByLocale: Record<Locale, string> = {
	en: "Browse all posts",
	"pt-br": "Ver todos os artigos",
};

const dateLocale: Record<Locale, string> = {
	en: "en-US",
	"pt-br": "pt-BR",
};

type Props = {
	publishedAt: Date | string | null;
	postLang: Locale;
	requestedLang: Locale;
};

export function PostFooter({ publishedAt, postLang, requestedLang }: Props) {
	const formattedDate = publishedAt
		? new Date(publishedAt).toLocaleDateString(dateLocale[postLang], {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: null;

	return (
		<footer className="mt-16 flex flex-col gap-6 border-t border-border pt-10">
			<p className="text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted">
				{endOfArticleByLocale[requestedLang]}
			</p>

			{formattedDate && (
				<p className="text-sm text-foreground-secondary">
					{publishedByLocale[requestedLang]}{" "}
					<time
						dateTime={new Date(publishedAt as string | Date).toISOString()}
						className="text-foreground"
					>
						{formattedDate}
					</time>
				</p>
			)}

			<Link
				to="/{-$locale}/"
				params={{
					locale: requestedLang === DEFAULT_LOCALE ? undefined : requestedLang,
				}}
				className="inline-flex items-center gap-1.5 self-start rounded-md border border-border bg-card px-4 py-2 text-sm font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<ArrowLeft className="h-4 w-4" aria-hidden="true" />
				<span>{allPostsByLocale[requestedLang]}</span>
			</Link>
		</footer>
	);
}
