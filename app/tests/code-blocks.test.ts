import { describe, expect, it } from "vitest";
import { findFirstCodeBlock } from "#/lib/mdx/code-blocks.server";

// ---------------------------------------------------------------------------
// Unit tests: findFirstCodeBlock
// ---------------------------------------------------------------------------

describe("findFirstCodeBlock", () => {
	it("AC-1: returns { lang, code } for a TypeScript code block with explicit lang", () => {
		const mdx = "# Title\n\n```ts\nconst x = 1;\n```\n";
		const result = findFirstCodeBlock(mdx);
		expect(result).not.toBeNull();
		expect(result?.lang).toBe("ts");
		expect(result?.code).toBe("const x = 1;");
	});

	it("AC-2: returns null when MDX source has no code blocks", () => {
		const mdx = "# Title\n\nJust a paragraph with no code.\n";
		const result = findFirstCodeBlock(mdx);
		expect(result).toBeNull();
	});

	it("AC-3: returns lang='text' when the fence has no language label", () => {
		const mdx = "# Title\n\n```\nhello world\n```\n";
		const result = findFirstCodeBlock(mdx);
		expect(result).not.toBeNull();
		expect(result?.lang).toBe("text");
		expect(result?.code).toBe("hello world");
	});

	it("returns the FIRST code block when multiple are present", () => {
		const mdx = [
			"# Title",
			"",
			"```ts",
			"const first = 1;",
			"```",
			"",
			"```js",
			"const second = 2;",
			"```",
			"",
		].join("\n");
		const result = findFirstCodeBlock(mdx);
		expect(result?.lang).toBe("ts");
		expect(result?.code).toBe("const first = 1;");
	});

	it("handles MDX with JSX content without throwing", () => {
		const mdx = [
			"import { Foo } from './foo'",
			"",
			"# Title",
			"",
			"<Foo bar={42} />",
			"",
			"```python",
			"print('hello')",
			"```",
		].join("\n");
		expect(() => findFirstCodeBlock(mdx)).not.toThrow();
		const result = findFirstCodeBlock(mdx);
		expect(result?.lang).toBe("python");
		expect(result?.code).toBe("print('hello')");
	});

	it("handles MDX with only JSX and no code blocks without throwing", () => {
		const mdx = [
			"import { Component } from './Component'",
			"",
			"<Component />",
			"",
			"Some text.",
		].join("\n");
		expect(() => findFirstCodeBlock(mdx)).not.toThrow();
		expect(findFirstCodeBlock(mdx)).toBeNull();
	});

	it("returns null for an empty MDX source", () => {
		expect(findFirstCodeBlock("")).toBeNull();
	});

	it("returns null for frontmatter-only MDX", () => {
		const mdx = "---\ntitle: My Post\n---\n\nJust text, no code.\n";
		expect(findFirstCodeBlock(mdx)).toBeNull();
	});

	it("code value preserves internal indentation", () => {
		const mdx = "```ts\nfunction foo() {\n  return 1;\n}\n```\n";
		const result = findFirstCodeBlock(mdx);
		expect(result?.code).toBe("function foo() {\n  return 1;\n}");
	});
});
