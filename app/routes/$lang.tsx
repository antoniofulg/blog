import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";

export const Route = createFileRoute("/$lang")({
	beforeLoad: ({ params }) => {
		if (!LOCALES.includes(params.lang as Locale)) {
			throw redirect({
				to: "/$lang/$slug",
				params: { lang: DEFAULT_LOCALE, slug: params.lang },
			});
		}
	},
	component: () => <Outlet />,
});
