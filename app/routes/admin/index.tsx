import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { PostShare } from "#/components/ui/post-share";
import type { Post } from "#/db/schema";
import { formatDate } from "#/lib/date";
import { strings } from "#/lib/i18n/strings";
import { type Locale, localeHref, useLocale } from "#/lib/locale";
import { getSiteOrigin } from "#/lib/site-origin";
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

function AdminDashboard() {
	const posts = Route.useLoaderData();
	const { locale: searchLocale } = Route.useSearch();
	const { locale } = useLocale();
	const t = strings[locale].admin.dashboard;

	const shown = searchLocale
		? posts.filter((p: Post) => p.lang === searchLocale)
		: posts;

	const viewHref = (post: Post) =>
		post.lang === "en" ? `/${post.slug}` : `/pt-br/${post.slug}`;

	const filters: Array<{
		label: string;
		value: "en" | "pt-br" | undefined;
	}> = [
		{ label: t.filter.all, value: undefined },
		{ label: t.filter.en, value: "en" },
		{ label: t.filter.ptBr, value: "pt-br" },
	];

	return (
		<div className="px-5 py-16 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<h1 className="font-heading text-3xl font-bold text-foreground">
					{t.title}
				</h1>
				<p className="mt-2 text-foreground-secondary">{t.subtitle}</p>

				<nav aria-label={t.filter.label} className="mt-6 flex gap-2 text-sm">
					{filters.map((f) => {
						const isActive = f.value === searchLocale;
						// Client-side navigation via <Link search>; preserves SPA
						// state (no full-page reload). search={{}} clears the locale
						// param for the "All" chip.
						return (
							<Link
								key={f.value ?? "all"}
								to="/admin/"
								search={{ locale: f.value }}
								aria-current={isActive ? "page" : undefined}
								className={`rounded-md border px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
									isActive
										? "border-accent bg-accent text-foreground-inverse"
										: "border-border bg-surface text-foreground hover:bg-muted"
								}`}
							>
								{f.label}
							</Link>
						);
					})}
				</nav>

				<div className="mt-8 overflow-x-auto rounded-lg border border-border bg-card">
					<table className="w-full min-w-[640px]">
						<thead>
							<tr className="border-b border-border bg-surface">
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.table.title}
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.table.slug}
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.table.lang}
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.table.published}
								</th>
								<th
									scope="col"
									className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted"
								>
									{t.table.share}
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.table.actions}
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
									<td className="px-4 py-3 text-xs tabular-nums text-foreground-muted">
										{post.publishedAt
											? formatDate(post.publishedAt, locale)
											: strings[locale].admin.dashboard.unpublished}
									</td>
									<td className="px-4 py-3">
										<PostShare
											variant="dropdown"
											postUrl={`${getSiteOrigin()}${localeHref(post.lang as Locale, post.slug)}`}
											postSlug={post.slug}
											postTitle={post.title ?? ""}
											locale={post.lang as Locale}
										/>
									</td>
									<td className="px-4 py-3">
										<a
											href={viewHref(post)}
											target="_blank"
											rel="noopener noreferrer"
											className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
										>
											{t.actions.view}
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
