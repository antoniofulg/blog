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
	// they are authored as real MDX so the indexer picks them up, but they
	// are not author content and should not clutter the dashboard. The
	// Playwright server (scripts/e2e-server.ts) sets E2E_TEST=true so its
	// own fixtures remain visible to admin-write.spec.ts assertions.
	const isE2E = process.env.E2E_TEST === "true";
	const base = db.select().from(posts);
	const filtered = isE2E ? base : base.where(notLike(posts.slug, "e2e-%"));
	return await filtered.orderBy(desc(posts.publishedAt));
}

export const getAllPosts = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();
		return getAllPostsFn();
	},
);
