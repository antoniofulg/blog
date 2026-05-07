import { execSync } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import type { NewPost, Post } from "../db/schema";
import { posts } from "../db/schema";

const root = join(import.meta.dirname, "../..");

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);

// ─── Unit tests: schema structure ───────────────────────────────────────────

describe("unit: posts schema", () => {
	it("table name is 'posts'", () => {
		expect(
			(posts as unknown as Record<symbol, unknown>)[Symbol.for("drizzle:Name")],
		).toBe("posts");
	});

	it("file_path column has UNIQUE constraint", () => {
		const col = posts.filePath;
		expect(col.uniqueName).toBeDefined();
		expect(col.isUnique).toBe(true);
	});

	it("slug column does not have standalone UNIQUE (composite unique only)", () => {
		const col = posts.slug;
		expect(col.isUnique).toBeFalsy();
	});

	it("is_published defaults to false", () => {
		const col = posts.isPublished;
		expect(col.default).toBe(false);
	});

	it("view_count defaults to 0", () => {
		const col = posts.viewCount;
		expect(col.default).toBe(0);
	});

	it("description is nullable", () => {
		const col = posts.description;
		expect(col.notNull).toBeFalsy();
	});

	it("published_at is nullable", () => {
		const col = posts.publishedAt;
		expect(col.notNull).toBeFalsy();
	});

	it("indexed_at has defaultNow()", () => {
		const col = posts.indexedAt;
		expect(col.hasDefault).toBe(true);
	});

	it("Post type has expected shape (compile-time check)", () => {
		// TypeScript compile check: if Post type is wrong this file won't compile.
		const _post: Post = {
			id: 1,
			filePath: "content/en/hello.mdx",
			slug: "hello",
			lang: "en",
			title: "Hello",
			description: null,
			publishedAt: null,
			isPublished: false,
			viewCount: 0,
			indexedAt: new Date(),
			category: null,
			series: null,
			seriesPart: null,
			draft: null,
		};
		expect(_post.id).toBe(1);
		expect(typeof _post.slug).toBe("string");
		expect(typeof _post.isPublished).toBe("boolean");
		expect(_post.lang).toBe("en");
	});

	it("NewPost type omits id and indexedAt (compile-time check)", () => {
		const _new: NewPost = {
			filePath: "content/test.mdx",
			slug: "test",
			title: "Test",
		};
		expect(_new.filePath).toBeDefined();
	});
});

// ─── Integration tests: db:generate and db:migrate ──────────────────────────

describe("integration: db:generate", () => {
	it("bun run db:generate exits 0 and creates a file in drizzle/", () => {
		const result = execSync("bun run db:generate", {
			cwd: root,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		});
		const fs = require("node:fs");
		const files = fs
			.readdirSync(join(root, "drizzle"))
			.filter((f: string) => f.endsWith(".sql"));
		expect(files.length).toBeGreaterThan(0);
		void result;
	});
});

describe.skipIf(port5432Free)("integration: db:migrate and constraints", () => {
	let postgres: import("postgres").Sql | undefined;

	afterAll(async () => {
		if (postgres) await postgres.end();
	});

	it("bun run db:migrate exits 0", () => {
		expect(() =>
			execSync("bun run db:migrate", {
				cwd: root,
				env: {
					...process.env,
					DATABASE_URL: "postgres://blog:blog@localhost:5432/blog",
				},
				stdio: "pipe",
			}),
		).not.toThrow();
	});

	it("posts table has all 14 expected columns", async () => {
		const pg = await import("postgres");
		const sql = pg.default("postgres://blog:blog@localhost:5432/blog");
		postgres = sql;
		const rows = await sql<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posts'
      ORDER BY ordinal_position
    `;
		const cols = rows.map((r) => r.column_name);
		expect(cols).toContain("id");
		expect(cols).toContain("file_path");
		expect(cols).toContain("slug");
		expect(cols).toContain("lang");
		expect(cols).toContain("title");
		expect(cols).toContain("description");
		expect(cols).toContain("published_at");
		expect(cols).toContain("is_published");
		expect(cols).toContain("view_count");
		expect(cols).toContain("indexed_at");
		expect(cols).toContain("category");
		expect(cols).toContain("series");
		expect(cols).toContain("series_part");
		expect(cols).toContain("draft");
		expect(cols).toHaveLength(14);
	});

	it("duplicate file_path insert throws unique constraint error", async () => {
		const pg = await import("postgres");
		const sql = pg.default("postgres://blog:blog@localhost:5432/blog");
		postgres = sql;
		const unique = `test-dup-fp-${Date.now()}`;
		try {
			await sql`INSERT INTO posts (file_path, slug, title) VALUES (${`content/${unique}.mdx`}, ${`${unique}-a`}, 'Test A')`;
			await expect(
				sql`INSERT INTO posts (file_path, slug, title) VALUES (${`content/${unique}.mdx`}, ${`${unique}-b`}, 'Test B')`,
			).rejects.toThrow();
		} finally {
			await sql`DELETE FROM posts WHERE file_path = ${`content/${unique}.mdx`}`;
		}
	});

	it("duplicate (slug, lang) insert throws composite unique constraint error", async () => {
		const pg = await import("postgres");
		const sql = pg.default("postgres://blog:blog@localhost:5432/blog");
		postgres = sql;
		const unique = `test-dup-slug-${Date.now()}`;
		try {
			// Same slug + same lang → should fail
			await sql`INSERT INTO posts (file_path, slug, lang, title) VALUES (${`content/en/${unique}-a.mdx`}, ${unique}, 'en', 'Test A')`;
			await expect(
				sql`INSERT INTO posts (file_path, slug, lang, title) VALUES (${`content/en/${unique}-b.mdx`}, ${unique}, 'en', 'Test B')`,
			).rejects.toThrow();
		} finally {
			await sql`DELETE FROM posts WHERE slug = ${unique}`;
		}
	});

	it("same slug with different lang is allowed (composite unique)", async () => {
		const pg = await import("postgres");
		const sql = pg.default("postgres://blog:blog@localhost:5432/blog");
		postgres = sql;
		const unique = `test-bilingual-${Date.now()}`;
		try {
			await sql`INSERT INTO posts (file_path, slug, lang, title) VALUES (${`content/en/${unique}.mdx`}, ${unique}, 'en', 'Test EN')`;
			await expect(
				sql`INSERT INTO posts (file_path, slug, lang, title) VALUES (${`content/pt-br/${unique}.mdx`}, ${unique}, 'pt-br', 'Test PT')`,
			).resolves.not.toThrow();
		} finally {
			await sql`DELETE FROM posts WHERE slug = ${unique}`;
		}
	});
});
