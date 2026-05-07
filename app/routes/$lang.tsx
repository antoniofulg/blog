import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { LOCALES, type Locale } from "#/lib/locale";

export const Route = createFileRoute("/$lang")({
	beforeLoad: ({ params }) => {
		if (!LOCALES.includes(params.lang as Locale)) {
			throw redirect({ to: "/$lang/blog", params: { lang: "en" } });
		}
	},
	component: () => <Outlet />,
});
