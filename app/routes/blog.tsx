import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { desc, eq } from "drizzle-orm";
import { useState } from "react";
import { EmptyState } from "#/components/ui/empty-state";
import { Pagination } from "#/components/ui/pagination";
import { PostCard } from "#/components/ui/post-card";
import { db } from "#/db/client";
import { posts } from "#/db/schema";

const getPublishedPosts = createServerFn({ method: "GET" }).handler(
	async () => {
		return await db
			.select()
			.from(posts)
			.where(eq(posts.isPublished, true))
			.orderBy(desc(posts.publishedAt));
	},
);

export const Route = createFileRoute("/blog")({
	validateSearch: (search: Record<string, unknown>) => ({
		category: (search.category as string) || undefined,
	}),
	loader: () => getPublishedPosts(),
	head: () => ({
		meta: [
			{ title: "Blog — Antonio Fulgencio Blog" },
			{
				name: "description",
				content:
					"Artigos sobre desenvolvimento web, React, TypeScript, Bun e mais.",
			},
		],
	}),
	component: BlogPage,
});

const POSTS_PER_PAGE = 9;

const categories = [
	"Todos",
	"Front-end",
	"Back-end",
	"TypeScript",
	"DevOps",
	"TanStack",
	"UI/UX",
];

function BlogPage() {
	const allPosts = Route.useLoaderData();
	const { category } = Route.useSearch();
	const [activeCategory, setActiveCategory] = useState(category || "Todos");
	const [currentPage, setCurrentPage] = useState(1);

	const filteredPosts = allPosts;
	const totalPages = Math.max(
		1,
		Math.ceil(filteredPosts.length / POSTS_PER_PAGE),
	);
	const paginatedPosts = filteredPosts.slice(
		(currentPage - 1) * POSTS_PER_PAGE,
		currentPage * POSTS_PER_PAGE,
	);

	return (
		<div className="px-5 py-12 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<h1 className="font-heading text-3xl font-extrabold text-foreground lg:text-4xl">
					Blog
				</h1>
				<p className="mt-3 text-foreground-secondary">
					Artigos sobre desenvolvimento web, React, TypeScript, Bun e mais.
				</p>

				<div className="mt-8 flex flex-wrap gap-2">
					{categories.map((cat) => (
						<button
							key={cat}
							type="button"
							onClick={() => {
								setActiveCategory(cat);
								setCurrentPage(1);
							}}
							className={`rounded-full px-4 py-2 text-xs font-medium transition-colors ${
								cat === activeCategory
									? "bg-accent text-foreground-inverse"
									: "bg-surface text-foreground hover:bg-muted"
							}`}
						>
							{cat}
						</button>
					))}
				</div>

				{paginatedPosts.length === 0 ? (
					<EmptyState
						title="Nenhum artigo encontrado"
						description="Não há artigos publicados nesta categoria ainda."
					/>
				) : (
					<>
						<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{paginatedPosts.map((post) => (
								<PostCard key={post.id} post={post} />
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
