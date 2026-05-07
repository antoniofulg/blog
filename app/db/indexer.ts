import { readdir, readFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { eq, like } from "drizzle-orm";
import matter from "gray-matter";
import { db } from "./client";
import { posts } from "./schema";

function parseFrontmatterBlock(
	source: string,
	filePath: string,
): {
	title: string;
	description?: string;
	publishedAt?: Date;
	slug?: string;
	category?: string;
	series?: string;
	seriesPart?: number;
	draft?: boolean;
} {
	const { data } = matter(source);
	if (!data.title)
		throw new Error(`Missing required frontmatter 'title' in ${filePath}`);
	const publishedAtRaw = data.publishedAt;
	const publishedAt: Date | undefined =
		publishedAtRaw instanceof Date
			? publishedAtRaw
			: publishedAtRaw != null
				? new Date(String(publishedAtRaw))
				: undefined;
	const seriesPartRaw = data.seriesPart;
	const seriesPart: number | undefined =
		seriesPartRaw != null ? parseInt(String(seriesPartRaw), 10) : undefined;
	return {
		title: data.title as string,
		description: data.description as string | undefined,
		publishedAt,
		slug: data.slug as string | undefined,
		category: data.category as string | undefined,
		series: data.series as string | undefined,
		seriesPart: Number.isNaN(seriesPart) ? undefined : seriesPart,
		draft: data.draft as boolean | undefined,
	};
}

function deriveSlug(filePath: string, frontmatterSlug?: string): string {
	if (frontmatterSlug) return frontmatterSlug;
	return basename(filePath, extname(filePath));
}

function deriveLang(filePath: string): string {
	return basename(dirname(filePath));
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
		const lang = deriveLang(filePath);
		const now = new Date();
		await db
			.insert(posts)
			.values({
				filePath,
				slug,
				lang,
				title: fm.title,
				description: fm.description ?? null,
				publishedAt: fm.publishedAt ?? null,
				isPublished: false,
				indexedAt: now,
				category: fm.category ?? null,
				series: fm.series ?? null,
				seriesPart: fm.seriesPart ?? null,
				draft: fm.draft ?? null,
			})
			.onConflictDoUpdate({
				target: posts.filePath,
				set: {
					slug,
					lang,
					title: fm.title,
					description: fm.description ?? null,
					publishedAt: fm.publishedAt ?? null,
					indexedAt: now,
					category: fm.category ?? null,
					series: fm.series ?? null,
					seriesPart: fm.seriesPart ?? null,
					draft: fm.draft ?? null,
				},
			});
		console.log(
			JSON.stringify({
				level: "INFO",
				action: "indexed",
				filePath,
				slug,
				lang,
				category: fm.category ?? null,
			}),
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
