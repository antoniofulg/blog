import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	getPostInventory: vi.fn().mockResolvedValue([]),
	getRouteInventory: vi.fn().mockResolvedValue([]),
	enumerateStaticPages: vi.fn().mockResolvedValue([]),
	readdir: vi.fn().mockResolvedValue([]),
	readFile: vi.fn().mockResolvedValue(""),
}));

vi.mock("#/lib/site-model.server", () => ({
	getPostInventory: mocks.getPostInventory,
	getRouteInventory: mocks.getRouteInventory,
}));

vi.mock("#/lib/mdx/pages.server", () => ({
	enumerateStaticPages: mocks.enumerateStaticPages,
}));

vi.mock("node:fs/promises", async (importOriginal) => {
	const actual = await importOriginal<typeof import("node:fs/promises")>();
	return {
		...actual,
		readdir: mocks.readdir,
		readFile: mocks.readFile,
	};
});

import {
	checkPageTranslationGaps,
	checkSlugCollisions,
	runContentAudit,
} from "#/lib/content-audit/checks.server";
import type { PageEntry } from "#/lib/mdx/pages.server";
import type { PostEntry } from "#/lib/site-model.server";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

function makePostEntry(
	overrides: Partial<PostEntry> & Pick<PostEntry, "slug" | "lang">,
): PostEntry {
	return {
		filePath: `/app/content/posts/${overrides.lang}/${overrides.slug}.mdx`,
		frontmatter: { title: overrides.slug },
		hasTwin: false,
		...overrides,
	};
}

function makePageEntry(
	overrides: Partial<PageEntry> & Pick<PageEntry, "slug" | "locale">,
): PageEntry {
	return {
		filePath: `/app/content/pages/${overrides.locale}/${overrides.slug}.mdx`,
		frontmatter: { title: overrides.slug },
		...overrides,
	};
}

// ─── checkPageTranslationGaps ─────────────────────────────────────────────────

