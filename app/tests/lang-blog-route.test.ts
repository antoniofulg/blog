import { createServer } from "node:net";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const selectOrderBy = vi.fn().mockResolvedValue([]);
	const selectWhere = vi.fn().mockReturnValue({ orderBy: selectOrderBy });
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });

	return { select, selectFrom, selectWhere, selectOrderBy };
});

vi.mock("#/db/client", () => ({
	db: { select: mocks.select },
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

import { getPublishedPostsFn } from "#/db/queries";
import type { posts } from "#/db/schema";
import { validateLocaleFn } from "#/routes/$lang/blog.server";

type Post = (typeof posts)["_"]["inferSelect"];

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		id: 1,
		filePath: "/content/en/hello.mdx",
		slug: "hello-world",
		lang: "en",
		title: "Hello World",
		description: "A short intro post.",
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
	mocks.selectOrderBy.mockResolvedValue([]);
	mocks.selectWhere.mockReturnValue({ orderBy: mocks.selectOrderBy });
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
}

// ─── Pagination pure logic ────────────────────────────────────────────────────

const POSTS_PER_PAGE = 9;

function paginate<T>(items: T[], page: number): T[] {
	return items.slice((page - 1) * POSTS_PER_PAGE, page * POSTS_PER_PAGE);
}

describe("unit: pagination logic", () => {
	it("page 1 of 10 posts returns 9 posts", () => {
		const allPosts = Array.from({ length: 10 }, (_, i) =>
			makePost({ id: i + 1, slug: `post-${i + 1}` }),
		);
		expect(paginate(allPosts, 1)).toHaveLength(9);
	});

	it("page 2 of 10 posts returns 1 post", () => {
		const allPosts = Array.from({ length: 10 }, (_, i) =>
			makePost({ id: i + 1, slug: `post-${i + 1}` }),
		);
		expect(paginate(allPosts, 2)).toHaveLength(1);
	});

	it("page 1 of 9 posts returns all 9", () => {
		const allPosts = Array.from({ length: 9 }, (_, i) =>
			makePost({ id: i + 1, slug: `post-${i + 1}` }),
		);
		expect(paginate(allPosts, 1)).toHaveLength(9);
	});

	it("empty list returns empty page", () => {
		expect(paginate([], 1)).toHaveLength(0);
	});
});

// ─── Unit: getPublishedPostsFn with lang param ────────────────────────────────

describe("unit: getPublishedPostsFn — locale filtering", () => {
	beforeEach(resetMocks);

	it("passes 'en' to the query and returns English posts", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectOrderBy.mockResolvedValue([enPost]);
		const result = await getPublishedPostsFn("en");
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(result).toHaveLength(1);
		expect(result[0].lang).toBe("en");
	});

	it("passes 'pt-br' to the query and returns pt-br posts", async () => {
		const ptPost = makePost({
			lang: "pt-br",
			filePath: "/content/pt-br/hello.mdx",
		});
		mocks.selectOrderBy.mockResolvedValue([ptPost]);
		const result = await getPublishedPostsFn("pt-br");
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(result).toHaveLength(1);
		expect(result[0].lang).toBe("pt-br");
	});

	it("returns empty array when no posts match the locale", async () => {
		mocks.selectOrderBy.mockResolvedValue([]);
		const result = await getPublishedPostsFn("pt-br");
		expect(result).toHaveLength(0);
	});

	it("does not mix locales — empty when no posts in lang", async () => {
		mocks.selectOrderBy.mockResolvedValue([]);
		const result = await getPublishedPostsFn("en");
		expect(result).toHaveLength(0);
	});
});

// ─── Unit: getLocalePosts inputValidator ─────────────────────────────────────

describe("unit: getLocalePosts inputValidator — locale validation", () => {
	it("rejects an unknown locale string", () => {
		expect(() => validateLocaleFn("fr")).toThrow(/Invalid locale/);
	});

	it("rejects an empty string", () => {
		expect(() => validateLocaleFn("")).toThrow(/Invalid locale/);
	});

	it("accepts 'en'", () => {
		expect(validateLocaleFn("en")).toBe("en");
	});

	it("accepts 'pt-br'", () => {
		expect(validateLocaleFn("pt-br")).toBe("pt-br");
	});
});

// ─── Integration: locale blog routes (requires DB + running server) ──────────

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
	"integration: locale blog routes",
	() => {
		let sql: import("postgres").Sql;
		const DB_URL = "postgres://blog:blog@localhost:5432/blog";
		const BASE_URL = "http://localhost:3000";
		const SLUG = `integ-lang-blog-${Date.now()}`;

		beforeEach(async () => {
			const pg = await import("postgres");
			sql = pg.default(DB_URL);
			await sql`
        INSERT INTO posts (file_path, slug, lang, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${`/content/en/${SLUG}.mdx`}, ${SLUG}, 'en', 'Locale Blog Test', 'desc', true, NOW(), 0, NOW())
        ON CONFLICT DO NOTHING
      `;
			await sql.end();
		});

		it("GET /en/blog returns 200", async () => {
			const res = await fetch(`${BASE_URL}/en/blog`);
			expect(res.status).toBe(200);
		});

		it("GET /en/blog contains the published English post", async () => {
			const res = await fetch(`${BASE_URL}/en/blog`);
			const html = await res.text();
			expect(html).toContain("Locale Blog Test");
		});

		it("GET /pt-br/blog returns 200 with empty state", async () => {
			const res = await fetch(`${BASE_URL}/pt-br/blog`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Nenhum artigo encontrado");
		});
	},
);
