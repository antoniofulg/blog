import { createServer } from "node:net";
import { join } from "node:path";
import { isNotFound } from "@tanstack/react-router";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
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

const HUMAN_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BOT_UA = "Googlebot/2.1 (+http://www.google.com/bot.html)";

const mocks = vi.hoisted(() => {
	const selectWhere = vi.fn().mockResolvedValue([]);
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });

	const updateWhere = vi.fn().mockResolvedValue([]);
	const set = vi.fn().mockReturnValue({ where: updateWhere });
	const update = vi.fn().mockReturnValue({ set });

	const readFile = vi.fn().mockResolvedValue("# Test\n\nContent");

	const loadStaticPage = vi.fn().mockResolvedValue(null);
	const staticPageHasTwin = vi.fn().mockReturnValue(true);

	const recordPostView = vi
		.fn()
		.mockResolvedValue({ recorded: true, counterIncremented: true });

	const getRequest = vi.fn().mockReturnValue(
		new Request("http://localhost/", {
			headers: {
				"User-Agent":
					"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
			},
		}),
	);

	return {
		select,
		selectFrom,
		selectWhere,
		update,
		set,
		updateWhere,
		readFile,
		loadStaticPage,
		staticPageHasTwin,
		recordPostView,
		getRequest,
	};
});

vi.mock("#/db/client", () => ({
	db: {
		select: mocks.select,
		update: mocks.update,
	},
}));

vi.mock("node:fs/promises", () => ({
	readFile: mocks.readFile,
}));

vi.mock("#/lib/mdx/pages.server", () => ({
	loadStaticPage: mocks.loadStaticPage,
	staticPageHasTwin: mocks.staticPageHasTwin,
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: mocks.getRequest,
}));

vi.mock("#/lib/analytics/record-event.server", () => ({
	recordPostView: mocks.recordPostView,
}));

import { TranslationNotice } from "#/components/ui/translation-notice";
import type { posts } from "#/db/schema";
import {
	getPostBySlugWithLangFn,
	incrementViewCountFn,
	validateLocaleInput,
} from "#/routes/{-$locale}/$slug.server";

type Post = (typeof posts)["_"]["inferSelect"];

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		id: 1,
		filePath: "/content/en/hello.mdx",
		slug: "react-suspense",
		lang: "en",
		title: "React Suspense with TypeScript",
		description: "A deep dive into React Suspense.",
		publishedAt: new Date("2026-05-02"),
		viewCount: 0,
		indexedAt: new Date(),
		category: null,
		series: null,
		seriesPart: null,
		draft: null,
		...overrides,
	};
}

function resetMocks() {
	// resetAllMocks clears call counts AND purges pending mockResolvedValueOnce
	// queues — preventing stale One-time values from leaking into later tests.
	vi.resetAllMocks();
	mocks.selectWhere.mockResolvedValue([]);
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
	mocks.updateWhere.mockResolvedValue([]);
	mocks.set.mockReturnValue({ where: mocks.updateWhere });
	mocks.update.mockReturnValue({ set: mocks.set });
	mocks.readFile.mockResolvedValue("# Test\n\nContent");
	mocks.loadStaticPage.mockResolvedValue(null);
	mocks.recordPostView.mockResolvedValue({
		recorded: true,
		counterIncremented: true,
	});
	mocks.getRequest.mockReturnValue(
		new Request("http://localhost/", {
			headers: { "User-Agent": HUMAN_UA },
		}),
	);
}

// ─── Unit: validateLocaleInput ────────────────────────────────────────────────

