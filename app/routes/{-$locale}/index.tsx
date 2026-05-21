import { createFileRoute, redirect } from "@tanstack/react-router";
import { LocaleBlogPage } from "#/components/layout/locale-blog-page";
import type { Post } from "#/db/schema";
import {
	buildLocaleHead,
	DEFAULT_LOCALE,
	detectLocaleFromRequest,
	type Locale,
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
	head: ({ params }) =>
		buildLocaleHead((params.locale ?? DEFAULT_LOCALE) as Locale, {
			kind: "homepage",
		}),
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
