import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
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

const getPublishedPosts = createServerFn({ method: "GET" }).handler(() =>
	getPublishedPostsFn(),
);

export const Route = createFileRoute("/")({
	loader: () => getPublishedPosts(),
	head: () => ({
		meta: [{ title: "Blog" }],
	}),
	component: PostList,
});

function PostList() {
	const postList = Route.useLoaderData();
	return (
		<main>
			<h1>Blog</h1>
			{postList.length === 0 && <p>No posts yet.</p>}
			{postList.map((post) => (
				<article key={post.id}>
					<h2>
						<Link to="/$slug" params={{ slug: post.slug }}>
							{post.title}
						</Link>
					</h2>
					{post.publishedAt && (
						<time dateTime={new Date(post.publishedAt).toISOString()}>
							{new Date(post.publishedAt).toLocaleDateString()}
						</time>
					)}
					{post.description && <p>{post.description}</p>}
				</article>
			))}
		</main>
	);
}
