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

export const getAllPosts = createServerFn({ method: "GET" }).handler(
	async () => {
		await requireSession();
		return getAllPostsFn();
	},
);