describe("unit: validateLocaleInput", () => {
	it("rejects invalid locale string", () => {
		expect(() => validateLocaleInput({ slug: "test", lang: "fr" })).toThrow(
			'Invalid locale: "fr"',
		);
	});

	it("accepts valid en locale", () => {
		expect(validateLocaleInput({ slug: "test", lang: "en" })).toEqual({
			slug: "test",
			lang: "en",
		});
	});

	it("accepts valid pt-br locale", () => {
		expect(validateLocaleInput({ slug: "test", lang: "pt-br" })).toEqual({
			slug: "test",
			lang: "pt-br",
		});
	});

	it("rejects empty string", () => {
		expect(() => validateLocaleInput({ slug: "test", lang: "" })).toThrow(
			'Invalid locale: ""',
		);
	});
});

// ─── Unit: getPostBySlugWithLangFn ────────────────────────────────────────────

describe("unit: getPostBySlugWithLangFn — exact match", () => {
	beforeEach(resetMocks);

	it("exact match found → notTranslated: false, availableLang: null", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(result.notTranslated).toBe(false);
		expect(result.availableLang).toBeNull();
		expect(result.requestedLang).toBe("en");
		expect(result.post.slug).toBe("react-suspense");
	});

	it("exact match with pt-br alternate → alternateLang: 'pt-br'", async () => {
		const enPost = makePost({ lang: "en" });
		const ptPost = makePost({
			lang: "pt-br",
			filePath: "/content/pt-br/hello.mdx",
		});
		mocks.selectWhere
			.mockResolvedValueOnce([enPost])
			.mockResolvedValueOnce([ptPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(result.alternateLang).toBe("pt-br");
	});

	it("exact match with no alternate → alternateLang: null", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(result.alternateLang).toBeNull();
	});

	it("exact match found → html is string", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost()]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(typeof result.html).toBe("string");
	});

	it("reads file from post.filePath on exact match", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost()]);
		await getPostBySlugWithLangFn("react-suspense", "en");
		expect(mocks.readFile).toHaveBeenCalledWith(
			"/content/en/hello.mdx",
			"utf-8",
		);
	});
});

describe("unit: getPostBySlugWithLangFn — fallback", () => {
	beforeEach(resetMocks);

	it("(slug, pt-br) miss → fallback en → notTranslated: true, availableLang: 'en', alternateLang: null", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "pt-br");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(result.notTranslated).toBe(true);
		expect(result.availableLang).toBe("en");
		expect(result.requestedLang).toBe("pt-br");
		expect(result.alternateLang).toBeNull();
	});

	it("(slug, en) miss → fallback pt-br → notTranslated: true, availableLang: 'pt-br'", async () => {
		const ptPost = makePost({
			lang: "pt-br",
			filePath: "/content/pt-br/hello.mdx",
		});
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([ptPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(result.notTranslated).toBe(true);
		expect(result.availableLang).toBe("pt-br");
		expect(result.requestedLang).toBe("en");
	});

	it("(missing, en) both miss → notFound() thrown", async () => {
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		const err = await getPostBySlugWithLangFn("missing", "en").catch((e) => e);
		expect(isNotFound(err)).toBe(true);
	});

	it("fallback post html is string", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "pt-br");
		expect(typeof result.html).toBe("string");
	});
});

// ─── Unit: incrementViewCountFn ───────────────────────────────────────────────

