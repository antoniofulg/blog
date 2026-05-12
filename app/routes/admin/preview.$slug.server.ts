import { createServerFn } from "@tanstack/react-start";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import type { Post } from "#/db/schema";
import { renderMdx } from "#/lib/mdx/renderer.server";
import { requireSession } from "#/lib/session";

export async function getAdminPreviewFn(
	slug: string,
	// biome-ignore lint/suspicious/noExplicitAny: renderMdx injected by handler (server) or mock (tests)
	renderFn: (source: string) => Promise<any> = async () => () => null,
): Promise<{ post: Post; html: string }> {
	const [{ readFile }, { db }, { posts }, { eq }] = await Promise.all([
		import("node:fs/promises"),
		import("#/db/client"),
		import("#/db/schema"),
		import("drizzle-orm"),
	]);
	const [post] = await db.select().from(posts).where(eq(posts.slug, slug));
	if (!post) {
		throw new Response("Not found", { status: 404 });
	}
	const source = await readFile(post.filePath, "utf-8");
	const Content = await renderFn(source);
	const html = renderToStaticMarkup(createElement(Content, {}));
	return { post, html };
}

export const getAdminPreview = createServerFn({ method: "GET" })
	.inputValidator((slug: string) => slug)
	.handler(async ({ data: slug }) => {
		await requireSession();
		return getAdminPreviewFn(slug, renderMdx);
	});
