import { glob } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extractLinks } from "#/lib/content-audit/link-parser.server";

const FIXTURES = path.resolve(import.meta.dirname, "fixtures/link-parser");

function fix(name: string) {
	return path.join(FIXTURES, name);
}

describe("link-parser: markdown links", () => {
	it("extracts internal markdown link with correct href, line, column", async () => {
		const links = await extractLinks(fix("markdown-links.mdx"));
		const internal = links.find((l) => l.href === "/foo");
		expect(internal).toBeDefined();
		expect(internal?.kind).toBe("markdown");
		expect(internal?.line).toBeGreaterThan(0);
		expect(internal?.column).toBeGreaterThan(0);
	});

	it("extracts external markdown link", async () => {
		const links = await extractLinks(fix("markdown-links.mdx"));
		const external = links.find((l) => l.href === "https://example.com");
		expect(external).toBeDefined();
		expect(external?.kind).toBe("markdown");
	});

	it("extracts fragment-only markdown link", async () => {
		const links = await extractLinks(fix("markdown-links.mdx"));
		const frag = links.find((l) => l.href === "#section");
		expect(frag).toBeDefined();
		expect(frag?.kind).toBe("markdown");
	});

	it("extracts relative markdown link", async () => {
		const links = await extractLinks(fix("markdown-links.mdx"));
		const rel = links.find((l) => l.href === "../other");
		expect(rel).toBeDefined();
		expect(rel?.kind).toBe("markdown");
	});
});

describe("link-parser: JSX Link component", () => {
	it("extracts block <Link href='/bar'> with correct href and kind", async () => {
		const links = await extractLinks(fix("jsx-link.mdx"));
		const block = links.find((l) => l.href === "/bar");
		expect(block).toBeDefined();
		expect(block?.kind).toBe("jsx");
		expect(block?.line).toBeGreaterThan(0);
	});

	it("extracts inline <Link href='/inline-bar'>", async () => {
		const links = await extractLinks(fix("jsx-link.mdx"));
		const inline = links.find((l) => l.href === "/inline-bar");
		expect(inline).toBeDefined();
		expect(inline?.kind).toBe("jsx");
	});
});

describe("link-parser: JSX anchor element", () => {
	it("extracts block <a href='https://example.com'>", async () => {
		const links = await extractLinks(fix("jsx-a.mdx"));
		const external = links.find((l) => l.href === "https://example.com");
		expect(external).toBeDefined();
		expect(external?.kind).toBe("jsx");
	});

	it("extracts inline <a href='/internal'>", async () => {
		const links = await extractLinks(fix("jsx-a.mdx"));
		const internal = links.find((l) => l.href === "/internal");
		expect(internal).toBeDefined();
		expect(internal?.kind).toBe("jsx");
	});
});

describe("link-parser: JSX expression attributes", () => {
	it("extracts literal double-quoted expression href={'/expr-foo'}", async () => {
		const links = await extractLinks(fix("expression-attr.mdx"));
		const link = links.find((l) => l.href === "/expr-foo");
		expect(link).toBeDefined();
		expect(link?.kind).toBe("jsx");
	});

	it("extracts literal single-quoted expression href={'single-quoted'}", async () => {
		const links = await extractLinks(fix("expression-attr.mdx"));
		const link = links.find((l) => l.href === "single-quoted");
		expect(link).toBeDefined();
		expect(link?.kind).toBe("jsx");
	});

	it("returns skipped-dynamic link for dynamic href={someVar}", async () => {
		const links = await extractLinks(fix("expression-attr.mdx"));
		const dynamic = links.find((l) => l.kind === "skipped-dynamic");
		expect(dynamic).toBeDefined();
		expect(dynamic?.href).toBe("");
		expect(dynamic?.line).toBeGreaterThan(0);
	});

	it("does not include variable name as href for dynamic expression", async () => {
		const links = await extractLinks(fix("expression-attr.mdx"));
		const byVarName = links.find((l) => l.href === "someVar");
		expect(byVarName).toBeUndefined();
	});
});

describe("link-parser: edge cases", () => {
	it("returns [] for file with no links", async () => {
		const links = await extractLinks(fix("empty.mdx"));
		expect(links).toEqual([]);
	});

	it("handles mixed file: returns all link kinds", async () => {
		const links = await extractLinks(fix("mixed.mdx"));
		const hrefs = links.map((l) => l.href);
		expect(hrefs).toContain("/mixed-internal");
		expect(hrefs).toContain("https://example.com/mixed");
		expect(hrefs).toContain("/mixed-jsx");
		expect(hrefs).toContain("mailto:hello@example.com");
		expect(hrefs).toContain("#top");
	});

	it("ignores JSX elements with boolean href attribute (null value)", async () => {
		const links = await extractLinks(fix("no-href.mdx"));
		// <a href> has null value — must not produce a link
		const booleanHref = links.find((l) => l.href === "true");
		expect(booleanHref).toBeUndefined();
	});

	it("ignores JSX elements with no href attribute", async () => {
		const links = await extractLinks(fix("no-href.mdx"));
		// <Link> with no attributes — must return empty
		expect(links.length).toBe(0);
	});

	it("ignores JSX elements that are not 'a' or 'Link'", async () => {
		const links = await extractLinks(fix("no-href.mdx"));
		// <Button href="/ignored"> — must not produce a link
		const buttonLink = links.find((l) => l.href === "/ignored");
		expect(buttonLink).toBeUndefined();
	});
});

describe("link-parser: integration — whole tree parse", () => {
	it("walks app/content/posts/** without throwing and returns arrays", async () => {
		const postsDir = path.resolve(
			import.meta.dirname,
			"../../app/content/posts",
		);
		const files: string[] = [];
		for await (const f of glob("**/*.mdx", { cwd: postsDir })) {
			files.push(path.join(postsDir, f));
		}
		expect(files.length).toBeGreaterThan(0);
		for (const file of files) {
			const links = await extractLinks(file);
			expect(Array.isArray(links)).toBe(true);
		}
	});

	it("whole-tree parse completes in under 2 seconds", async () => {
		const postsDir = path.resolve(
			import.meta.dirname,
			"../../app/content/posts",
		);
		const files: string[] = [];
		for await (const f of glob("**/*.mdx", { cwd: postsDir })) {
			files.push(path.join(postsDir, f));
		}
		const start = Date.now();
		await Promise.all(files.map((f) => extractLinks(f)));
		const elapsed = Date.now() - start;
		expect(elapsed).toBeLessThan(2000);
	});
});