describe("unit: incrementViewCountFn", () => {
	beforeEach(resetMocks);

	it("delegates to recordPostView with correct postId, lang, and referrer (human UA)", async () => {
		// Provide the post row for the lang lookup inside incrementViewCountFn.
		mocks.selectWhere.mockResolvedValueOnce([{ lang: "en" }]);

		await incrementViewCountFn({
			id: 42,
			referrer: "https://www.linkedin.com/feed",
			utmSource: null,
		});

		// recordPostView must be called exactly once with the right input shape.
		expect(mocks.recordPostView).toHaveBeenCalledTimes(1);
		expect(mocks.recordPostView).toHaveBeenCalledWith({
			postId: 42,
			request: expect.any(Request),
			lang: "en",
			referrer: "https://www.linkedin.com/feed",
			utmSource: null,
		});

		// No direct db.update — counter is handled inside recordPostView.
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("forwards a null referrer when navigation had no upstream source", async () => {
		mocks.selectWhere.mockResolvedValueOnce([{ lang: "en" }]);

		await incrementViewCountFn({ id: 42, referrer: null, utmSource: null });

		expect(mocks.recordPostView).toHaveBeenCalledWith(
			expect.objectContaining({ postId: 42, referrer: null }),
		);
	});

	it("pt-br post lang is forwarded to recordPostView correctly", async () => {
		mocks.selectWhere.mockResolvedValueOnce([{ lang: "pt-br" }]);

		await incrementViewCountFn({ id: 7, referrer: null, utmSource: null });

		expect(mocks.recordPostView).toHaveBeenCalledWith(
			expect.objectContaining({ postId: 7, lang: "pt-br" }),
		);
	});

	it("bot UA: early return before DB query — recordPostView is never called", async () => {
		// Simulate a Googlebot request arriving via getRequest().
		// The bot check now runs BEFORE the lang SELECT (issue_009 fix), so no
		// DB query is made and recordPostView is never reached.
		mocks.getRequest.mockReturnValueOnce(
			new Request("http://localhost/", {
				headers: { "User-Agent": BOT_UA },
			}),
		);

		await incrementViewCountFn({ id: 42, referrer: null, utmSource: null });

		// Bot is identified before any DB I/O; recordPostView must NOT be called.
		expect(mocks.recordPostView).not.toHaveBeenCalled();
		// No DB reads or writes issued.
		expect(mocks.select).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("returns early without calling recordPostView when post is not found", async () => {
		// Lang lookup returns no rows.
		mocks.selectWhere.mockResolvedValueOnce([]);

		await incrementViewCountFn({ id: 999, referrer: null, utmSource: null });

		expect(mocks.recordPostView).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});
});

// ─── Unit: TranslationNotice component ───────────────────────────────────────

describe("unit: TranslationNotice", () => {
	it("renders without error for pt-br → en", () => {
		const html = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "pt-br",
				availableLang: "en",
			}),
		);
		expect(html).toContain("Português");
		expect(html).toContain("English");
	});

	it("renders without error for en → pt-br", () => {
		const html = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "en",
				availableLang: "pt-br",
			}),
		);
		expect(html).toContain("English");
		expect(html).toContain("Português");
	});

	it("pt-br → en message is in Portuguese", () => {
		const html = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "pt-br",
				availableLang: "en",
			}),
		);
		expect(html).toContain(
			"Este conteúdo ainda não está disponível em Português",
		);
		expect(html).toContain("Exibindo a versão");
	});

	it("en → pt-br message is in English", () => {
		const html = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "en",
				availableLang: "pt-br",
			}),
		);
		expect(html).toContain("This content is not yet available in English");
		expect(html).toContain("Showing");
	});

	it("banner copy does not contain the word 'post' (content-neutral for About)", () => {
		const ptBrHtml = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "pt-br",
				availableLang: "en",
			}),
		);
		expect(ptBrHtml.toLowerCase()).not.toContain("post");

		const enHtml = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "en",
				availableLang: "pt-br",
			}),
		);
		expect(enHtml.toLowerCase()).not.toContain("post");
	});
});

// ─── Unit: normalizeCoverImage (via ogImagePath) ─────────────────────────────

