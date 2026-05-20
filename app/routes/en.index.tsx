import { createFileRoute } from "@tanstack/react-router";
import { LocaleBlogPage } from "#/components/layout/locale-blog-page";
import type { Post } from "#/db/schema";
import { LOCALES, localeHref, toBcp47 } from "#/lib/locale";
import { getLocalePosts } from "./{-$locale}/index.server";

// Literal `/en/` shim — companion to `pt-br.index.tsx`. The optional-locale
// index does not match `/en/` (explicit default-locale segment + trailing
// slash). Pinning this route lets operators / search engines who type the
// explicit-locale form land on real content rather than a 404. Canonical
// remains `/` (no locale prefix) — matches the existing default-locale
// behavior of `localeHref("en") === "/"`.

export const Route = createFileRoute("/en/")({
	loader: () => getLocalePosts({ data: "en" }),
	head: () => {
		const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
		// Canonical points to the locale-free root for the default locale.
		const canonicalUrl = `${siteUrl}/`;
		const description =
			"Articles about web development, React, TypeScript, Bun and international career.";
		return {
			meta: [
				{ name: "description", content: description },
				{ property: "og:title", content: "Antonio Fulgencio Blog" },
				{ property: "og:description", content: description },
				{ property: "og:url", content: canonicalUrl },
				{ property: "og:locale", content: "en_US" },
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
	component: EnIndexPage,
});

function EnIndexPage() {
	const allPosts: Post[] = Route.useLoaderData() ?? [];
	return <LocaleBlogPage locale="en" posts={allPosts} />;
}
