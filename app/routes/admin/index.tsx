import { createFileRoute, redirect } from "@tanstack/react-router";
import type { Post } from "#/db/schema";
import { getAllPosts } from "./index.server";

const isLocale = (v: unknown): v is "en" | "pt-br" =>
	v === "en" || v === "pt-br";

export const Route = createFileRoute("/admin/")({
	validateSearch: (s: Record<string, unknown>) => ({
		locale: isLocale(s.locale) ? s.locale : undefined,
	}),
	beforeLoad: ({ context, location }) => {
		if (!context.auth.user)
			throw redirect({ to: "/login/", search: { redirect: location.href } });
	},
	loader: () => getAllPosts(),
	component: AdminDashboard,
});

const FILTERS: ReadonlyArray<{
	label: string;
	href: string;
	value?: "en" | "pt-br";
}> = [
	{ label: "Todos", href: "/admin/" },
	{ label: "EN", href: "/admin/?locale=en", value: "en" },
	{ label: "PT-BR", href: "/admin/?locale=pt-br", value: "pt-br" },
];

function AdminDashboard() {
	const posts = Route.useLoaderData();
	const { locale } = Route.useSearch();
	const shown = locale ? posts.filter((p: Post) => p.lang === locale) : posts;
	const viewHref = (post: Post) =>
		post.lang === "en" ? `/${post.slug}` : `/pt-br/${post.slug}`;

	return (
		<div className="px-5 py-16 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<h1 className="font-heading text-3xl font-bold text-foreground">
					Admin Dashboard
				</h1>
				<p className="mt-2 text-foreground-secondary">
					Gerencie seus artigos e publicações.
				</p>

				<nav
					aria-label="Filtrar por idioma"
					className="mt-6 flex gap-2 text-sm"
				>
					{FILTERS.map((f) => {
						const isActive = f.value === locale;
						return (
							<a
								key={f.href}
								href={f.href}
								aria-current={isActive ? "page" : undefined}
								className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
									isActive
										? "border-accent bg-accent text-foreground-inverse"
										: "border-border bg-surface text-foreground hover:bg-muted"
								}`}
							>
								{f.label}
							</a>
						);
					})}
				</nav>

				<div className="mt-8 overflow-hidden rounded-lg border border-border bg-card">
					<table className="w-full">
						<thead>
							<tr className="border-b border-border bg-surface">
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									Título
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									Slug
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									Idioma
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									Ações
								</th>
							</tr>
						</thead>
						<tbody>
							{shown.map((post: Post) => (
								<tr key={post.id} className="border-b border-border">
									<td className="px-4 py-3 text-sm font-medium text-foreground">
										{post.title}
									</td>
									<td className="px-4 py-3 font-code text-xs text-foreground-secondary">
										{post.slug}
									</td>
									<td className="px-4 py-3 text-xs text-foreground-muted">
										{post.lang}
									</td>
									<td className="px-4 py-3">
										<a
											href={viewHref(post)}
											target="_blank"
											rel="noopener noreferrer"
											className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
										>
											View
										</a>
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