describe("unit: checkPageTranslationGaps", () => {
	it("emits translation-gap when en page has no pt-br twin", () => {
		const findings = checkPageTranslationGaps({
			en: [makePageEntry({ slug: "about", locale: "en" })],
			"pt-br": [],
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("translation-gap");
		expect(findings[0].severity).toBe("major");
		expect(findings[0].filePath).toContain("about.mdx");
		expect(findings[0].message).toContain('"about"');
	});

	it("emits no findings when en page has a pt-br twin", () => {
		const findings = checkPageTranslationGaps({
			en: [makePageEntry({ slug: "about", locale: "en" })],
			"pt-br": [makePageEntry({ slug: "about", locale: "pt-br" })],
		});

		expect(findings).toHaveLength(0);
	});

	it("emits multiple findings when several en pages lack twins", () => {
		const findings = checkPageTranslationGaps({
			en: [
				makePageEntry({ slug: "about", locale: "en" }),
				makePageEntry({ slug: "uses", locale: "en" }),
			],
			"pt-br": [],
		});

		expect(findings).toHaveLength(2);
		expect(findings.map((f) => f.message)).toEqual(
			expect.arrayContaining([
				expect.stringContaining('"about"'),
				expect.stringContaining('"uses"'),
			]),
		);
	});

	it("emits no findings when there are no en pages", () => {
		const findings = checkPageTranslationGaps({ en: [], "pt-br": [] });
		expect(findings).toHaveLength(0);
	});

	it("emits finding only for pages missing the twin (partial coverage)", () => {
		const findings = checkPageTranslationGaps({
			en: [
				makePageEntry({ slug: "about", locale: "en" }),
				makePageEntry({ slug: "uses", locale: "en" }),
			],
			"pt-br": [makePageEntry({ slug: "about", locale: "pt-br" })],
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].message).toContain('"uses"');
	});

	it("handles missing locale key gracefully (undefined treated as empty)", () => {
		const findings = checkPageTranslationGaps({
			en: [makePageEntry({ slug: "about", locale: "en" })],
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("translation-gap");
	});

	it("emits translation-gap when pt-br page has no en twin", () => {
		const findings = checkPageTranslationGaps({
			en: [],
			"pt-br": [makePageEntry({ slug: "uses", locale: "pt-br" })],
		});

		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("translation-gap");
		expect(findings[0].severity).toBe("major");
		expect(findings[0].message).toContain('"uses"');
		expect(findings[0].message).toContain("pt-br");
	});

	it("emits findings for both directions when each locale has unmatched pages", () => {
		const findings = checkPageTranslationGaps({
			en: [makePageEntry({ slug: "en-only", locale: "en" })],
			"pt-br": [makePageEntry({ slug: "ptbr-only", locale: "pt-br" })],
		});

		expect(findings).toHaveLength(2);
		const messages = findings.map((f) => f.message);
		expect(messages.some((m) => m.includes('"en-only"'))).toBe(true);
		expect(messages.some((m) => m.includes('"ptbr-only"'))).toBe(true);
	});

	it("emits no findings when both locales have matching pages", () => {
		const findings = checkPageTranslationGaps({
			en: [makePageEntry({ slug: "about", locale: "en" })],
			"pt-br": [makePageEntry({ slug: "about", locale: "pt-br" })],
		});

		expect(findings).toHaveLength(0);
	});
});

// ─── checkSlugCollisions ─────────────────────────────────────────────────────

describe("unit: checkSlugCollisions", () => {
	it("emits slug-collision when post and page share slug in same locale", () => {
		const posts = [makePostEntry({ slug: "foo", lang: "en" })];
		const pagesByLocale = {
			en: [makePageEntry({ slug: "foo", locale: "en" })],
			"pt-br": [],
		};

		const findings = checkSlugCollisions(posts, pagesByLocale);

		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("slug-collision");
		expect(findings[0].severity).toBe("major");
		expect(findings[0].message).toContain('"foo"');
		expect(findings[0].message).toContain("en");
		expect(findings[0].detail?.slug).toBe("foo");
		expect(findings[0].detail?.locale).toBe("en");
	});

	it("does NOT emit slug-collision when slugs collide in different locales", () => {
		// post is en/foo, page is pt-br/foo — different locales, no collision
		const posts = [makePostEntry({ slug: "foo", lang: "en" })];
		const pagesByLocale = {
			en: [],
			"pt-br": [makePageEntry({ slug: "foo", locale: "pt-br" })],
		};

		const findings = checkSlugCollisions(posts, pagesByLocale);

		expect(findings).toHaveLength(0);
	});

	it("emits one finding per locale where collision exists", () => {
		// post exists in both locales, page exists in both locales
		const posts = [
			makePostEntry({ slug: "about", lang: "en" }),
			makePostEntry({ slug: "about", lang: "pt-br" }),
		];
		const pagesByLocale = {
			en: [makePageEntry({ slug: "about", locale: "en" })],
			"pt-br": [makePageEntry({ slug: "about", locale: "pt-br" })],
		};

		const findings = checkSlugCollisions(posts, pagesByLocale);

		expect(findings).toHaveLength(2);
		const locales = findings.map((f) => f.detail?.locale);
		expect(locales).toContain("en");
		expect(locales).toContain("pt-br");
	});

	it("emits no findings when no slugs overlap", () => {
		const posts = [makePostEntry({ slug: "my-post", lang: "en" })];
		const pagesByLocale = {
			en: [makePageEntry({ slug: "about", locale: "en" })],
			"pt-br": [],
		};

		const findings = checkSlugCollisions(posts, pagesByLocale);

		expect(findings).toHaveLength(0);
	});

	it("emits no findings when posts list is empty", () => {
		const findings = checkSlugCollisions([], {
			en: [makePageEntry({ slug: "about", locale: "en" })],
			"pt-br": [],
		});

		expect(findings).toHaveLength(0);
	});

	it("emits no findings when pages list is empty", () => {
		const findings = checkSlugCollisions(
			[makePostEntry({ slug: "about", lang: "en" })],
			{ en: [], "pt-br": [] },
		);

		expect(findings).toHaveLength(0);
	});

	it("filePath in finding points to the page file, not the post", () => {
		const posts = [makePostEntry({ slug: "foo", lang: "en" })];
		const page = makePageEntry({ slug: "foo", locale: "en" });
		const findings = checkSlugCollisions(posts, { en: [page], "pt-br": [] });

		expect(findings[0].filePath).toBe(page.filePath);
	});
});

// ─── runContentAudit — integration with pages ─────────────────────────────────

describe("integration: runContentAudit with pages", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		// Default: no posts, no routes, no pages, no files
		mocks.getPostInventory.mockResolvedValue([]);
		mocks.getRouteInventory.mockResolvedValue([]);
		mocks.enumerateStaticPages.mockResolvedValue([]);
		mocks.readdir.mockResolvedValue([]);
		mocks.readFile.mockResolvedValue("");
	});

	it("emits slug-collision when enumerateStaticPages returns page colliding with post", async () => {
		mocks.getPostInventory.mockResolvedValue([
			makePostEntry({ slug: "about", lang: "en" }),
		]);
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) => {
			if (locale === "en")
				return [makePageEntry({ slug: "about", locale: "en" })];
			return [];
		});

		const findings = await runContentAudit("/tmp/empty-posts");

		const collisions = findings.filter((f) => f.category === "slug-collision");
		expect(collisions).toHaveLength(1);
		expect(collisions[0].severity).toBe("major");
	});

	it("emits translation-gap for en page without pt-br twin", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) => {
			if (locale === "en")
				return [makePageEntry({ slug: "uses", locale: "en" })];
			return [];
		});

		const findings = await runContentAudit("/tmp/empty-posts");

		const gaps = findings.filter((f) => f.category === "translation-gap");
		expect(gaps).toHaveLength(1);
		expect(gaps[0].message).toContain('"uses"');
	});

	it("emits no new findings when pages are fully covered and no collisions", async () => {
		mocks.enumerateStaticPages.mockImplementation(async (locale: string) => {
			if (locale === "en")
				return [makePageEntry({ slug: "about", locale: "en" })];
			if (locale === "pt-br")
				return [makePageEntry({ slug: "about", locale: "pt-br" })];
			return [];
		});

		const findings = await runContentAudit("/tmp/empty-posts");

		expect(
			findings.filter(
				(f) =>
					f.category === "slug-collision" || f.category === "translation-gap",
			),
		).toHaveLength(0);
	});

	it("calls enumerateStaticPages once per locale", async () => {
		await runContentAudit("/tmp/empty-posts");

		expect(mocks.enumerateStaticPages).toHaveBeenCalledWith("en");
		expect(mocks.enumerateStaticPages).toHaveBeenCalledWith("pt-br");
		expect(mocks.enumerateStaticPages).toHaveBeenCalledTimes(2);
	});

	it("emits frontmatter-invalid when a page MDX file is missing title (issue 006)", async () => {
		mocks.readdir.mockImplementation(async (dir: unknown) => {
			if (String(dir).includes("pages")) {
				return [{ name: "about.mdx", isDirectory: () => false }];
			}
			return [];
		});
		// Frontmatter without title
		mocks.readFile.mockResolvedValue("---\ndescription: A page\n---\n# About");

		const findings = await runContentAudit("/tmp/empty-posts");

		const invalid = findings.filter(
			(f) => f.category === "frontmatter-invalid",
		);
		expect(invalid).toHaveLength(1);
		expect(invalid[0].severity).toBe("blocker");
		expect(invalid[0].filePath).toContain("about.mdx");
	});
});
