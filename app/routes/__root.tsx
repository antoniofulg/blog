import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
	useLocation,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { ArrowLeft } from "lucide-react";
import { Footer } from "#/components/layout/footer";
import { Header } from "#/components/layout/header";
import { WipBanner } from "#/components/layout/wip-banner";
import { strings } from "#/lib/i18n/strings";
import {
	collapseDefaultLocalePath,
	DEFAULT_LOCALE,
	LOCALES,
	type Locale,
	LocaleProvider,
} from "#/lib/locale";
import { getSiteOrigin } from "#/lib/site-origin";
import { ThemeProvider } from "#/lib/theme";
import type { RouterContext } from "#/types/auth";
import appCss from "../styles/global.css?url";

const getAuthSession = createServerFn({ method: "GET" }).handler(async () => {
	const { auth } = await import("#/lib/auth");
	const request = getRequest();
	try {
		const session = await auth.api.getSession({ headers: request.headers });
		if (!session?.user) return null;
		return {
			id: session.user.id,
			email: session.user.email,
			name: session.user.name,
		};
	} catch {
		return null;
	}
});

export const Route = createRootRouteWithContext<RouterContext>()({
	beforeLoad: async () => {
		const user = await getAuthSession();
		return { auth: { user } };
	},
	head: ({ matches }) => {
		const siteUrl = getSiteOrigin();
		const pathname = matches.at(-1)?.pathname ?? "/";
		// Default-locale collapse: `/<DEFAULT_LOCALE>/<path>` → `/<path>`.
		// Non-default locales (e.g. /pt-br/...) keep their prefix.
		const canonicalPath = collapseDefaultLocalePath(pathname);
		const canonicalUrl = `${siteUrl}${canonicalPath}`;
		return {
			meta: [
				{ charSet: "utf-8" },
				{
					name: "viewport",
					content: "width=device-width, initial-scale=1",
				},
				{ title: "Antonio Fulgencio Blog" },
				{
					name: "description",
					content:
						"Daily lessons from shipping software — patterns, gotchas, refactors, and the tools that change how I work.",
				},
				{ property: "og:type", content: "website" },
				{ property: "og:title", content: "Antonio Fulgencio Blog" },
				{
					property: "og:description",
					content:
						"Daily lessons from shipping software — patterns, gotchas, refactors, and the tools that change how I work.",
				},
				{
					property: "og:image",
					content: `${siteUrl}/og-image.jpg`,
				},
				{ name: "twitter:card", content: "summary_large_image" },
			],
			links: [
				{ rel: "canonical", href: canonicalUrl },
				{
					rel: "alternate",
					type: "application/rss+xml",
					title: "Antonio Fulgencio — Posts",
					href: `${siteUrl}/rss.xml`,
				},
				// Favicon triplet — preferred SVG (modern browsers), ICO fallback
				// (legacy), Apple touch icon (iOS "add to home screen").
				{ rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
				{ rel: "icon", type: "image/x-icon", href: "/favicon.ico" },
				{ rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
				{ rel: "stylesheet", href: appCss },
			],
		};
	},
	component: RootLayout,
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

export function NotFoundPage() {
	const { pathname } = useLocation();
	const segment = pathname.split("/")[1] as Locale;
	const lang = LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;
	const t = strings[lang].notFound;
	return (
		<div className="flex flex-col items-center justify-center gap-6 px-5 py-20 text-center">
			<span className="animate-fade-up font-heading text-7xl font-bold text-accent lg:text-9xl">
				404
			</span>
			<h1
				className="animate-fade-up font-heading text-2xl font-bold text-foreground lg:text-3xl"
				style={{ animationDelay: "80ms" }}
			>
				{t.title}
			</h1>
			<p
				className="animate-fade-up max-w-md text-foreground-secondary"
				style={{ animationDelay: "80ms" }}
			>
				{t.body}
			</p>
			<Link
				to="/{-$locale}/"
				params={{ locale: undefined }}
				className="animate-fade-up inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
				style={{ animationDelay: "80ms" }}
			>
				<ArrowLeft className="h-4 w-4" aria-hidden="true" />
				{t.homeCta}
			</Link>
		</div>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	const { pathname } = useLocation();
	const segment = pathname.split("/")[1] as Locale;
	const locale = LOCALES.includes(segment) ? segment : DEFAULT_LOCALE;
	const htmlLang = locale === "pt-br" ? "pt-BR" : "en";
	return (
		<html lang={htmlLang} suppressHydrationWarning>
			<head>
				<HeadContent />
				<script src="/theme-init.js" />
			</head>
			<body suppressHydrationWarning>
				{children}
				{import.meta.env.DEV && (
					<TanStackDevtools
						config={{ position: "bottom-right" }}
						plugins={[
							{
								name: "Tanstack Router",
								render: <TanStackRouterDevtoolsPanel />,
							},
						]}
					/>
				)}
				<Scripts />
			</body>
		</html>
	);
}

function RootLayout() {
	return (
		<LocaleProvider>
			<ThemeProvider>
				<div className="flex min-h-screen flex-col">
					<WipBanner />
					<Header />
					<main className="flex-1">
						<Outlet />
					</main>
					<Footer />
				</div>
			</ThemeProvider>
		</LocaleProvider>
	);
}
