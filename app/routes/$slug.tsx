import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { detectLocaleFromRequest } from "#/lib/locale";

const detectLocale = createServerFn({ method: "GET" }).handler(() =>
	detectLocaleFromRequest(getRequest()),
);

export const Route = createFileRoute("/$slug")({
	loader: async ({ params }) => {
		const lang = await detectLocale();
		throw redirect({ to: "/$lang/$slug", params: { lang, slug: params.slug } });
	},
	component: () => null,
});
