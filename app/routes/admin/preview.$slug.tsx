import { createFileRoute, redirect } from "@tanstack/react-router";
import { getAdminPreview } from "./preview.$slug.server";

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/preview/$slug")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
	},
	loader: async ({ params }) => getAdminPreview({ data: params.slug }),
	component: PreviewPage,
});

// ─── Component ────────────────────────────────────────────────────────────────

function PreviewPage() {
	const { post, html } = Route.useLoaderData();

	return (
		<main>
			<article>
				<h1>{post.title}</h1>
				{post.publishedAt && (
					<time dateTime={new Date(post.publishedAt).toISOString()}>
						{new Date(post.publishedAt).toLocaleDateString()}
					</time>
				)}
				<div
					className="prose"
					// biome-ignore lint/security/noDangerouslySetInnerHtml: Server-rendered MDX HTML
					dangerouslySetInnerHTML={{ __html: html }}
				/>
			</article>
		</main>
	);
}
