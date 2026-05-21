import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

function extractMarkdownLinks(markdown: string): string[] {
	const linkPattern = /\[([^\]]+)\]\(([^)]+)\)/g;
	return [...markdown.matchAll(linkPattern)].map((m) => m[2]);
}

describe("content-doc-links: CONTENT.md ADR cross-references", () => {
	const contentMdPath = join(REPO_ROOT, "CONTENT.md");
	const contentMd = readFileSync(contentMdPath, "utf-8");
	const allLinks = extractMarkdownLinks(contentMd);
	const adrLinks = allLinks.filter((l) =>
		l.includes(".compozy/tasks/008-posts-publish-refactor/adrs/"),
	);

	it("CONTENT.md contains at least one ADR cross-reference link", () => {
		expect(adrLinks.length).toBeGreaterThan(0);
	});

	it("every ADR link in CONTENT.md resolves to an existing file", () => {
		for (const link of adrLinks) {
			const absolutePath = join(REPO_ROOT, link);
			expect(
				existsSync(absolutePath),
				`ADR link target not found: ${link} (resolved: ${absolutePath})`,
			).toBe(true);
		}
	});

	it("ADR-001 is cross-referenced (static pages convention)", () => {
		const hasAdr001 = adrLinks.some((l) => l.includes("adr-001.md"));
		expect(hasAdr001).toBe(true);
	});

	it("ADR-003 is cross-referenced (language switcher UX)", () => {
		const hasAdr003 = adrLinks.some((l) => l.includes("adr-003.md"));
		expect(hasAdr003).toBe(true);
	});

	it("ADR-005 is cross-referenced (slug collision policy)", () => {
		const hasAdr005 = adrLinks.some((l) => l.includes("adr-005.md"));
		expect(hasAdr005).toBe(true);
	});
});
