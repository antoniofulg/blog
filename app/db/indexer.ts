import { readdir, readFile } from "node:fs/promises";
import { basename, extname, join } from "node:path";
import { eq, like } from "drizzle-orm";
import { db } from "./client";
import { posts } from "./schema";

interface PostFrontmatter {
	title: string;
	description?: string;
	publishedAt?: Date;
	slug?: string;
}

function parseFrontmatterBlock(
	source: string,
	filePath: string,
): PostFrontmatter {
	const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---/);
	if (!match) {
		throw new Error(`No frontmatter found in ${filePath}`);
	}
	const block = match[1];
	const get = (key: string): string | undefined => {
		const m = block.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
		return m ? m[1].trim() : undefined;
	};
	const title = get("title");
	if (!title)
		throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
	const description = get("description");
	const publishedAtRaw = get("publishedAt");
	const publishedAt = publishedAtRaw ? new Date(publishedAtRaw) : undefined;
	const slug = get("slug");
	return { title, description, publishedAt, slug };
}

function deriveSlug(filePath: string, frontmatterSlug?: string): string {
	if (frontmatterSlug) return frontmatterSlug;
	return basename(filePath, extname(filePath));
}

async function findMdxFiles(dir: string): Promise<string[]> {
	const results: string[] = [];
	async function walk(current: string): Promise<void> {
		const entries = await readdir(current, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(current, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.name.endsWith(".mdx")) {
				results.push(full);
			}
		}
	}
	await walk(dir);
	return results;
}

export async function upsertPost(filePath: string): Promise<void> {
	try {
		const source = await readFile(filePath, "utf8");
		const fm = parseFrontmatterBlock(source, filePath);
		const slug = deriveSlug(filePath, fm.slug);
		const now = new Date();
		await db
			.insert(posts)
			.values({
				filePath,
				slug,
				title: fm.title,
				description: fm.description ?? null,
				publishedAt: fm.publishedAt ?? null,
				isPublished: false,
				indexedAt: now,
			})
			.onConflictDoUpdate({
				target: posts.filePath,
				set: {
					slug,
					title: fm.title,
					description: fm.description ?? null,
					publishedAt: fm.publishedAt ?? null,
					indexedAt: now,
				},
			});
		console.log(
			JSON.stringify({ level: "INFO", action: "indexed", filePath, slug }),
		);
	} catch (err) {
		console.error(
			JSON.stringify({
				level: "ERROR",
				action: "index_error",
				filePath,
				error: String(err),
			}),
		);
		throw err;
	}
}

export async function removePost(filePath: string): Promise<void> {
	try {
		await db.delete(posts).where(eq(posts.filePath, filePath));
		console.log(JSON.stringify({ level: "INFO", action: "removed", filePath }));
	} catch (err) {
		console.error(
			JSON.stringify({
				level: "ERROR",
				action: "remove_error",
				filePath,
				error: String(err),
			}),
		);
		throw err;
	}
}

export async function syncAll(contentDir: string): Promise<void> {
	const files = await findMdxFiles(contentDir);
	for (const filePath of files) {
		await upsertPost(filePath);
	}
	const rows = await db
		.select({ filePath: posts.filePath })
		.from(posts)
		.where(like(posts.filePath, `${contentDir}/%`));
	const fileSet = new Set(files);
	for (const row of rows) {
		if (!fileSet.has(row.filePath)) {
			await removePost(row.filePath);
		}
	}
}
