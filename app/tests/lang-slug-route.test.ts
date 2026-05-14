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

const mocks = vi.hoisted(() => {
	const selectWhere = vi.fn().mockResolvedValue([]);
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });

	const updateWhere = vi.fn().mockResolvedValue([]);
	const set = vi.fn().mockReturnValue({ where: updateWhere });
	const update = vi.fn().mockReturnValue({ set });

	const readFile = vi.fn().mockResolvedValue("# Test\n\nContent");

	return {
		select,
		selectFrom,
		selectWhere,
		update,
		set,
		updateWhere,
		readFile,
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

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

import { TranslationNotice } from "#/components/ui/translation-notice";
import { posts } from "#/db/schema";
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
		isPublished: true,
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
	vi.clearAllMocks();
	mocks.selectWhere.mockResolvedValue([]);
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
	mocks.updateWhere.mockResolvedValue([]);
	mocks.set.mockReturnValue({ where: mocks.updateWhere });
	mocks.update.mockReturnValue({ set: mocks.set });
	mocks.readFile.mockResolvedValue("# Test\n\nContent");
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
		expect(result.alternateLang).toBe("pt-br");
	});

	it("exact match with no alternate → alternateLang: null", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
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

	it("calls db.update(posts).set({ viewCount: sql }).where(id)", async () => {
		await incrementViewCountFn(42);
		expect(mocks.update).toHaveBeenCalledWith(posts);
		expect(mocks.set).toHaveBeenCalledTimes(1);
		const setArg = mocks.set.mock.calls[0][0] as Record<string, unknown>;
		expect(setArg.viewCount).toBeDefined();
		expect(typeof setArg.viewCount).not.toBe("number");
		expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
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
		expect(html).toContain("Este post");
		expect(html).toContain("mostrando versão");
	});

	it("en → pt-br message is in English", () => {
		const html = renderToStaticMarkup(
			createElement(TranslationNotice, {
				requestedLang: "en",
				availableLang: "pt-br",
			}),
		);
		expect(html).toContain("This post is not available in English");
		expect(html).toContain("showing");
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
		const DB_URL = "postgres://blog:blog@localhost:5432/blog";
		const BASE_URL = "http://localhost:3000";
		const SLUG = `integ-locale-slug-${Date.now()}`;
		const FIXTURE = join(import.meta.dirname, "fixtures", "hello.mdx");

		beforeAll(async () => {
			const pg = await import("postgres");
			sql = pg.default(DB_URL);
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'en', 'Integration Lang Slug Test', 'desc', true, NOW(), 0, NOW())
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

		it("GET /<nonexistent-slug> returns 404", async () => {
			const res = await fetch(`${BASE_URL}/__nonexistent_slug_${Date.now()}__`);
			expect(res.status).toBe(404);
		});

		it("GET /<slug> head contains hreflang pair for pt-br alternate", async () => {
			// Insert pt-br version of the post so alternateLang is populated
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', true, NOW(), 0, NOW())
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
        INSERT INTO posts (file_path, slug, lang, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', true, NOW(), 0, NOW())
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
        INSERT INTO posts (file_path, slug, lang, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', true, NOW(), 0, NOW())
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
        INSERT INTO posts (file_path, slug, lang, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'pt-br', 'Integration Lang Slug Test PT', 'desc', true, NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
			const res = await fetch(`${BASE_URL}/pt-br/${SLUG}`);
			const html = await res.text();
			expect(html).toContain("Publicado em");
			await sql`DELETE FROM posts WHERE slug = ${SLUG} AND lang = 'pt-br'`;
		});
	},
);
