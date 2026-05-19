import { readFile } from "node:fs/promises";
import type {
	MdxJsxAttribute,
	MdxJsxFlowElement,
	MdxJsxTextElement,
} from "mdast-util-mdx-jsx";
import remarkMdx from "remark-mdx";
import remarkParse from "remark-parse";
import { unified } from "unified";
import { visit } from "unist-util-visit";

export type Link = {
	href: string;
	line: number;
	column: number;
	kind: "markdown" | "jsx";
};

function nodeStart(
	position: { start: { line: number; column: number } } | undefined,
) {
	if (!position) return { line: 0, column: 0 };
	return position.start;
}

function extractHrefFromJsxNode(
	node: MdxJsxFlowElement | MdxJsxTextElement,
	filePath: string,
): string | null {
	const hrefAttr = node.attributes.find(
		(attr): attr is MdxJsxAttribute =>
			attr.type === "mdxJsxAttribute" && attr.name === "href",
	);
	if (!hrefAttr) return null;

	if (typeof hrefAttr.value === "string") {
		return hrefAttr.value;
	}

	if (hrefAttr.value?.type === "mdxJsxAttributeValueExpression") {
		const raw = hrefAttr.value.value.trim();
		// Extract literal: "...", '...', or `...` (no nested quotes)
		const match = raw.match(/^["'`]([^"'`]*)["'`]$/);
		if (match) {
			return match[1];
		}
		// Dynamic expression — cannot resolve statically
		console.warn(
			`[link-parser] dynamic href expression skipped at ${filePath}:${node.position?.start.line ?? 0}`,
		);
		return null;
	}

	return null;
}

function collectJsxLink(
	links: Link[],
	node: MdxJsxFlowElement | MdxJsxTextElement,
	filePath: string,
): void {
	if (node.name !== "a" && node.name !== "Link") return;
	const href = extractHrefFromJsxNode(node, filePath);
	if (href === null) return;
	const { line, column } = nodeStart(node.position);
	links.push({ href, line, column, kind: "jsx" });
}

export async function extractLinks(filePath: string): Promise<Link[]> {
	const content = await readFile(filePath, "utf-8");
	const processor = unified().use(remarkParse).use(remarkMdx);
	const tree = processor.parse(content);

	const links: Link[] = [];

	visit(tree, "link", (node) => {
		const { line, column } = nodeStart(node.position);
		links.push({ href: node.url, line, column, kind: "markdown" });
	});

	visit(tree, "mdxJsxFlowElement", (node) => {
		collectJsxLink(links, node as MdxJsxFlowElement, filePath);
	});

	visit(tree, "mdxJsxTextElement", (node) => {
		collectJsxLink(links, node as MdxJsxTextElement, filePath);
	});

	return links;
}
