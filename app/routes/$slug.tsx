import { readFile } from "node:fs/promises";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { eq, sql } from "drizzle-orm";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";

export async function getPostBySlugFn(
	slug: string,
): Promise<{ post: Post; html: string }> {
	const [post] = await db.select().from(posts).where(eq(posts.slug, slug));

	if (!post || !post.isPublished) {
		throw notFound();
	}

	const source = await readFile(post.filePath, "utf-8");
	const { renderMdx } = await import("#/lib/mdx.server");
	const Content = await renderMdx(source);
	const html = renderToStaticMarkup(createElement(Content, {}));

	return { post, html };
}

export async function incrementViewCountFn(id: number): Promise<void> {
	await db
		.update(posts)
		.set({ viewCount: sql`view_count + 1` })
		.where(eq(posts.id, id));
}

const getPostBySlug = createServerFn({ method: "GET" })
	.inputValidator((slug: string) => slug)
	.handler(async ({ data: slug }) => getPostBySlugFn(slug));

const incrementViewCount = createServerFn({ method: "POST" })
	.inputValidator((id: number) => id)
	.handler(async ({ data: id }) => incrementViewCountFn(id));

export const Route = createFileRoute("/$slug")({
	loader: async ({ params }) => {
		const data = await getPostBySlug({ data: params.slug });
		await incrementViewCount({ data: data.post.id });
		return data;
	},
	head: ({ loaderData }) => ({
		meta: [
			{ title: loaderData?.post?.title ?? "Blog" },
			...(loaderData?.post?.description
				? [{ name: "description", content: loaderData.post.description }]
				: []),
			...(loaderData?.post?.title
				? [{ property: "og:title", content: loaderData.post.title }]
				: []),
			...(loaderData?.post?.description
				? [
						{
							property: "og:description",
							content: loaderData.post.description,
						},
					]
				: []),
		],
	}),
	component: PostDetail,
	notFoundComponent: () => (
		<main>
			<h1>Post not found</h1>
		</main>
	),
});

function PostDetail() {
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
