import { Link } from "@tanstack/react-router";
import type { Post } from "#/db/schema";
import { DEFAULT_LOCALE, type Locale } from "#/lib/locale";

const dateLocale: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" };

export function PostCard({ post, lang }: { post: Post; lang?: Locale }) {
	const locale = lang ?? DEFAULT_LOCALE;

	return (
		<article className="group flex flex-col gap-3 overflow-hidden rounded-lg border border-border bg-card p-5 transition-shadow hover:shadow-md">
			{post.publishedAt && (
				<time
					dateTime={new Date(post.publishedAt).toISOString()}
					className="text-xs text-foreground-muted"
				>
					{new Date(post.publishedAt).toLocaleDateString(dateLocale[locale], {
						day: "numeric",
						month: "short",
						year: "numeric",
					})}
				</time>
			)}
			<h3 className="font-heading text-lg font-bold leading-snug text-foreground group-hover:text-accent">
				<Link
					to="/{-$locale}/$slug/"
					params={{
						locale: locale === DEFAULT_LOCALE ? undefined : locale,
						slug: post.slug,
					}}
					className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-card"
				>
					{post.title}
				</Link>
			</h3>
			{post.description && (
				<p className="line-clamp-3 text-sm leading-relaxed text-foreground-secondary">
					{post.description}
				</p>
			)}
		</article>
	);
}
