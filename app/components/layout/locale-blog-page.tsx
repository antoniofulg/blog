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
		eyebrow: "Articles",
		heading: "Blog",
		subtitle:
			"Notes on web development, React, TypeScript, Bun, and modern tooling.",
		emptyTitle: "No articles found",
		emptyDesc: "No published articles yet.",
	},
	"pt-br": {
		eyebrow: "Artigos",
		heading: "Blog",
		subtitle:
			"Notas sobre desenvolvimento web, React, TypeScript, Bun e ferramentas modernas.",
		emptyTitle: "Nenhum artigo encontrado",
		emptyDesc: "Não há artigos publicados ainda.",
	},
} satisfies Record<
	Locale,
	{
		eyebrow: string;
		heading: string;
		subtitle: string;
		emptyTitle: string;
		emptyDesc: string;
	}
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
		<div className="px-5 py-16 lg:px-20 lg:py-24">
			<div className="mx-auto max-w-5xl">
				<p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">
					{t.eyebrow}
				</p>
				<h1 className="mt-3 font-heading text-[clamp(2rem,5.5vw,3.5rem)] font-bold leading-[1.1] tracking-tight text-foreground">
					{t.heading}
				</h1>
				<p className="mt-6 max-w-2xl text-xl leading-relaxed text-foreground-secondary">
					{t.subtitle}
				</p>

				{paginatedPosts.length === 0 ? (
					<div className="mt-16">
						<EmptyState title={t.emptyTitle} description={t.emptyDesc} />
					</div>
				) : (
					<>
						<div className="mt-16 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
									locale={locale}
								/>
							</div>
						)}
					</>
				)}
			</div>
		</div>
	);
}
