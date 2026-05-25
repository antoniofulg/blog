import "@tanstack/react-start/server-only";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type CodeBlock = {
	lang: string;
	code: string;
};

/**
 * Walks an MDX source string and returns the first fenced code block found.
 *
 * Uses unified + remark-parse + remark-mdx (matching the pattern in
 * `app/lib/content-audit/link-parser.server.ts:72`).
 *
 * Returns `null` when no fenced code block is found.
 * Defaults `lang` to `"text"` when the fence has no language label.
 */
export function findFirstCodeBlock(mdxSource: string): CodeBlock | null {
	const processor = unified().use(remarkParse).use(remarkMdx);
	const tree = processor.parse(mdxSource);

	let result: CodeBlock | null = null;

	visit(tree, "code", (node: { lang?: string | null; value: string }) => {
		if (result !== null) return;
		result = {
			lang: node.lang ?? "text",
			code: node.value,
		};
	});

	return result;
}
