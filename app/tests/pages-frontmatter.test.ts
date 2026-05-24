import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";
import { z } from "zod";

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
	loadStaticPage,
	pageFrontmatterSchema,
	socialKindEnum,
} from "#/lib/mdx/pages.server";

// ─── Unit: pageFrontmatterSchema ─────────────────────────────────────────────

describe("unit: pageFrontmatterSchema", () => {
	it("AC-1: parse({ title: 'About' }) succeeds and returns { title: 'About' }", () => {
		const result = pageFrontmatterSchema.parse({ title: "About" });
		expect(result.title).toBe("About");
		// no extra declared fields leak into output
		expect(result.description).toBeUndefined();
		expect(result.avatar).toBeUndefined();
		expect(result.links).toBeUndefined();
	});

	it("AC-2: missing title throws ZodError referencing title path", () => {
		let caught: unknown;
		try {
			pageFrontmatterSchema.parse({});
		} catch (e) {
			caught = e;
		}
		expect(caught).toBeInstanceOf(z.ZodError);
		const zodErr = caught as z.ZodError;
		const titleIssue = zodErr.issues.find((issue) =>
			issue.path.includes("title"),
		);
		expect(titleIssue).toBeDefined();
	});

	it("AC-2: links with typo key (linkdin) throws", () => {
		expect(() =>
			pageFrontmatterSchema.parse({
				title: "About",
				links: { linkdin: "https://linkedin.com" },
			}),
		).toThrow();
	});

	it("AC-3: unknown field (tagline) flows through unchanged via passthrough", () => {
		const result = pageFrontmatterSchema.parse({
			title: "About",
			tagline: "Software Engineer",
		});
		expect(result.title).toBe("About");
		expect((result as Record<string, unknown>).tagline).toBe(
			"Software Engineer",
		);
	});

	it("nowUpdatedAt passthrough: unknown date field flows through", () => {
		const result = pageFrontmatterSchema.parse({
			title: "About",
			nowUpdatedAt: "2026-05-22",
		});
		expect((result as Record<string, unknown>).nowUpdatedAt).toBe("2026-05-22");
	});

	it("valid links with correct enum keys parse successfully", () => {
		const result = pageFrontmatterSchema.parse({
			title: "About",
			links: {
				github: "https://github.com/me",
				linkedin: "https://linkedin.com/in/me",
				email: "mailto:me@example.com",
			},
		});
		expect(result.links?.github).toBe("https://github.com/me");
		expect(result.links?.linkedin).toBe("https://linkedin.com/in/me");
		expect(result.links?.email).toBe("mailto:me@example.com");
	});

	it("all six social kinds are valid enum values", () => {
		const validKinds = ["github", "linkedin", "x", "instagram", "rss", "email"];
		for (const kind of validKinds) {
			expect(() => socialKindEnum.parse(kind)).not.toThrow();
		}
	});

	it("invalid social kind throws", () => {
		expect(() => socialKindEnum.parse("twitter")).toThrow();
		expect(() => socialKindEnum.parse("facebook")).toThrow();
	});

	it("avatar field propagates", () => {
		const result = pageFrontmatterSchema.parse({
			title: "About",
			avatar: "/about/profile.jpeg",
		});
		expect(result.avatar).toBe("/about/profile.jpeg");
	});

	it("avatarAlt parses as a string", () => {
		const result = pageFrontmatterSchema.parse({
			title: "About",
			avatarAlt: "Antonio Fulgencio",
		});
		expect(result.avatarAlt).toBe("Antonio Fulgencio");
	});

	it("accepts nowUpdatedAt as a Date instance (gray-matter parses YAML dates this way)", () => {
		const date = new Date("2026-05-22");
		const result = pageFrontmatterSchema.parse({
			title: "About",
			nowUpdatedAt: date,
		});
		expect(result.nowUpdatedAt).toBeInstanceOf(Date);
	});

	it("locale parses as a string", () => {
		const result = pageFrontmatterSchema.parse({
			title: "About",
			locale: "en",
		});
		expect(result.locale).toBe("en");
	});
});

// ─── Unit: loadStaticPage propagates avatar + links ──────────────────────────

