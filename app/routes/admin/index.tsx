import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { getRequest } from "@tanstack/react-start/server";
import { desc, eq } from "drizzle-orm";
import { useState } from "react";
import { db } from "#/db/client";
import { type Post, posts } from "#/db/schema";
import { auth } from "#/lib/auth";

// ─── Server Functions ─────────────────────────────────────────────────────────

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

async function requireSession() {
	const session = await auth.api.getSession({ headers: getRequest().headers });
	if (!session?.user) throw new Response("Unauthorized", { status: 401 });
}

const getAllPosts = createServerFn({ method: "GET" }).handler(async () => {
	await requireSession();
	return getAllPostsFn();
});

const togglePublished = createServerFn({ method: "POST" })
	.inputValidator((input: { id: number; isPublished: boolean }) => input)
	.handler(async ({ data }) => {
		await requireSession();
		return togglePublishedFn(data.id, data.isPublished);
	});

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/")({
	beforeLoad: ({ context, location }) => {
		if (!context.auth.user) {
			throw redirect({
				to: "/login",
				search: { redirect: location.href },
			});
		}
	},
	loader: () => getAllPosts(),
	component: AdminDashboard,
});

// ─── Components ───────────────────────────────────────────────────────────────

function PostRow({ post }: { post: Post }) {
	const [isPublished, setIsPublished] = useState(post.isPublished);
	const [successMsg, setSuccessMsg] = useState<string | null>(null);

	const handleToggle = async () => {
		const next = !isPublished;
		try {
			await togglePublished({ data: { id: post.id, isPublished: next } });
			setIsPublished(next);
			setSuccessMsg(next ? "Published" : "Unpublished");
			setTimeout(() => setSuccessMsg(null), 2000);
		} catch {
			setSuccessMsg("Error — please try again");
			setTimeout(() => setSuccessMsg(null), 3000);
		}
	};

	return (
		<tr>
			<td>{post.title}</td>
			<td>{post.slug}</td>
			<td>
				<span data-status={isPublished ? "published" : "draft"}>
					{isPublished ? "Published" : "Draft"}
				</span>
				{successMsg && <span aria-live="polite"> — {successMsg}</span>}
			</td>
			<td>{post.viewCount}</td>
			<td>
				<button type="button" onClick={handleToggle}>
					{isPublished ? "Unpublish" : "Publish"}
				</button>{" "}
				<Link to="/admin/preview/$slug" params={{ slug: post.slug }}>
					Preview
				</Link>
			</td>
		</tr>
	);
}

function AdminDashboard() {
	const postList = Route.useLoaderData();

	return (
		<main>
			<h1>Admin Dashboard</h1>
			<table>
				<thead>
					<tr>
						<th>Title</th>
						<th>Slug</th>
						<th>Status</th>
						<th>Views</th>
						<th>Actions</th>
					</tr>
				</thead>
				<tbody>
					{postList.map((post) => (
						<PostRow key={post.id} post={post} />
					))}
				</tbody>
			</table>
		</main>
	);
}
