import { desc, eq } from "drizzle-orm";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";

export async function getAllPostsFn(): Promise<Post[]> {
	return await db.select().from(posts).orderBy(desc(posts.indexedAt));
}

export async function togglePublishedFn(
	id: number,
	isPublished: boolean,
): Promise<void> {
	if (isPublished) {
		const [post] = await db
			.select({ publishedAt: posts.publishedAt })
			.from(posts)
			.where(eq(posts.id, id));
		const publishedAt =
			post?.publishedAt != null ? post.publishedAt : new Date();
		await db
			.update(posts)
			.set({ isPublished: true, publishedAt })
			.where(eq(posts.id, id));
	} else {
		await db.update(posts).set({ isPublished: false }).where(eq(posts.id, id));
	}
}
