import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";

export async function getPublishedPostsFn(lang: string): Promise<Post[]> {
	return await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.isPublished, true),
				eq(posts.lang, lang),
				sql`${posts.draft} IS NOT TRUE`,
			),
		)
		.orderBy(desc(posts.publishedAt));
}