describe("unit: loadStaticPage propagates avatar and links via schema", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.renderMdx.mockResolvedValue(() => null);
	});

	it("AC-4: returns frontmatter with avatar populated from file", async () => {
		mocks.readFile.mockResolvedValue(
			[
				"---",
				"title: About",
				"avatar: /about/profile.jpeg",
				"---",
				"",
				"Content.",
			].join("\n"),
		);

		const result = await loadStaticPage("about", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.frontmatter.avatar).toBe("/about/profile.jpeg");
	});

	it("AC-4: returns frontmatter with links populated from file", async () => {
		mocks.readFile.mockResolvedValue(
			[
				"---",
				"title: About",
				"links:",
				"  github: https://github.com/me",
				"  email: mailto:me@example.com",
				"---",
				"",
				"Content.",
			].join("\n"),
		);

		const result = await loadStaticPage("about", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.frontmatter.links?.github).toBe(
			"https://github.com/me",
		);
		expect(result?.entry.frontmatter.links?.email).toBe(
			"mailto:me@example.com",
		);
	});

	it("tagline passthrough: unknown frontmatter field survives loadStaticPage", async () => {
		mocks.readFile.mockResolvedValue(
			[
				"---",
				"title: About",
				"tagline: Software Engineer",
				"---",
				"",
				"Content.",
			].join("\n"),
		);

		const result = await loadStaticPage("about", "en");

		expect(result).not.toBeNull();
		expect((result?.entry.frontmatter as Record<string, unknown>).tagline).toBe(
			"Software Engineer",
		);
	});

	it("missing title: throws (Zod parse error)", async () => {
		mocks.readFile.mockResolvedValue(
			["---", "description: No title", "---", "", "Content."].join("\n"),
		);

		await expect(loadStaticPage("no-title", "en")).rejects.toThrow();
	});

	it("invalid links key: throws (Zod parse error)", async () => {
		mocks.readFile.mockResolvedValue(
			[
				"---",
				"title: About",
				"links:",
				"  linkdin: https://linkedin.com/in/me",
				"---",
				"",
				"Content.",
			].join("\n"),
		);

		await expect(loadStaticPage("about", "en")).rejects.toThrow();
	});
});

// ─── Integration: real about.mdx (AC-4 full round-trip) ─────────────────────

describe("integration: loadStaticPage with real about.mdx", () => {
	const { mkdir, mkdtemp, rm, writeFile } = require("node:fs/promises");
	const { tmpdir } = require("node:os");
	const { join } = require("node:path");

	let tmpDir: string;
	let cwdSpy: ReturnType<typeof vi.spyOn>;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "pages-fm-integ-"));
		const pagesEnDir = join(tmpDir, "app", "content", "pages", "en");
		await mkdir(pagesEnDir, { recursive: true });

		await writeFile(
			join(pagesEnDir, "about.mdx"),
			[
				"---",
				"title: About",
				"avatar: /about/profile.jpeg",
				"tagline: Software Engineer",
				"nowUpdatedAt: 2026-05-22",
				"links:",
				"  github: https://github.com/antoniofulg",
				"  linkedin: https://linkedin.com/in/antoniofulg",
				"  email: mailto:antoniofulg@gmail.com",
				"---",
				"",
				"Hello from the integration test.",
			].join("\n"),
			"utf-8",
		);

		cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);

		const realFs =
			await vi.importActual<typeof import("node:fs/promises")>(
				"node:fs/promises",
			);
		vi.mocked(mocks.readFile).mockImplementation(realFs.readFile as never);
		vi.mocked(mocks.readdir).mockImplementation(realFs.readdir as never);
	});

	afterAll(async () => {
		cwdSpy?.mockRestore();
		vi.mocked(mocks.readFile).mockResolvedValue("");
		vi.mocked(mocks.readdir).mockResolvedValue([]);
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("AC-4 full: avatar and links are defined and correct in loaded entry", async () => {
		const result = await loadStaticPage("about", "en");

		expect(result).not.toBeNull();
		expect(result?.entry.frontmatter.avatar).toBe("/about/profile.jpeg");
		expect(result?.entry.frontmatter.links?.github).toBe(
			"https://github.com/antoniofulg",
		);
		expect(result?.entry.frontmatter.links?.linkedin).toBe(
			"https://linkedin.com/in/antoniofulg",
		);
		expect(result?.entry.frontmatter.links?.email).toBe(
			"mailto:antoniofulg@gmail.com",
		);
	});

	it("AC-3 full: tagline and nowUpdatedAt flow through passthrough", async () => {
		const result = await loadStaticPage("about", "en");

		expect(result).not.toBeNull();
		const fm = result?.entry.frontmatter as Record<string, unknown>;
		expect(fm.tagline).toBe("Software Engineer");
		// gray-matter parses YAML date values as Date objects, not strings
		expect(fm.nowUpdatedAt).toBeInstanceOf(Date);
	});
});
