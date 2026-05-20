import { createFileRoute, redirect } from "@tanstack/react-router";
import { LocaleBlogPage } from "#/components/layout/locale-blog-page";
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
			throw redirect({
				to: "/{-$locale}/",
				params: { locale: detected },
				statusCode: 302,
				headers: { Vary: "Cookie, Accept-Language" },
			});
		}
	},
	head: ({ params }) => {
		const locale = params.locale ?? DEFAULT_LOCALE;
		const isPtBr = locale === "pt-br";
		const siteUrl = import.meta.env.VITE_SITE_URL ?? "";
		const pathname = isPtBr ? "/pt-br/" : "/";
		const canonicalUrl = `${siteUrl}${pathname}`;
		const description = isPtBr
			? "Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional."
			: "Articles about web development, React, TypeScript, Bun and international career.";
		return {
			meta: [
				{ name: "description", content: description },
				{ property: "og:title", content: "Antonio Fulgencio Blog" },
				{ property: "og:description", content: description },
				{ property: "og:url", content: canonicalUrl },
				{ property: "og:locale", content: isPtBr ? "pt_BR" : "en_US" },
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
	loader: ({ params }) =>
		getLocalePosts({ data: params.locale ?? DEFAULT_LOCALE }),
	component: LocaleIndexPage,
});

function LocaleIndexPage() {
	const allPosts: Post[] = Route.useLoaderData() ?? [];
	const { locale } = Route.useParams();
	const lang = (locale ?? DEFAULT_LOCALE) as Locale;
	return <LocaleBlogPage locale={lang} posts={allPosts} />;
}
