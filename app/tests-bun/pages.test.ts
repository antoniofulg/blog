import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import * as realFs from "node:fs";
import * as realPromises from "node:fs/promises";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const realReadFile = realPromises.readFile;
const realReaddir = realPromises.readdir;
const realExistsSync = realFs.existsSync;

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = (() => {
	const readFile = jest.fn().mockResolvedValue("");
	const readdir = jest.fn<() => Promise<string[]>>().mockResolvedValue([]);
	const existsSync = jest.fn().mockReturnValue(false);
	const renderMdx = jest.fn().mockResolvedValue(() => null);
	return { readFile, readdir, existsSync, renderMdx };
})();

mock.module("node:fs", () => ({
	...realFs,
	existsSync: mocks.existsSync,
}));

mock.module("node:fs/promises", () => ({
	...realPromises,
	readFile: mocks.readFile,
	readdir: mocks.readdir,
}));

mock.module("#/lib/mdx/renderer.server", () => ({
	renderMdx: mocks.renderMdx,
}));

const { enumerateStaticPages, loadStaticPage, staticPageHasTwin } =
	await import("#/lib/mdx/pages.server");

import type { PageEntry, PageFrontmatter } from "#/lib/mdx/pages.server";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const ABOUT_MDX = `---
title: About
description: About this blog
---

Some **about** content.
`;

const NO_TITLE_MDX = `---
description: Missing title
---

Body.
`;

// ─── Unit: loadStaticPage ─────────────────────────────────────────────────────

