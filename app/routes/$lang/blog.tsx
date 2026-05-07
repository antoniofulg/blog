import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { EmptyState } from "#/components/ui/empty-state";
import { Pagination } from "#/components/ui/pagination";
import { PostCard } from "#/components/ui/post-card";
import { getPublishedPostsFn } from "#/db/queries";

const getLocalePosts = createServerFn({ method: "GET" })
	.inputValidator((lang: string) => lang)
	.handler(({ data: lang }) => getPublishedPostsFn(lang));

export const Route = createFileRoute("/$lang/blog")({
	loader: ({ params }) => getLocalePosts({ data: params.lang }),
	component: LocaleBlogPage,
});

const POSTS_PER_PAGE = 9;

function LocaleBlogPage() {
	const allPosts = Route.useLoaderData();
	const { lang } = Route.useParams();
	const [currentPage, setCurrentPage] = useState(1);

	const totalPages = Math.max(1, Math.ceil(allPosts.length / POSTS_PER_PAGE));
	const paginatedPosts = allPosts.slice(
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

				{paginatedPosts.length === 0 ? (
					<EmptyState
						title="Nenhum artigo encontrado"
						description="Não há artigos publicados ainda."
					/>
				) : (
					<>
						<div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
							{paginatedPosts.map((post) => (
								<PostCard key={post.id} post={post} lang={lang} />
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
