import { useState } from "react";
import { EmptyState } from "#/components/ui/empty-state";
import { Pagination } from "#/components/ui/pagination";
import { PostCard } from "#/components/ui/post-card";
import type { Post } from "#/db/schema";
import type { Locale } from "#/lib/locale";

// Shared between the optional-locale index route (`{-$locale}/index.tsx`) and
// the literal locale-index shim routes (`en.index.tsx`, `pt-br.index.tsx`).
// The shims exist because TanStack Router's optional path-param `{-$locale}`
// + index-at-`/` does not match `/<locale>/` with explicit locale + trailing
// slash (see reviews-012/issue_002.md for the empirical evidence). Posts +
// locale are passed as props instead of being read off `Route` so the same
// component can render under three different route declarations.

const copy = {
	en: {
		subtitle:
			"Articles about web development, React, TypeScript, Bun and more.",
		emptyTitle: "No articles found",
		emptyDesc: "No published articles yet.",
	},
	"pt-br": {
		subtitle:
			"Artigos sobre desenvolvimento web, React, TypeScript, Bun e mais.",
		emptyTitle: "Nenhum artigo encontrado",
		emptyDesc: "Não há artigos publicados ainda.",
	},
} satisfies Record<
	Locale,
	{ subtitle: string; emptyTitle: string; emptyDesc: string }
>;

const POSTS_PER_PAGE = 9;

export function LocaleBlogPage({
	locale,
	posts,
}: {
	locale: Locale;
	posts: Post[];
}) {
	const [currentPage, setCurrentPage] = useState(1);
	const t = copy[locale] ?? copy.en;

	const totalPages = Math.max(1, Math.ceil(posts.length / POSTS_PER_PAGE));
	const paginatedPosts = posts.slice(
		(currentPage - 1) * POSTS_PER_PAGE,
		currentPage * POSTS_PER_PAGE,
	);

	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
					Blog
				</h1>
				<p className="mt-3 text-foreground-secondary">{t.subtitle}</p>

				{paginatedPosts.length === 0 ? (
					<EmptyState title={t.emptyTitle} description={t.emptyDesc} />
				) : (
					<>
						<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{paginatedPosts.map((post) => (
								<PostCard key={post.id} post={post} lang={locale} />
							))}
						</div>

						{totalPages > 1 && (
							<div className="mt-12">
								<Pagination
									currentPage={currentPage}
									totalPages={totalPages}
									onPageChange={setCurrentPage}
								/>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
