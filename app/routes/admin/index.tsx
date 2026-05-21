import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { useState } from "react";
import type { Post } from "#/db/schema";
import { getAllPosts, togglePublished } from "./index.server";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.user) {
			throw redirect({
				to: "/login/",
				search: { redirect: location.href },
			});
		}
	},
	loader: () => getAllPosts(),
	component: AdminDashboard,
});

// ─── Components ───────────────────────────────────────────────────────────────

function PostRow({ post }: { post: Post }) {
	const [isPublished, setIsPublished] = useState(post.isPublished);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const handleToggle = async () => {
		const next = !isPublished;
		try {
			await togglePublished({ data: { id: post.id, isPublished: next } });
			setIsPublished(next);
			setSuccessMsg(next ? "Publicado" : "Rascunho");
			setTimeout(() => setSuccessMsg(null), 2000);
		} catch {
			setSuccessMsg("Erro — tente novamente");
			setTimeout(() => setSuccessMsg(null), 3000);
		}
	};

	return (
		<tr className="border-b border-border">
			<td className="px-4 py-3 text-sm font-medium text-foreground">
				{post.title}
			</td>
			<td className="px-4 py-3 font-code text-xs text-foreground-secondary">
				{post.slug}
			</td>
			<td className="px-4 py-3">
				<span
					className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
						isPublished
							? "bg-callout-tip text-success"
							: "bg-surface text-foreground-muted"
					}`}
				>
					{isPublished ? "Publicado" : "Rascunho"}
				</span>
				{successMsg && (
					<span
						className="ml-2 text-xs text-foreground-muted"
						aria-live="polite"
					>
						{successMsg}
					</span>
				)}
			</td>
			<td className="px-4 py-3 text-sm text-foreground-secondary">
				{post.viewCount}
			</td>
			<td className="px-4 py-3">
				<div className="flex gap-2">
					<button
						type="button"
						onClick={handleToggle}
						className="rounded-md bg-surface px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
					>
						{isPublished ? "Despublicar" : "Publicar"}
					</button>
					<Link
						to="/admin/preview/$slug/"
						params={{ slug: post.slug }}
						className="rounded-md bg-accent px-3 py-1.5 text-xs font-medium text-foreground-inverse transition-colors hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card"
					>
						Preview
					</Link>
				</div>
			</td>
		</tr>
	);
}

function AdminDashboard() {
	const postList = Route.useLoaderData();

	return (
		<div className="px-5 py-16 lg:px-20">
			<div className="mx-auto max-w-5xl">
				<h1 className="font-heading text-3xl font-bold text-foreground">
					Admin Dashboard
				</h1>
				<p className="mt-2 text-foreground-secondary">
					Gerencie seus artigos e publicações.
				</p>

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
									Status
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									Views
								</th>
								<th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									Ações
								</th>
							</tr>
						</thead>
						<tbody>
							{postList.map((post) => (
								<PostRow key={post.id} post={post} />
							))}
						</tbody>
					</table>
				</div>
			</div>
		</div>
	);
}