describe("unit: getPostBySlugWithLangFn — normalizeCoverImage behaviour", () => {
	beforeEach(resetMocks);

	it("non-empty string coverImage → ogImagePath reflects it", async () => {
		mocks.readFile.mockResolvedValueOnce(
			"---\ncoverImage: /images/my-cover.png\n---\n# Post\n\nContent",
		);
		mocks.selectWhere.mockResolvedValueOnce([makePost()]);

		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		// resolveOgImagePath prepends origin (empty in test env) for relative paths
		expect(result.ogImagePath).toContain("/images/my-cover.png");
	});

	it("empty string coverImage → ogImagePath falls back (not the empty string)", async () => {
		mocks.readFile.mockResolvedValueOnce(
			"---\ncoverImage: ''\n---\n# Post\n\nContent",
		);
		mocks.selectWhere.mockResolvedValueOnce([makePost()]);

		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		// Empty string → normalizeCoverImage returns undefined → PNG/fallback path
		expect(result.ogImagePath).not.toBe("");
		expect(result.ogImagePath).not.toContain("my-cover");
	});

	it("non-string coverImage (number) → ogImagePath falls back to site default", async () => {
		mocks.readFile.mockResolvedValueOnce(
			"---\ncoverImage: 0\n---\n# Post\n\nContent",
		);
		mocks.selectWhere.mockResolvedValueOnce([makePost()]);

		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		// Non-string → normalizeCoverImage returns undefined → falls through to
		// auto-PNG check (PNG doesn't exist in test env) → og-image.jpg fallback
		expect(result.ogImagePath).toContain("og-image.jpg");
	});

	it("fallback branch: non-empty string coverImage → ogImagePath reflects it", async () => {
		mocks.readFile.mockResolvedValueOnce(
			"---\ncoverImage: /images/cover.png\n---\n# Fallback Post\n\nContent",
		);
		// exact match miss, fallback hit
		mocks.selectWhere
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce([makePost({ lang: "pt-br" })]);

		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(result.ogImagePath).toContain("/images/cover.png");
	});
});

// ─── Unit: discriminated union (kind field) ───────────────────────────────────

