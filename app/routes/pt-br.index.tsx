import { createFileRoute } from "@tanstack/react-router";
import { LocaleBlogPage } from "#/components/layout/locale-blog-page";
import type { Post } from "#/db/schema";
import { buildLocaleHead } from "#/lib/locale";
import { getLocalePosts } from "./{-$locale}/index.server";

// Literal `/pt-br/` shim. The optional-locale index (`{-$locale}/index.tsx`)
// matches `/` (locale absent) but does NOT match `/pt-br/` (locale present
// with trailing slash) under TanStack Router's current optional-param +
// index matching. See reviews-012/issue_002.md for the empirical
// confirmation. This file pins the pt-br locale root behind a literal route
// declaration so the matcher hits it before the optional-param fallback.

export const Route = createFileRoute("/pt-br/")({
	loader: () => getLocalePosts({ data: "pt-br" }),
	head: () => buildLocaleHead("pt-br", { kind: "homepage" }),
	component: PtBrIndexPage,
});

function PtBrIndexPage() {
	const allPosts: Post[] = Route.useLoaderData() ?? [];
	return <LocaleBlogPage locale="pt-br" posts={allPosts} />;
}
