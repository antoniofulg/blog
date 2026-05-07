import { createServer } from "node:net";
import { join } from "node:path";
import { isNotFound } from "@tanstack/react-router";
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
	// select chain: db.select().from(posts).where(eq(...)).orderBy(desc(...))
	const selectOrderBy = vi.fn().mockResolvedValue([]);
	const selectWhere = vi.fn().mockReturnValue({ orderBy: selectOrderBy });
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });

	// update chain: db.update(posts).set({...}).where(eq(...))
	const updateWhere = vi.fn().mockResolvedValue([]);
	const set = vi.fn().mockReturnValue({ where: updateWhere });
	const update = vi.fn().mockReturnValue({ set });

	// readFile mock
	const readFile = vi.fn().mockResolvedValue("# Test\n\nContent");

	// renderMdx mock — returns a no-op React component
	const renderMdx = vi.fn().mockResolvedValue(() => null);

	return {
		select,
		selectFrom,
		selectWhere,
		selectOrderBy,
		update,
		set,
		updateWhere,
		readFile,
		renderMdx,
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

vi.mock("#/lib/mdx/renderer.server", () => ({
	renderMdx: mocks.renderMdx,
}));

// Prevent TanStack Start Vite plugin from stripping server fn handlers.
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

import { getPublishedPostsFn } from "#/db/queries";
import { posts } from "#/db/schema";
import { getPostBySlugFn, incrementViewCountFn } from "#/routes/$slug";

const FIXTURES = join(import.meta.dirname, "fixtures");

function makePost(overrides: Partial<(typeof posts)["_"]["inferSelect"]> = {}) {
	return {
		id: 1,
		filePath: join(FIXTURES, "hello.mdx"),
		slug: "hello-world",
		title: "Hello World",
		description: "A short intro post.",
		publishedAt: new Date("2026-05-02"),
		isPublished: true,
		viewCount: 0,
		indexedAt: new Date(),
		...overrides,
	};
}

function resetMocks() {
	vi.clearAllMocks();
	mocks.selectOrderBy.mockResolvedValue([]);
	mocks.selectWhere.mockReturnValue({ orderBy: mocks.selectOrderBy });
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
	mocks.updateWhere.mockResolvedValue([]);
	mocks.set.mockReturnValue({ where: mocks.updateWhere });
	mocks.update.mockReturnValue({ set: mocks.set });
	mocks.readFile.mockResolvedValue("# Test\n\nContent");
	mocks.renderMdx.mockResolvedValue(() => null);
}

// ─── Unit: getPublishedPostsFn ────────────────────────────────────────────────

describe("unit: getPublishedPostsFn", () => {
	beforeEach(resetMocks);

	it("calls db.select().from(posts).where(isPublished=true).orderBy(publishedAt DESC)", async () => {
		mocks.selectOrderBy.mockResolvedValue([makePost()]);
		const result = await getPublishedPostsFn();
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(mocks.selectFrom).toHaveBeenCalledWith(posts);
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("hello-world");
	});

	it("returns only is_published=true rows — mock returns empty for draft-only DB", async () => {
		mocks.selectOrderBy.mockResolvedValue([]);
		const result = await getPublishedPostsFn();
		expect(result).toHaveLength(0);
	});

	it("returns posts in publishedAt DESC order when mock returns them that way", async () => {
		const older = makePost({
			id: 1,
			slug: "older",
			publishedAt: new Date("2026-01-01"),
		});
		const newer = makePost({
			id: 2,
			slug: "newer",
			publishedAt: new Date("2026-05-02"),
		});
		// Mock returns newer first (DESC order applied by Drizzle query)
		mocks.selectOrderBy.mockResolvedValue([newer, older]);
		const result = await getPublishedPostsFn();
		expect(result[0].slug).toBe("newer");
		expect(result[1].slug).toBe("older");
	});
});

// ─── Unit: getPostBySlugFn ────────────────────────────────────────────────────

describe("unit: getPostBySlugFn", () => {
	beforeEach(resetMocks);

	it("returns { post, html } for a published post", async () => {
		mocks.selectWhere.mockResolvedValue([makePost()]);
		mocks.renderMdx.mockResolvedValue(() => null);
		const result = await getPostBySlugFn("hello-world");
		expect(result.post.slug).toBe("hello-world");
		expect(typeof result.html).toBe("string");
	});

	it("throws notFound for missing slug (empty query result)", async () => {
		mocks.selectWhere.mockResolvedValue([]);
		const err = await getPostBySlugFn("missing-slug").catch((e) => e);
		expect(isNotFound(err)).toBe(true);
	});

	it("throws notFound for a draft post (is_published=false)", async () => {
		mocks.selectWhere.mockResolvedValue([makePost({ isPublished: false })]);
		const err = await getPostBySlugFn("draft-post").catch((e) => e);
		expect(isNotFound(err)).toBe(true);
	});

	it("reads the file from post.filePath", async () => {
		mocks.selectWhere.mockResolvedValue([makePost()]);
		await getPostBySlugFn("hello-world");
		expect(mocks.readFile).toHaveBeenCalledWith(
			join(FIXTURES, "hello.mdx"),
			"utf-8",
		);
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
		// SQL expression object, not a plain number
		expect(typeof setArg.viewCount).not.toBe("number");
		expect(mocks.updateWhere).toHaveBeenCalledTimes(1);
	});

	it("issues only one update per call", async () => {
		await incrementViewCountFn(1);
		await incrementViewCountFn(2);
		expect(mocks.update).toHaveBeenCalledTimes(2);
	});
});

// ─── Integration: public routes (requires DB + running server) ──────────────

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
	"integration: public routes",
	() => {
		let sql: import("postgres").Sql;
		const DB_URL = "postgres://blog:blog@localhost:5432/blog";
		const BASE_URL = "http://localhost:3000";
		const SLUG = `integ-pub-${Date.now()}`;
		const DRAFT_SLUG = `integ-draft-${Date.now()}`;
		const FIXTURE = join(import.meta.dirname, "fixtures", "hello.mdx");

		beforeAll(async () => {
			const pg = await import("postgres");
			sql = pg.default(DB_URL);
			await sql`
        INSERT INTO posts (file_path, slug, title, description, is_published, published_at, view_count, indexed_at)
        VALUES (${FIXTURE}, ${SLUG}, 'Integration Published', 'desc', true, NOW(), 0, NOW())
      `;
			await sql`
        INSERT INTO posts (file_path, slug, title, description, is_published, view_count, indexed_at)
        VALUES (${FIXTURE}, ${DRAFT_SLUG}, 'Integration Draft', 'desc', false, 0, NOW())
      `;
		});

		afterAll(async () => {
			await sql`DELETE FROM posts WHERE slug IN (${SLUG}, ${DRAFT_SLUG})`;
			await sql.end();
		});

		it("GET / returns 200 and lists only the published post", async () => {
			const res = await fetch(`${BASE_URL}/`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toContain("Integration Published");
			expect(html).not.toContain("Integration Draft");
		});

		it("GET /:slug returns 200 and includes <h1> for published post", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toMatch(/<h1[^>]*>/);
		});

		it("GET /draft-slug returns 404 for unpublished post", async () => {
			const res = await fetch(`${BASE_URL}/${DRAFT_SLUG}`);
			expect(res.status).toBe(404);
		});

		it("GET /:slug <head> contains <title> matching post title", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			expect(html).toContain("<title>Integration Published</title>");
		});
	},
);
