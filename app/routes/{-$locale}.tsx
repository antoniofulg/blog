import { createFileRoute, notFound, Outlet } from "@tanstack/react-router";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "#/lib/locale";

export const Route = createFileRoute("/{-$locale}")({
	beforeLoad: ({ params }) => {
		const locale = params.locale ?? DEFAULT_LOCALE;
		if (!LOCALES.includes(locale as Locale)) {
			throw notFound();
		}
	},
	component: () => <Outlet />,
});
