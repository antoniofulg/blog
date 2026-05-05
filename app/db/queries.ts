import { desc, eq } from "drizzle-orm";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";

export async function getPublishedPostsFn(): Promise<Post[]> {
	return await db
		.select()
		.from(posts)
		.where(eq(posts.isPublished, true))
		.orderBy(desc(posts.publishedAt));
}
