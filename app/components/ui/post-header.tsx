import { Link } from "@tanstack/react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { DEFAULT_LOCALE, type Locale, localeHref, toBcp47 } from "#/lib/locale";

const eyebrowByLocale: Record<Locale, string> = {
	en: "Article",
	"pt-br": "Artigo",
};

const allPostsByLocale: Record<Locale, string> = {
	en: "Posts",
	"pt-br": "Posts",
};

const publishedByLocale: Record<Locale, string> = {
	en: "Published",
	"pt-br": "Publicado em",
};

const minReadByLocale: Record<Locale, string> = {
	en: "min read",
	"pt-br": "min de leitura",
};

const viewsByLocale: Record<Locale, (n: string) => string> = {
	en: (n) => `${n} views`,
	"pt-br": (n) => `${n} visualizações`,
};

const altLangName: Record<Locale, string> = {
	en: "English",
	"pt-br": "Português",
};

const readInByLocale: Record<Locale, (name: string) => string> = {
	en: (name) => `Read in ${name}`,
	"pt-br": (name) => `Ler em ${name}`,
};

const dateLocale: Record<Locale, string> = {
	en: "en-US",
	"pt-br": "pt-BR",
};

function formatViewCount(n: number): string {
	if (n < 1000) return String(n);
	if (n < 1_000_000) return `${(n / 1000).toFixed(n < 10_000 ? 1 : 0)}k`;
	return `${(n / 1_000_000).toFixed(1)}M`;
}

type Props = {
	title: string;
	description: string | null;
	publishedAt: Date | string | null;
	postLang: Locale;
	requestedLang: Locale;
	slug: string;
	readingTime: number;
	viewCount: number;
	alternateLang: Locale | null;
};

export function PostHeader({
	title,
	description,
	publishedAt,
	postLang,
	requestedLang,
	slug,
	readingTime,
	viewCount,
	alternateLang,
}: Props) {
	const date = publishedAt ? new Date(publishedAt) : null;
	const formattedDate = date
		? date.toLocaleDateString(dateLocale[postLang], {
				day: "numeric",
				month: "long",
				year: "numeric",
			})
		: null;

	return (
		<header className="flex flex-col gap-6">
			<div className="animate-fade-up flex flex-wrap items-center justify-between gap-3">
				<Link
					to="/{-$locale}/"
					params={{
						locale:
							requestedLang === DEFAULT_LOCALE ? undefined : requestedLang,
					}}
					className="inline-flex min-h-[44px] items-center gap-1.5 rounded-sm text-sm font-medium text-foreground-secondary transition-colors hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
				>
					<ArrowLeft className="h-4 w-4" aria-hidden="true" />
					<span>{allPostsByLocale[requestedLang]}</span>
				</Link>

				{alternateLang && (
					<a
						href={localeHref(alternateLang, slug)}
						hrefLang={toBcp47(alternateLang)}
						className="inline-flex min-h-[44px] items-center gap-1.5 rounded-md border border-border bg-card px-3 text-xs font-medium text-foreground-secondary transition-colors hover:border-border-strong hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						<span>
							{readInByLocale[requestedLang](altLangName[alternateLang])}
						</span>
						<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
					</a>
				)}
			</div>

			<p
				className="animate-fade-up text-xs font-semibold uppercase tracking-[0.18em] text-accent"
				style={{ animationDelay: "60ms" }}
			>
				{eyebrowByLocale[requestedLang]}
			</p>

			<h1
				id="post-title"
				className="animate-fade-up font-heading text-[clamp(2rem,5.5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-foreground"
				style={{ animationDelay: "120ms" }}
			>
				{title}
			</h1>

			{description && (
				<p
					className="animate-fade-up max-w-2xl text-xl leading-relaxed text-foreground-secondary lg:text-2xl"
					style={{ animationDelay: "180ms" }}
				>
					{description}
				</p>
			)}

			<ul
				className="animate-fade-up flex flex-wrap items-center gap-x-3 gap-y-2 text-xs font-medium uppercase tracking-[0.16em] text-foreground-muted"
				style={{ animationDelay: "240ms" }}
			>
				{formattedDate && (
					<li>
						<span className="text-foreground-muted">
							{publishedByLocale[requestedLang]}{" "}
						</span>
						<time
							dateTime={(date as Date).toISOString()}
							className="text-foreground-secondary"
						>
							{formattedDate}
						</time>
					</li>
				)}
				{formattedDate && <li aria-hidden="true">·</li>}
				<li>
					<span className="text-foreground-secondary">{readingTime}</span>{" "}
					{minReadByLocale[requestedLang]}
				</li>
				{viewCount > 0 && (
					<>
						<li aria-hidden="true">·</li>
						<li>{viewsByLocale[requestedLang](formatViewCount(viewCount))}</li>
					</>
				)}
			</ul>
		</header>
	);
}