describe("unit: loadStaticPage", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	test("happy path: returns entry and html for a fixture page", async () => {
		mocks.readFile.mockResolvedValue(ABOUT_MDX);
		mocks.renderMdx.mockResolvedValue(() => null);

		const result = await loadStaticPage("about", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.slug).toBe("about");
		expect(result?.entry.locale).toBe("en");
		expect(result?.entry.frontmatter.title).toBe("About");
		expect(result?.entry.frontmatter.description).toBe("About this blog");
		expect(typeof result?.html).toBe("string");
		expect(result?.entry.filePath).toContain("about.mdx");
	});

	test("happy path: omits description when not present in frontmatter", async () => {
		mocks.readFile.mockResolvedValue(`---\ntitle: Minimal\n---\nBody.`);

		const result = await loadStaticPage("minimal", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.frontmatter.description).toBeUndefined();
	});

	test("missing file: returns null without throwing", async () => {
		mocks.readFile.mockRejectedValue(
			Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
		);

		const result = await loadStaticPage("nope", "en");

		expect(result).toBeNull();
	});

	test("missing title: throws (Zod parse error)", async () => {
		mocks.readFile.mockResolvedValue(NO_TITLE_MDX);

		await expect(loadStaticPage("no-title", "en")).rejects.toThrow();
	});

	test("path traversal '../etc/forbidden.txt': returns null", async () => {
		const result = await loadStaticPage("../etc/forbidden.txt", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	test("path traversal '/etc/forbidden.txt': returns null", async () => {
		const result = await loadStaticPage("/etc/forbidden.txt", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	test("path traversal slug with null byte: returns null", async () => {
		const result = await loadStaticPage("valid\x00bad", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	test("path traversal slug with backslash: returns null", async () => {
		const result = await loadStaticPage("a\\b", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	test("path traversal slug with double dot only: returns null", async () => {
		const result = await loadStaticPage("..", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	test("pt-br locale: resolves to pt-br path", async () => {
		mocks.readFile.mockResolvedValue(ABOUT_MDX);

		const result = await loadStaticPage("about", "pt-br");

		expect(result).not.toBeNull();
		expect(result?.entry.locale).toBe("pt-br");
		expect(result?.entry.filePath).toContain("pt-br");
	});
});

// ─── Unit: staticPageHasTwin ─────────────────────────────────────────────────

describe("unit: staticPageHasTwin", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	test("returns true when twin file exists", () => {
		mocks.existsSync.mockReturnValue(true);

		const result = staticPageHasTwin("about", "pt-br");

		expect(result).toBe(true);
		expect(mocks.existsSync).toHaveBeenCalled();
	});

	test("returns false when twin file does not exist", () => {
		mocks.existsSync.mockReturnValue(false);

		const result = staticPageHasTwin("only-en", "pt-br");

		expect(result).toBe(false);
	});

	test("checks the target locale path, not current locale", () => {
		mocks.existsSync.mockReturnValue(false);

		staticPageHasTwin("about", "pt-br");

		const calledPath = mocks.existsSync.mock.calls[0][0] as string;
		expect(calledPath).toContain("pt-br");
	});

	test("returns false for unsafe slugs without calling existsSync", () => {
		mocks.existsSync.mockClear();

		const result = staticPageHasTwin("../etc/forbidden.txt", "pt-br");

		expect(result).toBe(false);
		expect(mocks.existsSync).not.toHaveBeenCalled();
	});
});

// ─── Unit: enumerateStaticPages ───────────────────────────────────────────────

describe("unit: enumerateStaticPages", () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});
	test("returns one PageEntry per .mdx file", async () => {
		mocks.readdir.mockResolvedValue(["about.mdx", "uses.mdx"]);
		mocks.readFile.mockImplementation(async (path: unknown) => {
			if ((path as string).includes("about"))
				return `---\ntitle: About\n---\nBody.`;
			return `---\ntitle: Uses\ndescription: What I use\n---\nBody.`;
		});

		const entries = await enumerateStaticPages("en");

		expect(entries).toHaveLength(2);
		expect(entries[0].slug).toBe("about");
		expect(entries[1].slug).toBe("uses");
		expect(entries[1].frontmatter.description).toBe("What I use");
	});

	test("skips non-mdx files", async () => {
		mocks.readdir.mockResolvedValue(["about.mdx", "README.md", ".DS_Store"]);
		mocks.readFile.mockResolvedValue(`---\ntitle: About\n---\nBody.`);

		const entries = await enumerateStaticPages("en");

		expect(entries).toHaveLength(1);
		expect(entries[0].slug).toBe("about");
	});

	test("skips files with missing title", async () => {
		mocks.readdir.mockResolvedValue(["valid.mdx", "no-title.mdx"]);
		mocks.readFile.mockImplementation(async (path: unknown) => {
			if ((path as string).includes("valid"))
				return `---\ntitle: Valid\n---\nBody.`;
			return NO_TITLE_MDX;
		});

		const entries = await enumerateStaticPages("en");

		expect(entries).toHaveLength(1);
		expect(entries[0].slug).toBe("valid");
	});

	test("returns empty array when directory does not exist", async () => {
		mocks.readdir.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);

		const entries = await enumerateStaticPages("en");

		expect(entries).toEqual([]);
	});

	test("returns empty array when directory is empty", async () => {
		mocks.readdir.mockResolvedValue([]);

		const entries = await enumerateStaticPages("pt-br");

		expect(entries).toEqual([]);
	});

	test("includes the locale and filePath in each entry", async () => {
		mocks.readdir.mockResolvedValue(["about.mdx"]);
		mocks.readFile.mockResolvedValue(`---\ntitle: About\n---\nBody.`);

		const entries = await enumerateStaticPages("pt-br");

		expect(entries[0].locale).toBe("pt-br");
		expect(entries[0].filePath).toContain("pt-br");
		expect(entries[0].filePath).toContain("about.mdx");
	});
});

// ─── Integration: loadStaticPage round-trip (real filesystem) ─────────────────

describe("integration: loadStaticPage round-trip", () => {
	let tmpDir: string;
	let cwdSpy: ReturnType<typeof jest.spyOn>;

	beforeAll(async () => {
		// Create a tmpdir and lay down the expected directory structure.
		tmpDir = await mkdtemp(join(tmpdir(), "pages-integ-"));
		const pagesEnDir = join(tmpDir, "app", "content", "pages", "en");
		const pagesPtBrDir = join(tmpDir, "app", "content", "pages", "pt-br");
		await mkdir(pagesEnDir, { recursive: true });
		await mkdir(pagesPtBrDir, { recursive: true });

		await writeFile(
			join(pagesEnDir, "test.mdx"),
			`---\ntitle: Integration Test\ndescription: Test description\n---\n\nHello from the **integration test**.\n`,
			"utf-8",
		);

		// Redirect process.cwd() to tmpDir so the module resolves paths there.
		cwdSpy = jest.spyOn(process, "cwd").mockReturnValue(tmpDir);

		// Use real fs implementations for this describe block.
		mocks.readFile.mockImplementation(realReadFile as never);
		mocks.readdir.mockImplementation(realReaddir as never);
	});

	afterAll(async () => {
		cwdSpy?.mockRestore();
		// Restore unit-test defaults.
		mocks.readFile.mockResolvedValue("");
		mocks.readdir.mockResolvedValue([]);
		await rm(tmpDir, { recursive: true, force: true });
	});

	test("reads a real .mdx file and returns entry with parsed frontmatter", async () => {
		const result = await loadStaticPage("test", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.slug).toBe("test");
		expect(result?.entry.locale).toBe("en");
		expect(result?.entry.frontmatter.title).toBe("Integration Test");
		expect(result?.entry.frontmatter.description).toBe("Test description");
	});

	test("returns html string (renderMdx mocked to null component produces empty string)", async () => {
		const result = await loadStaticPage("test", "en");

		expect(typeof result?.html).toBe("string");
	});

	test("returns null for a slug that has no file in tmpDir", async () => {
		const result = await loadStaticPage("nonexistent", "en");

		expect(result).toBeNull();
	});

	test("staticPageHasTwin returns false when pt-br twin does not exist in tmpDir", async () => {
		mocks.existsSync.mockImplementation(realExistsSync);

		const result = staticPageHasTwin("test", "pt-br");

		expect(result).toBe(false); // no file written to pt-br dir

		mocks.existsSync.mockReturnValue(false);
	});

	test("enumerateStaticPages lists real files in tmpDir", async () => {
		const entries = await enumerateStaticPages("en");

		expect(entries).toHaveLength(1);
		expect(entries[0].slug).toBe("test");
		expect(entries[0].frontmatter.title).toBe("Integration Test");
	});
});

// ─── Type exports ────────────────────────────────────────────────────────────

describe("unit: exported types are structurally correct", () => {
	test("PageEntry shape satisfies expected fields", () => {
		const entry: PageEntry = {
			slug: "about",
			locale: "en",
			filePath: "/some/path/about.mdx",
			frontmatter: { title: "About" },
		};
		expect(entry.slug).toBe("about");
	});

	test("PageFrontmatter allows optional description", () => {
		const fm: PageFrontmatter = { title: "Title" };
		expect(fm.description).toBeUndefined();
	});
});
