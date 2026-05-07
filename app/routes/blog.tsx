import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { detectLocaleFromRequest } from "#/lib/locale";

const detectLocale = createServerFn({ method: "GET" }).handler(() =>
	detectLocaleFromRequest(getRequest()),
);

export const Route = createFileRoute("/blog")({
	loader: async () => {
		const lang = await detectLocale();
		throw redirect({ to: "/$lang/blog", params: { lang } });
	},
	component: () => null,
});
