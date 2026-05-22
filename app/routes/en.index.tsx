import { createFileRoute } from "@tanstack/react-router";
import { LocaleBlogPage } from "#/components/layout/locale-blog-page";
import type { Post } from "#/db/schema";
import { buildLocaleHead } from "#/lib/locale";
import { getLocalePosts } from "./{-$locale}/index.server";

// Literal `/en/` shim — companion to `pt-br.index.tsx`. The optional-locale
// index does not match `/en/` (explicit default-locale segment + trailing
// slash). Pinning this route lets operators / search engines who type the
// explicit-locale form land on real content rather than a 404. Canonical
// remains `/` (no locale prefix) — matches the existing default-locale
// behavior of `localeHref("en") === "/"`.

export const Route = createFileRoute("/en/")({
	loader: () => getLocalePosts({ data: "en" }),
	head: () => buildLocaleHead("en", { kind: "homepage" }),
	component: EnIndexPage,
});

function EnIndexPage() {
	const allPosts: Post[] = Route.useLoaderData() ?? [];
	return <LocaleBlogPage locale="en" posts={allPosts} />;
}
