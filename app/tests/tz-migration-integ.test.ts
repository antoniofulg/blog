/**
 * Integration tests for the TZ migration (task_01: posts timestamp → timestamptz).
 *
 * Two test groups:
 *   1. Round-trip: insert a row with a UTC Date, read it back, assert UTC identity preserved.
 *   2. Migration: push old schema (timestamp), seed 10 rows, run ALTER COLUMN SQL, verify
 *      row count unchanged and values intact.
 *
 * Uses PGLite in-memory via createTestDb() — no external postgres required.
 */

import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { posts } from "#/db/schema";
import type { TestDb } from "../../tests/e2e/db";
import { createTestDb } from "../../tests/e2e/db";

const root = join(import.meta.dirname, "../..");

// ─── 1. Round-trip: UTC timestamp survives insert + read ─────────────────────

describe("integration: timestamptz round-trip (PGLite)", () => {
	let testDb: TestDb;

	beforeAll(async () => {
		testDb = await createTestDb();
	});

	afterAll(async () => {
		await testDb.close();
	});

	it("insert Date('2025-01-15T10:00:00Z') and read back same UTC instant", async () => {
		const utcDate = new Date("2025-01-15T10:00:00Z");
		const expectedMs = utcDate.getTime();

		// Insert via Drizzle ORM (using the updated timestamptz schema)
		const [inserted] = await testDb.db
			.insert(posts)
			.values({
				filePath: "content/en/tz-test.mdx",
				slug: "tz-test",
				lang: "en",
				title: "TZ Test Post",
				publishedAt: utcDate,
			})
			.returning();

		expect(inserted).toBeDefined();

		// Read back
		const rows = await testDb.db.select().from(posts);
		const row = rows.find((r) => r.slug === "tz-test");

		expect(row).toBeDefined();
		// The returned Date must represent the exact same UTC instant
		expect(row?.publishedAt?.getTime()).toBe(expectedMs);
	});

	it("indexedAt defaults to a valid UTC Date", async () => {
		const before = Date.now();
		const [inserted] = await testDb.db
			.insert(posts)
			.values({
				filePath: "content/en/tz-indexed-test.mdx",
				slug: "tz-indexed-test",
				lang: "en",
				title: "TZ Indexed Test",
			})
			.returning();
		const after = Date.now();

		expect(inserted.indexedAt).toBeInstanceOf(Date);
		const ts = inserted.indexedAt.getTime();
		expect(ts).toBeGreaterThanOrEqual(before);
		expect(ts).toBeLessThanOrEqual(after);
	});
});

// ─── 2. Migration: apply DDL to old schema, verify count preserved ───────────

describe("integration: TZ migration SQL against old schema (PGLite)", () => {
	let client: PGlite;

	beforeAll(async () => {
		client = new PGlite("memory://");
		await client.waitReady;

		// Create posts table with OLD schema (timestamp without time zone)
		// This simulates the pre-migration state that existed before 0004.
		await client.exec(`
      CREATE TABLE IF NOT EXISTS posts (
        id SERIAL PRIMARY KEY,
        file_path TEXT NOT NULL UNIQUE,
        slug TEXT NOT NULL,
        lang TEXT NOT NULL DEFAULT 'en',
        title TEXT NOT NULL,
        description TEXT,
        published_at TIMESTAMP,
        view_count INTEGER NOT NULL DEFAULT 0,
        indexed_at TIMESTAMP NOT NULL DEFAULT NOW(),
        category TEXT,
        series TEXT,
        series_part INTEGER,
        draft BOOLEAN,
        UNIQUE(slug, lang)
      );
    `);

		// Seed 10 sample posts with known timestamps
		for (let i = 1; i <= 10; i++) {
			await client.exec(`
        INSERT INTO posts (file_path, slug, lang, title, published_at)
        VALUES (
          'content/en/post-${i}.mdx',
          'post-${i}',
          'en',
          'Post ${i}',
          '2025-0${Math.min(i, 9)}-01 12:00:00'
        );
      `);
		}
	});

	afterAll(async () => {
		await client.close();
	});

	it("10 rows exist before migration", async () => {
		const result = await client.query<{ count: string }>(
			"SELECT COUNT(*) AS count FROM posts",
		);
		expect(Number(result.rows[0]?.count)).toBe(10);
	});

	it("migration SQL applies without error", async () => {
		// Read and apply the real migration SQL from drizzle/0004_posts_timestamptz.sql
		const sqlFile = await readFile(
			join(root, "drizzle", "0004_posts_timestamptz.sql"),
			"utf8",
		);
		// Strip comment lines, execute each non-empty statement
		const statements = sqlFile
			.split(";")
			.map((s) => s.replace(/--.*$/gm, "").trim())
			.filter(Boolean);

		for (const stmt of statements) {
			await client.exec(`${stmt};`);
		}
	});

	it("row count preserved after migration (AC-2)", async () => {
		const result = await client.query<{ count: string }>(
			"SELECT COUNT(*) AS count FROM posts",
		);
		expect(Number(result.rows[0]?.count)).toBe(10);
	});

	it("published_at column type is now timestamptz after migration (AC-1)", async () => {
		const result = await client.query<{ data_type: string; udt_name: string }>(
			`SELECT data_type, udt_name FROM information_schema.columns
       WHERE table_name = 'posts' AND column_name = 'published_at'`,
		);
		const row = result.rows[0];
		expect(row).toBeDefined();
		// PostgreSQL reports timestamptz as data_type='timestamp with time zone'
		expect(row?.data_type.toLowerCase()).toContain("timestamp");
		expect(row?.data_type.toLowerCase()).toContain("time zone");
	});

	it("indexed_at column type is now timestamptz after migration (AC-1)", async () => {
		const result = await client.query<{ data_type: string }>(
			`SELECT data_type FROM information_schema.columns
       WHERE table_name = 'posts' AND column_name = 'indexed_at'`,
		);
		const row = result.rows[0];
		expect(row).toBeDefined();
		expect(row?.data_type.toLowerCase()).toContain("timestamp");
		expect(row?.data_type.toLowerCase()).toContain("time zone");
	});

	it("existing UTC values preserved after migration (AC-3)", async () => {
		// The stored value '2025-01-01 12:00:00' was inserted as a plain timestamp
		// and the migration USING published_at AT TIME ZONE 'UTC' must preserve the
		// absolute instant at 2025-01-01 12:00:00 UTC (regardless of server TZ).
		// We extract the epoch to compare timezone-agnostically.
		const result = await client.query<{ epoch: number }>(
			`SELECT EXTRACT(EPOCH FROM published_at) AS epoch FROM posts WHERE slug = 'post-1'`,
		);
		const epoch = result.rows[0]?.epoch;
		expect(epoch).toBeDefined();
		// 2025-01-01 12:00:00 UTC in Unix epoch seconds
		const expected = new Date("2025-01-01T12:00:00Z").getTime() / 1000;
		expect(Number(epoch)).toBe(expected);
	});
});
