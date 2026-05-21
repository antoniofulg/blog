import { Link } from "@tanstack/react-router";
import type { Post } from "#/db/schema";
import { DEFAULT_LOCALE, type Locale } from "#/lib/locale";

const dateLocale: Record<Locale, string> = { en: "en-US", "pt-br": "pt-BR" };

export function PostCard({ post, lang }: { post: Post; lang?: Locale }) {
	const locale = lang ?? DEFAULT_LOCALE;

	return (
		<article className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
			<Link
				to="/{-$locale}/$slug/"
				params={{
					locale: locale === DEFAULT_LOCALE ? undefined : locale,
					slug: post.slug,
				}}
				className="flex flex-col gap-3 p-5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-inset"
			>
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
				<h3 className="font-heading text-lg font-bold leading-snug text-foreground transition-colors group-hover:text-accent">
					{post.title}
				</h3>
				{post.description && (
					<p className="line-clamp-3 text-sm leading-relaxed text-foreground-secondary">
						{post.description}
					</p>
				)}
			</Link>
		</article>
	);
}
