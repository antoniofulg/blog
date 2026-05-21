import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const readFile = vi.fn().mockResolvedValue("");
	const readdir = vi.fn<() => Promise<string[]>>().mockResolvedValue([]);
	const existsSync = vi.fn().mockReturnValue(false);
	const renderMdx = vi.fn().mockResolvedValue(() => null);
	return { readFile, readdir, existsSync, renderMdx };
});

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		readFile: mocks.readFile,
		readdir: mocks.readdir,
	};
});

vi.mock("node:fs", () => ({
	existsSync: mocks.existsSync,
}));

vi.mock("#/lib/mdx/renderer.server", () => ({
	renderMdx: mocks.renderMdx,
}));

import {
	enumerateStaticPages,
	loadStaticPage,
	type PageEntry,
	type PageFrontmatter,
	staticPageHasTwin,
} from "#/lib/mdx/pages.server";

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
		vi.clearAllMocks();
	});
	it("happy path: returns entry and html for a fixture page", async () => {
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

	it("happy path: omits description when not present in frontmatter", async () => {
		mocks.readFile.mockResolvedValue(`---\ntitle: Minimal\n---\nBody.`);

		const result = await loadStaticPage("minimal", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.frontmatter.description).toBeUndefined();
	});

	it("missing file: returns null without throwing", async () => {
		mocks.readFile.mockRejectedValue(
			Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
		);

		const result = await loadStaticPage("nope", "en");

		expect(result).toBeNull();
	});

	it("missing title: throws error with file path in message", async () => {
		mocks.readFile.mockResolvedValue(NO_TITLE_MDX);

		await expect(loadStaticPage("no-title", "en")).rejects.toThrow(
			"Missing required frontmatter 'title'",
		);
	});

	it("path traversal '../etc/forbidden.txt': returns null", async () => {
		const result = await loadStaticPage("../etc/forbidden.txt", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	it("path traversal '/etc/forbidden.txt': returns null", async () => {
		const result = await loadStaticPage("/etc/forbidden.txt", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	it("path traversal slug with null byte: returns null", async () => {
		const result = await loadStaticPage("valid\x00bad", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	it("path traversal slug with backslash: returns null", async () => {
		const result = await loadStaticPage("a\\b", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	it("path traversal slug with double dot only: returns null", async () => {
		const result = await loadStaticPage("..", "en");
		expect(result).toBeNull();
		expect(mocks.readFile).not.toHaveBeenCalled();
	});

	it("pt-br locale: resolves to pt-br path", async () => {
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
		vi.clearAllMocks();
	});
	it("returns true when twin file exists", () => {
		mocks.existsSync.mockReturnValue(true);

		const result = staticPageHasTwin("about", "pt-br");

		expect(result).toBe(true);
		expect(mocks.existsSync).toHaveBeenCalled();
	});

	it("returns false when twin file does not exist", () => {
		mocks.existsSync.mockReturnValue(false);

		const result = staticPageHasTwin("only-en", "pt-br");

		expect(result).toBe(false);
	});

	it("checks the target locale path, not current locale", () => {
		mocks.existsSync.mockReturnValue(false);

		staticPageHasTwin("about", "pt-br");

		const calledPath = mocks.existsSync.mock.calls[0][0] as string;
		expect(calledPath).toContain("pt-br");
	});

	it("returns false for unsafe slugs without calling existsSync", () => {
		mocks.existsSync.mockClear();

		const result = staticPageHasTwin("../etc/forbidden.txt", "pt-br");

		expect(result).toBe(false);
		expect(mocks.existsSync).not.toHaveBeenCalled();
	});
});

// ─── Unit: enumerateStaticPages ───────────────────────────────────────────────

describe("unit: enumerateStaticPages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});
	it("returns one PageEntry per .mdx file", async () => {
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

	it("skips non-mdx files", async () => {
		mocks.readdir.mockResolvedValue(["about.mdx", "README.md", ".DS_Store"]);
		mocks.readFile.mockResolvedValue(`---\ntitle: About\n---\nBody.`);

		const entries = await enumerateStaticPages("en");

		expect(entries).toHaveLength(1);
		expect(entries[0].slug).toBe("about");
	});

	it("skips files with missing title", async () => {
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

	it("returns empty array when directory does not exist", async () => {
		mocks.readdir.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);

		const entries = await enumerateStaticPages("en");

		expect(entries).toEqual([]);
	});

	it("returns empty array when directory is empty", async () => {
		mocks.readdir.mockResolvedValue([]);

		const entries = await enumerateStaticPages("pt-br");

		expect(entries).toEqual([]);
	});

	it("includes the locale and filePath in each entry", async () => {
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
	let cwdSpy: ReturnType<typeof vi.spyOn>;

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
		cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

		// Use real fs implementations for this describe block.
		const realFs =
			await vi.importActual<typeof import("node:fs/promises")>(
				"node:fs/promises",
			);
		vi.mocked(mocks.readFile).mockImplementation(realFs.readFile as never);
		vi.mocked(mocks.readdir).mockImplementation(realFs.readdir as never);
	});

	afterAll(async () => {
		cwdSpy?.mockRestore();
		// Restore unit-test defaults.
		vi.mocked(mocks.readFile).mockResolvedValue("");
		vi.mocked(mocks.readdir).mockResolvedValue([]);
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("reads a real .mdx file and returns entry with parsed frontmatter", async () => {
		const result = await loadStaticPage("test", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.slug).toBe("test");
		expect(result?.entry.locale).toBe("en");
		expect(result?.entry.frontmatter.title).toBe("Integration Test");
		expect(result?.entry.frontmatter.description).toBe("Test description");
	});

	it("returns html string (renderMdx mocked to null component produces empty string)", async () => {
		const result = await loadStaticPage("test", "en");

		expect(typeof result?.html).toBe("string");
	});

	it("returns null for a slug that has no file in tmpDir", async () => {
		const result = await loadStaticPage("nonexistent", "en");

		expect(result).toBeNull();
	});

	it("staticPageHasTwin returns false when pt-br twin does not exist in tmpDir", async () => {
		const realFs = await vi.importActual<typeof import("node:fs")>("node:fs");
		vi.mocked(mocks.existsSync).mockImplementation(realFs.existsSync);

		const result = staticPageHasTwin("test", "pt-br");

		expect(result).toBe(false); // no file written to pt-br dir

		vi.mocked(mocks.existsSync).mockReturnValue(false);
	});

	it("enumerateStaticPages lists real files in tmpDir", async () => {
		const entries = await enumerateStaticPages("en");

		expect(entries).toHaveLength(1);
		expect(entries[0].slug).toBe("test");
		expect(entries[0].frontmatter.title).toBe("Integration Test");
	});
});

// ─── Type exports ────────────────────────────────────────────────────────────

describe("unit: exported types are structurally correct", () => {
	it("PageEntry shape satisfies expected fields", () => {
		const entry: PageEntry = {
			slug: "about",
			locale: "en",
			filePath: "/some/path/about.mdx",
			frontmatter: { title: "About" },
		};
		expect(entry.slug).toBe("about");
	});

	it("PageFrontmatter allows optional description", () => {
		const fm: PageFrontmatter = { title: "Title" };
		expect(fm.description).toBeUndefined();
	});
});
