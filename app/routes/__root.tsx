import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Link,
	Outlet,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { Home } from "lucide-react";
import { Footer } from "#/components/layout/footer";
import { Header } from "#/components/layout/header";
import { ThemeProvider } from "#/lib/theme";
import appCss from "../styles/global.css?url";

export type AuthUser = {
	id: string;
	email: string;
	name: string;
};

export type RouterContext = {
	auth: { user: AuthUser | null };
};

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
	head: () => ({
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
					"Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional.",
			},
		],
		links: [
			{ rel: "stylesheet", href: appCss },
			{ rel: "preconnect", href: "https://fonts.googleapis.com" },
			{
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			},
			{
				rel: "stylesheet",
				href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@400;500;600;700&display=swap",
			},
		],
	}),
	component: RootLayout,
	notFoundComponent: NotFoundPage,
	shellComponent: RootDocument,
});

function NotFoundPage() {
	return (
		<div className="flex flex-col items-center justify-center gap-6 px-5 py-20 text-center">
			<span className="font-heading text-7xl font-extrabold text-accent lg:text-9xl">
				404
			</span>
			<h1 className="font-heading text-2xl font-bold text-foreground lg:text-3xl">
				Página não encontrada
			</h1>
			<p className="max-w-md text-foreground-secondary">
				A página que você está procurando não existe ou foi movida para outro
				endereço.
			</p>
			<Link
				to="/"
				className="inline-flex items-center gap-2 rounded-md bg-accent px-6 py-3 text-sm font-semibold text-foreground-inverse transition-colors hover:bg-accent-hover"
			>
				<Home className="h-4 w-4" />
				Voltar ao Início
			</Link>
		</div>
	);
}

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="pt-BR" suppressHydrationWarning>
			<head>
				<HeadContent />
				<script src="/theme-init.js" />
			</head>
			<body>
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
		<ThemeProvider>
			<div className="flex min-h-screen flex-col">
				<Header />
				<main className="flex-1">
					<Outlet />
				</main>
				<Footer />
			</div>
		</ThemeProvider>
	);
}
