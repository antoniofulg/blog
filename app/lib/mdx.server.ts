import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import { compile, run } from "@mdx-js/mdx";
import rehypeShiki from "@shikijs/rehype";
import matter from "gray-matter";
import type { ComponentType } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";

export interface PostFrontmatter {
	title: string;
	description?: string;
	publishedAt?: string;
	slug?: string;
}

export async function parseFrontmatter(
	filePath: string,
): Promise<PostFrontmatter> {
	const source = await readFile(filePath, "utf-8");
	const { data } = matter(source);
	return {
		title: data.title as string,
		description: data.description as string | undefined,
		publishedAt:
			data.publishedAt != null ? String(data.publishedAt) : undefined,
		slug:
			(data.slug as string | undefined) ??
			basename(filePath, extname(filePath)),
	};
}

export async function renderMdx(source: string): Promise<ComponentType> {
	const compiled = await compile(source, {
		outputFormat: "function-body",
		remarkPlugins: [remarkGfm],
		rehypePlugins: [[rehypeShiki, { theme: "github-dark" }]],
	});
	const { default: Content } = await run(compiled, {
		...runtime,
		baseUrl: import.meta.url,
	});
	return Content as ComponentType;
}
