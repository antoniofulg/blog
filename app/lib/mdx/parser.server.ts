import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import matter from "gray-matter";
import type { PostFrontmatter } from "#/types/content";

export async function parseFrontmatter(
	filePath: string,
): Promise<PostFrontmatter> {
	const source = await readFile(filePath, "utf-8");
	const { data } = matter(source);

	let publishedAt: string | undefined;
	if (data.publishedAt != null) {
		// gray-matter auto-parses YAML date fields as JS Date objects
		publishedAt =
			data.publishedAt instanceof Date
				? data.publishedAt.toISOString().slice(0, 10)
				: String(data.publishedAt);
	}

	return {
		title: data.title as string,
		description: data.description as string | undefined,
		publishedAt,
		slug:
			(data.slug as string | undefined) ??
			basename(filePath, extname(filePath)),
	};
}
