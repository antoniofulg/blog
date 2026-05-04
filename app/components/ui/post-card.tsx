import { Link } from "@tanstack/react-router";
import type { Post } from "#/db/schema";

export function PostCard({ post }: { post: Post }) {
	return (
		<article className="group overflow-hidden rounded-lg border border-border bg-card transition-shadow hover:shadow-md">
			<div className="h-48 bg-muted" />
			<div className="flex flex-col gap-3 p-5">
				{post.publishedAt && (
					<time
						dateTime={new Date(post.publishedAt).toISOString()}
						className="text-xs text-foreground-muted"
					>
						{new Date(post.publishedAt).toLocaleDateString("pt-BR", {
							day: "numeric",
							month: "short",
							year: "numeric",
						})}
					</time>
				)}
				<h3 className="font-heading text-lg font-bold leading-snug text-foreground group-hover:text-accent">
					<Link to="/$slug" params={{ slug: post.slug }}>
						{post.title}
					</Link>
				</h3>
				{post.description && (
					<p className="line-clamp-2 text-sm leading-relaxed text-foreground-secondary">
						{post.description}
					</p>
				)}
			</div>
		</article>
	);
}
