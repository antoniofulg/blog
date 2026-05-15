import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { EmptyState } from "#/components/ui/empty-state";
import { Pagination } from "#/components/ui/pagination";
import { PostCard } from "#/components/ui/post-card";
import type { Post } from "#/db/schema";
import {
	DEFAULT_LOCALE,
	detectLocaleFromRequest,
	LOCALES,
	type Locale,
	localeHref,
	toBcp47,
} from "#/lib/locale";
import { getLocalePosts } from "./index.server";

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
	string,
	{ subtitle: string; emptyTitle: string; emptyDesc: string }
>;

export const Route = createFileRoute("/{-$locale}/")({
	beforeLoad: async ({ params }) => {
		if (params.locale !== undefined) return;
		if (!import.meta.env.SSR) return;
		const { getRequest, setResponseHeader } = await import(
			"@tanstack/react-start/server"
		);
		const req = getRequest();
		setResponseHeader("Vary", "Cookie, Accept-Language");
		const detected = detectLocaleFromRequest(req);
		if (detected !== DEFAULT_LOCALE) {
			// href used instead of `to`: TanStack Router excludes "/{-$locale}/"
			// from the redirect `to` union and does not expose the optional-segment
			// param in the inferred params type (TS2820/TS2353). See issue_003.md.
			throw redirect({
				href: `/${detected}/`,
				statusCode: 302,
				headers: { Vary: "Cookie, Accept-Language" },
			});
		}
	},
	head: ({ params }) => ({
		meta: [
			{
				name: "description",
				content:
					params.locale === "pt-br"
						? "Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional."
						: "Articles about web development, React, TypeScript, Bun and international career.",
			},
		],
		links: LOCALES.map((l) => ({
			rel: "alternate",
			hrefLang: toBcp47(l),
			href: localeHref(l),
		})),
	}),
	loader: ({ params }) =>
		getLocalePosts({ data: params.locale ?? DEFAULT_LOCALE }),
	component: LocaleBlogPage,
});

const POSTS_PER_PAGE = 9;

function LocaleBlogPage() {
	const allPosts: Post[] = Route.useLoaderData() ?? [];
	const { locale } = Route.useParams();
	const lang = (locale ?? DEFAULT_LOCALE) as Locale;
	const [currentPage, setCurrentPage] = useState(1);
	const t = copy[lang as keyof typeof copy] ?? copy.en;

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
				<p className="mt-3 text-foreground-secondary">{t.subtitle}</p>

				{paginatedPosts.length === 0 ? (
					<EmptyState title={t.emptyTitle} description={t.emptyDesc} />
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
