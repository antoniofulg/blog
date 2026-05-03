import { TanStackDevtools } from "@tanstack/react-devtools";
import {
	createRootRouteWithContext,
	HeadContent,
	Scripts,
} from "@tanstack/react-router";
import { TanStackRouterDevtoolsPanel } from "@tanstack/react-router-devtools";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";

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
			{
				charSet: "utf-8",
			},
			{
				name: "viewport",
				content: "width=device-width, initial-scale=1",
			},
			{
				title: "TanStack Start Starter",
			},
		],
		links: [
			{
				rel: "stylesheet",
				href: appCss,
			},
		],
	}),
	shellComponent: RootDocument,
});

function RootDocument({ children }: { children: React.ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
			</head>
			<body>
				{children}
				<TanStackDevtools
					config={{
						position: "bottom-right",
					}}
					plugins={[
						{
							name: "Tanstack Router",
							render: <TanStackRouterDevtoolsPanel />,
						},
					]}
				/>
				<Scripts />
			</body>
		</html>
	);
}
