import { createServerFn } from "@tanstack/react-start";
import type { Post } from "#/db/schema";
import { requireSession } from "#/lib/session";

export async function getAllPostsFn(): Promise<Post[]> {
	const [{ db }, { posts }, { desc }] = await Promise.all([
		import("#/db/client"),
		import("#/db/schema"),
		import("drizzle-orm"),
	]);
	return await db.select().from(posts).orderBy(desc(posts.indexedAt));
}

export async function togglePublishedFn(
	id: number,
	publish: boolean,
): Promise<void> {
	const [{ db }, { posts }, { eq }] = await Promise.all([
		import("#/db/client"),
		import("#/db/schema"),
		import("drizzle-orm"),
	]);
	if (publish) {
		const [post] = await db
			.select({ publishedAt: posts.publishedAt })
			.from(posts)
			.where(eq(posts.id, id));
		const publishedAt =
			post?.publishedAt != null ? post.publishedAt : new Date();
		await db.update(posts).set({ publishedAt }).where(eq(posts.id, id));
	} else {
		await db.update(posts).set({ publishedAt: null }).where(eq(posts.id, id));
	}
}

export const getAllPosts = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();
		return getAllPostsFn();
	},
);

export const togglePublished = createServerFn({ method: "POST" })
	.inputValidator((input: { id: number; publish: boolean }) => input)
	.handler(async ({ data }) => {
		await requireSession();
		return togglePublishedFn(data.id, data.publish);
	});
