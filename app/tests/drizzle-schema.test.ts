import { execSync } from "node:child_process";
import { createServer } from "node:net";
import { join } from "node:path";
import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as authSchema from "../db/auth-schema";
import type {
	AnalyticsEvent,
	NewAnalyticsEvent,
	NewPost,
	Post,
} from "../db/schema";
import * as schema from "../db/schema";
import { analyticsEvents, posts } from "../db/schema";

const root = join(import.meta.dirname, "../..");

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);

// ─── Unit tests: posts schema ────────────────────────────────────────────────

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

	it("published_at uses withTimezone: true (timestamptz)", () => {
		const col = posts.publishedAt as unknown as Record<string, unknown>;
		expect(col.withTimezone).toBe(true);
	});

	it("indexed_at has defaultNow()", () => {
		const col = posts.indexedAt;
		expect(col.hasDefault).toBe(true);
	});

	it("indexed_at uses withTimezone: true (timestamptz)", () => {
		const col = posts.indexedAt as unknown as Record<string, unknown>;
		expect(col.withTimezone).toBe(true);
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
			viewCount: 0,
			indexedAt: new Date(),
			category: null,
			series: null,
			seriesPart: null,
			draft: null,
		};
		expect(_post.id).toBe(1);
		expect(typeof _post.slug).toBe("string");
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
					DATABASE_URL:
						process.env.DATABASE_URL ??
						"postgres://blog:blog@localhost:5432/blog",
				},
				stdio: "pipe",
			}),
		).not.toThrow();
	});

	it("posts table has all 14 expected columns", async () => {
		const pg = await import("postgres");
		const sql = pg.default(
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
		);
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
		expect(cols).not.toContain("is_published");
		expect(cols).toContain("view_count");
		expect(cols).toContain("indexed_at");
		expect(cols).toContain("category");
		expect(cols).toContain("series");
		expect(cols).toContain("series_part");
		expect(cols).toContain("draft");
		expect(cols).toHaveLength(13);
	});

	it("duplicate file_path insert throws unique constraint error", async () => {
		const pg = await import("postgres");
		const sql = pg.default(
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
		);
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
		const sql = pg.default(
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
		);
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
		const sql = pg.default(
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog",
		);
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

// ─── Unit tests: analyticsEvents schema ─────────────────────────────────────

describe("unit: analyticsEvents schema", () => {
	it("table name is 'analytics_events'", () => {
		expect(
			(analyticsEvents as unknown as Record<symbol, unknown>)[
				Symbol.for("drizzle:Name")
			],
		).toBe("analytics_events");
	});

	it("createdAt uses withTimezone: true (timestamptz)", () => {
		const col = analyticsEvents.createdAt as unknown as Record<string, unknown>;
		expect(col.withTimezone).toBe(true);
	});

	it("createdAt has defaultNow()", () => {
		const col = analyticsEvents.createdAt;
		expect(col.hasDefault).toBe(true);
	});

	it("countryCode is nullable (no notNull)", () => {
		const col = analyticsEvents.countryCode;
		expect(col.notNull).toBeFalsy();
	});

	it("isBot defaults to false", () => {
		const col = analyticsEvents.isBot;
		expect(col.default).toBe(false);
	});

	it("AnalyticsEvent type has expected shape (compile-time check)", () => {
		const _event: AnalyticsEvent = {
			id: 1,
			postId: 42,
			createdAt: new Date(),
			referrerSource: "google",
			lang: "en",
			device: "desktop",
			countryCode: null,
			isBot: false,
		};
		expect(_event.id).toBe(1);
		expect(_event.countryCode).toBeNull();
		expect(_event.isBot).toBe(false);
	});

	it("NewAnalyticsEvent does not require id or createdAt (compile-time check)", () => {
		const _new: NewAnalyticsEvent = {
			postId: 1,
			referrerSource: "direct",
			lang: "pt-br",
			device: "mobile",
		};
		expect(_new.postId).toBe(1);
		// id and createdAt are optional — omitting them must compile without error
	});
});

// ─── Integration tests: analyticsEvents (PGLite) ────────────────────────────

describe("integration: analyticsEvents (PGLite)", () => {
	type CombinedSchema = typeof schema & typeof authSchema;
	type PgliteDb = import("drizzle-orm/pglite").PgliteDatabase<CombinedSchema>;

	let db: PgliteDb;
	let pgliteClient: import("@electric-sql/pglite").PGlite;

	beforeAll(async () => {
		const { PGlite } = await import("@electric-sql/pglite");
		const { drizzle } = await import("drizzle-orm/pglite");
		const { pushSchema } = await import("drizzle-kit/api");

		pgliteClient = new PGlite("memory://");
		await pgliteClient.waitReady;

		db = drizzle<CombinedSchema>(pgliteClient, {
			schema: { ...schema, ...authSchema } as CombinedSchema,
		});

		// Apply current schema (includes analytics_events from this task)
		// drizzle-kit/api's PgDatabase type differs from PgliteDatabase generic; cast required
		// biome-ignore lint/suspicious/noExplicitAny: pushSchema requires db as any
		const result = await pushSchema({ ...schema, ...authSchema }, db as any);
		await result.apply();
	});

	afterAll(async () => {
		await pgliteClient.close();
	});

	it("inserts a single event row referencing a seeded post and reads it back", async () => {
		const [post] = await db
			.insert(posts)
			.values({
				filePath: "content/en/analytics-integ-insert.mdx",
				slug: "analytics-integ-insert",
				lang: "en",
				title: "Analytics Integ Insert",
			})
			.returning();

		const [event] = await db
			.insert(analyticsEvents)
			.values({
				postId: post.id,
				referrerSource: "linkedin",
				lang: "en",
				device: "desktop",
			})
			.returning();

		expect(event.postId).toBe(post.id);
		expect(event.referrerSource).toBe("linkedin");
		expect(event.lang).toBe("en");
		expect(event.device).toBe("desktop");
		expect(event.countryCode).toBeNull();
		expect(event.isBot).toBe(false);
		expect(event.createdAt).toBeInstanceOf(Date);
	});

	it("cascade deletes event row when referenced post is deleted", async () => {
		const [post] = await db
			.insert(posts)
			.values({
				filePath: "content/en/analytics-integ-cascade.mdx",
				slug: "analytics-integ-cascade",
				lang: "en",
				title: "Analytics Integ Cascade",
			})
			.returning();

		const [event] = await db
			.insert(analyticsEvents)
			.values({
				postId: post.id,
				referrerSource: "direct",
				lang: "en",
				device: "mobile",
			})
			.returning();

		// Delete the post — must cascade to analytics_events
		await db.delete(posts).where(eq(posts.id, post.id));

		// Event row must be gone
		const remaining = await db
			.select()
			.from(analyticsEvents)
			.where(eq(analyticsEvents.id, event.id));

		expect(remaining).toHaveLength(0);
	});
});
