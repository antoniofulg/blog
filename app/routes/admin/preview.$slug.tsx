import { readFile } from "node:fs/promises";
import { createFileRoute, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { eq } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";
import { auth } from "#/lib/auth";

// ─── Server Functions ─────────────────────────────────────────────────────────

export async function getAdminPreviewFn(
	slug: string,
	// biome-ignore lint/suspicious/noExplicitAny: renderMdx injected by handler (server) or mock (tests)
	renderFn: (source: string) => Promise<any> = async () => () => null,
): Promise<{ post: Post; html: string }> {
	const [post] = await db.select().from(posts).where(eq(posts.slug, slug));
	if (!post) {
		throw new Response("Not found", { status: 404 });
	}
	const source = await readFile(post.filePath, "utf-8");
	const Content = await renderFn(source);
	const html = renderToStaticMarkup(createElement(Content, {}));
	return { post, html };
}

const getAdminPreview = createServerFn({ method: "GET" })
	.inputValidator((slug: string) => slug)
	.handler(async ({ data: slug }) => {
		const session = await auth.api.getSession({
			headers: getRequest().headers,
		});
		if (!session?.user) throw new Response("Unauthorized", { status: 401 });
		const { renderMdx } = await import("#/lib/mdx.server");
		return getAdminPreviewFn(slug, renderMdx);
	});

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
