import { and, desc, eq, notLike, sql } from "drizzle-orm";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";
import type { Locale } from "#/lib/locale";

// E2e fixtures live in app/content/posts/ so the e2e suite can drive the real
// loader path through them, but they must never surface in public listings
// (home page, RSS, sitemap). All fixture slugs are namespaced with the `e2e-`
// prefix — exclude that prefix here.
const E2E_FIXTURE_SLUG_PREFIX = "e2e-%";

export async function listPostsFn(lang: Locale): Promise<Post[]> {
	return await db
		.select()
		.from(posts)
		.where(
			and(
				eq(posts.lang, lang),
				sql`${posts.draft} IS NOT TRUE`,
				notLike(posts.slug, E2E_FIXTURE_SLUG_PREFIX),
			),
		)
		.orderBy(desc(posts.publishedAt));
}
