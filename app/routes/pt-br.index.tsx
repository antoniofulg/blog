import { createFileRoute } from "@tanstack/react-router";
import { LocaleBlogPage } from "#/components/layout/locale-blog-page";
import type { Post } from "#/db/schema";
import { LOCALES, localeHref, toBcp47 } from "#/lib/locale";
import { getLocalePosts } from "./{-$locale}/index.server";

// Literal `/pt-br/` shim. The optional-locale index (`{-$locale}/index.tsx`)
// matches `/` (locale absent) but does NOT match `/pt-br/` (locale present
// with trailing slash) under TanStack Router's current optional-param +
// index matching. See reviews-012/issue_002.md for the empirical
// confirmation. This file pins the pt-br locale root behind a literal route
// declaration so the matcher hits it before the optional-param fallback.

export const Route = createFileRoute("/pt-br/")({
	loader: () => getLocalePosts({ data: "pt-br" }),
	head: () => {
		const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
		const canonicalUrl = `${siteUrl}/pt-br/`;
		const description =
			"Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional.";
		return {
			meta: [
				{ name: "description", content: description },
				{ property: "og:title", content: "Antonio Fulgencio Blog" },
				{ property: "og:description", content: description },
				{ property: "og:url", content: canonicalUrl },
				{ property: "og:locale", content: "pt_BR" },
			],
			links: [
				{ rel: "canonical", href: canonicalUrl },
				...LOCALES.map((l) => ({
					rel: "alternate",
					hrefLang: toBcp47(l),
					href: localeHref(l),
				})),
			],
		};
	},
	component: PtBrIndexPage,
});

function PtBrIndexPage() {
	const allPosts: Post[] = Route.useLoaderData() ?? [];
	return <LocaleBlogPage locale="pt-br" posts={allPosts} />;
}
