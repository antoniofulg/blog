import { createServerFn } from "@tanstack/react-start";
import type { Post } from "#/db/schema";
import { requireSession } from "#/lib/session";

export async function getAllPostsFn(): Promise<Post[]> {
	const [{ db }, { posts }, { desc, notLike }] = await Promise.all([
		import("#/db/client"),
		import("#/db/schema"),
		import("drizzle-orm"),
	]);
	// Exclude E2E fixture posts (slug prefix "e2e-") from the admin view —
	// they are authored as real MDX so global-setup can seed them via the
	// regular indexer, but they are not author content and should not clutter
	// the dashboard. See tests/e2e/seed.ts FIXTURE_PUBLIC_SLUG /
	// FIXTURE_EN_ONLY_SLUG / FIXTURE_POST_SLUG.
	return await db
		.select()
		.from(posts)
		.where(notLike(posts.slug, "e2e-%"))
		.orderBy(desc(posts.publishedAt));
}

export const getAllPosts = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();
		return getAllPostsFn();
	},
);
