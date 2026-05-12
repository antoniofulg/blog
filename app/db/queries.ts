import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";
import type { Locale } from "#/lib/locale";

export async function getPublishedPostsFn(lang: Locale): Promise<Post[]> {
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