describe("unit: getPostBySlugWithLangFn — kind discriminator", () => {
	beforeEach(resetMocks);

	it("exact match → kind is 'post'", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
	});

	it("fallback match → kind is 'post'", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "pt-br");
		expect(result.kind).toBe("post");
	});

	it("post miss → page found → kind is 'page'", async () => {
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		const pageResult = {
			entry: {
				slug: "about",
				locale: "en" as const,
				filePath: "/pages/en/about.mdx",
				frontmatter: { title: "About", description: "About me" },
			},
			html: "<p>About me</p>",
		};
		mocks.loadStaticPage.mockResolvedValueOnce(pageResult);
		mocks.staticPageHasTwin.mockReturnValueOnce(true);
		const result = await getPostBySlugWithLangFn("about", "en");
		expect(result.kind).toBe("page");
		if (result.kind === "page") {
			expect(result.entry.frontmatter.title).toBe("About");
			expect(result.html).toBe("<p>About me</p>");
			expect(result.requestedLang).toBe("en");
			expect(result.hasTwin).toBe(true);
		}
	});

	it("post miss → page found pt-br → kind is 'page' with pt-br locale", async () => {
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		const pageResult = {
			entry: {
				slug: "about",
				locale: "pt-br" as const,
				filePath: "/pages/pt-br/about.mdx",
				frontmatter: { title: "Sobre" },
			},
			html: "<p>Sobre mim</p>",
		};
		mocks.loadStaticPage.mockResolvedValueOnce(pageResult);
		mocks.staticPageHasTwin.mockReturnValueOnce(false);
		const result = await getPostBySlugWithLangFn("about", "pt-br");
		expect(result.kind).toBe("page");
		if (result.kind === "page") {
			expect(result.requestedLang).toBe("pt-br");
			expect(result.hasTwin).toBe(false);
		}
	});

	it("post miss + page miss → notFound()", async () => {
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		mocks.loadStaticPage.mockResolvedValueOnce(null);
		const err = await getPostBySlugWithLangFn("nonexistent", "en").catch(
			(e) => e,
		);
		expect(isNotFound(err)).toBe(true);
	});

	it("collision: post and page both exist → returns post (post wins)", async () => {
		const enPost = makePost({ slug: "about", lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("about", "en");
		expect(result.kind).toBe("post");
		expect(mocks.loadStaticPage).not.toHaveBeenCalled();
	});

	it("loadStaticPage receives correct slug and locale", async () => {
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
		mocks.loadStaticPage.mockResolvedValueOnce(null);
		await getPostBySlugWithLangFn("uses", "pt-br").catch(() => null);
		expect(mocks.loadStaticPage).toHaveBeenCalledWith("uses", "pt-br");
	});

	it("stale post row (ENOENT on filePath) falls through to static page", async () => {
		// Simulate the /about regression: DB has a ghost post row pointing at a
		// moved/deleted MDX file. Loader must not crash — fall through to the
		// static-page branch and return the page result.
		const stalePost = makePost({
			slug: "about",
			lang: "en",
			filePath: "content/en/about.mdx", // file no longer exists
		});
		mocks.selectWhere.mockResolvedValueOnce([stalePost]);
		mocks.readFile.mockRejectedValueOnce(
			Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
		);
		mocks.loadStaticPage.mockResolvedValueOnce({
			entry: {
				slug: "about",
				locale: "en" as const,
				filePath: "/pages/en/about.mdx",
				frontmatter: { title: "About" },
			},
			html: "<p>About me</p>",
		});
		mocks.staticPageHasTwin.mockReturnValueOnce(true);

		const result = await getPostBySlugWithLangFn("about", "en");
		expect(result.kind).toBe("page");
		if (result.kind === "page") {
			expect(result.entry.frontmatter.title).toBe("About");
		}
		expect(mocks.loadStaticPage).toHaveBeenCalledWith("about", "en");
	});

	it("stale fallback row (ENOENT) falls through to static page", async () => {
		// Variant: exact-match query returns nothing; fallback query returns a
		// ghost row (e.g. slug=about, lang=pt-br pointing at old `content/pt-br/about.mdx`).
		// Loader must not crash — fall through to static-page branch.
		const stalePtBr = makePost({
			slug: "about",
			lang: "pt-br",
			filePath: "content/pt-br/about.mdx",
		});
		mocks.selectWhere
			.mockResolvedValueOnce([]) // exact-match miss
			.mockResolvedValueOnce([stalePtBr]); // fallback hit (ghost row)
		mocks.readFile.mockRejectedValueOnce(
			Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
		);
		mocks.loadStaticPage.mockResolvedValueOnce({
			entry: {
				slug: "about",
				locale: "en" as const,
				filePath: "/pages/en/about.mdx",
				frontmatter: { title: "About" },
			},
			html: "<p>About me</p>",
		});
		mocks.staticPageHasTwin.mockReturnValueOnce(false);

		const result = await getPostBySlugWithLangFn("about", "en");
		expect(result.kind).toBe("page");
	});

	it("non-ENOENT readFile error still propagates", async () => {
		// Permission errors etc. should NOT be swallowed — only ENOENT means
		// "file missing, try next branch".
		const enPost = makePost({ slug: "react-suspense", lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([enPost]);
		mocks.readFile.mockRejectedValueOnce(
			Object.assign(new Error("EACCES: permission denied"), { code: "EACCES" }),
		);
		await expect(
			getPostBySlugWithLangFn("react-suspense", "en"),
		).rejects.toThrow(/permission denied/);
	});
});

// ─── Integration: locale post detail routes ──────────────────────────────────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);
const port3000Free = await isPortFree(3000);

describe.skipIf(port5432Free || port3000Free)(
	"integration: {-$locale}/$slug route",
	() => {
		let sql: import("postgres").Sql;
		const DB_URL =
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog";
		const BASE_URL = "http://localhost:3000";
		const SLUG = `integ-locale-slug-${Date.now()}`;
		const FIXTURE = join(import.meta.dirname, "fixtures", "hello.mdx");

		beforeAll(async () => {
			const pg = await import("postgres");
			sql = pg.default(DB_URL);
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'en', 'Integration Lang Slug Test', 'desc', NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
		});

		afterAll(async () => {
			await sql`DELETE FROM posts WHERE slug = ${SLUG}`;
			await sql.end();
		});

		it("GET /<slug> returns 200 and renders post title", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Integration Lang Slug Test");
		});

		it("GET /<slug> does not show translation notice", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			expect(html).not.toContain("not available in English");
			expect(html).not.toContain("não está disponível");
		});

		it("GET /pt-br/<slug> (no pt-br post) returns 200 with English content and translation notice", async () => {
			const res = await fetch(`${BASE_URL}/pt-br/${SLUG}`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Integration Lang Slug Test");
			expect(html).toContain("Português");
		});

		it("GET /pt-br/<slug> (fallback to en) article element has lang=en", async () => {
			const res = await fetch(`${BASE_URL}/pt-br/${SLUG}`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toMatch(/<article[^>]+lang="en"/);
		});

		it("GET /<nonexistent-slug> returns 404", async () => {
			const res = await fetch(`${BASE_URL}/__nonexistent_slug_${Date.now()}__`);
			expect(res.status).toBe(404);
		});

		it("GET /<slug> head contains hreflang pair for pt-br alternate", async () => {
			// Insert pt-br version of the post so alternateLang is populated
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			expect(html).toContain('hreflang="en"');
			expect(html).toContain(`href="/${SLUG}"`);
			expect(html).toContain('hreflang="pt-BR"');
			expect(html).toContain(`href="/pt-br/${SLUG}"`);
			await sql`DELETE FROM posts WHERE slug = ${SLUG} AND lang = 'pt-br'`;
		});

		it("GET /pt-br/<slug> head contains hreflang pair for en alternate", async () => {
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
			const res = await fetch(`${BASE_URL}/pt-br/${SLUG}`);
			const html = await res.text();
			expect(html).toContain('hreflang="pt-BR"');
			expect(html).toContain(`href="/pt-br/${SLUG}"`);
			expect(html).toContain('hreflang="en"');
			expect(html).toContain(`href="/${SLUG}"`);
			await sql`DELETE FROM posts WHERE slug = ${SLUG} AND lang = 'pt-br'`;
		});

		it("GET /<slug> hreflang hrefs contain no /en/ prefix", async () => {
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			expect(html).not.toMatch(/hreflang="en"[^>]*href="\/en\//);
			await sql`DELETE FROM posts WHERE slug = ${SLUG} AND lang = 'pt-br'`;
		});

		it("GET /<slug> SSR contains en postMeta.publishedOn label before the date", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			expect(html).toContain("Published on");
		});

		it("GET /pt-br/<slug> SSR contains pt-br postMeta.publishedOn label before the date", async () => {
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
			const res = await fetch(`${BASE_URL}/pt-br/${SLUG}`);
			const html = await res.text();
			expect(html).toContain("Publicado em");
			await sql`DELETE FROM posts WHERE slug = ${SLUG} AND lang = 'pt-br'`;
		});
	},
);

describe.skipIf(port3000Free)("integration: static page routes (about)", () => {
	const BASE_URL = "http://localhost:3000";

	it("GET /about returns 200 with migrated page content", async () => {
		const res = await fetch(`${BASE_URL}/about`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html.toLowerCase()).toContain("about");
	});

	it("GET /pt-br/about returns 200 with pt-br page content", async () => {
		const res = await fetch(`${BASE_URL}/pt-br/about`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toBeTruthy();
	});

	it("GET /about does not contain published date label (pages have no date)", async () => {
		const res = await fetch(`${BASE_URL}/about`);
		const html = await res.text();
		expect(html).not.toContain("Published on");
		expect(html).not.toContain("Publicado em");
	});

	it("GET /__nonexistent_page__ returns 404", async () => {
		const res = await fetch(`${BASE_URL}/__nonexistent_page_${Date.now()}__`);
		expect(res.status).toBe(404);
	});
});
