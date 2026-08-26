import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const REPO_ROOT = resolve(import.meta.dirname, "../..");

// ADRs live under `.compozy/` which is gitignored (workflow artifact, local-only).
// CONTENT.md references ADRs by name/title only — file-existence checks would
// break on CI (fresh clone has no `.compozy/`). This test asserts the textual
// cross-references are still present so the doc keeps pointing the reader at
// the right decisions even though the file targets are local-only.

describe("content-doc-links: CONTENT.md ADR cross-references", () => {
	const contentMdPath = join(REPO_ROOT, "CONTENT.md");
	const contentMd = readFileSync(contentMdPath, "utf-8");

	test("CONTENT.md mentions at least one ADR by id", () => {
		expect(contentMd).toMatch(/ADR-\d{3}/);
	});

	test("ADR-001 is cross-referenced (static pages convention)", () => {
		expect(contentMd).toContain("ADR-001");
	});

	test("ADR-003 is cross-referenced (language switcher UX)", () => {
		expect(contentMd).toContain("ADR-003");
	});

	test("ADR-005 is cross-referenced (slug collision policy)", () => {
		expect(contentMd).toContain("ADR-005");
	});

	test("no CONTENT.md link points at .compozy/ (gitignored)", () => {
		expect(contentMd).not.toMatch(/\(\.compozy\//);
	});
});
