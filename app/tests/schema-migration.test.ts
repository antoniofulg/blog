import { readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { type Post, posts } from "#/db/schema";

const root = join(import.meta.dirname, "../..");

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);

// ─── Unit: schema inference ──────────────────────────────────────────────────

describe("unit: posts schema — isPublished removed", () => {
	it("posts table columns do not include is_published", () => {
		const columnNames = Object.keys(posts);
		expect(columnNames).not.toContain("isPublished");
		expect(columnNames).not.toContain("is_published");
	});

	it("Post inferred type does not include isPublished key", () => {
		// Compile-time assertion: if isPublished were still in the schema,
		// the expression below would produce a TS error.
		type HasIsPublished = "isPublished" extends keyof Post ? true : false;
		const result: HasIsPublished = false as HasIsPublished;
		expect(result).toBe(false);
	});

	it("posts table retains all expected columns", () => {
		const columnNames = Object.keys(posts);
		const expected = [
			"id",
			"filePath",
			"slug",
			"lang",
			"title",
			"description",
			"publishedAt",
			"viewCount",
			"indexedAt",
			"category",
			"series",
			"seriesPart",
			"draft",
		];
		for (const col of expected) {
			expect(columnNames).toContain(col);
		}
	});
});

// ─── Unit: migration file validation ────────────────────────────────────────

describe("unit: migration file 0003", () => {
	it("migration file exists in drizzle/", async () => {
		const files = await import("node:fs/promises").then((m) =>
			m.readdir(join(root, "drizzle")),
		);
		const migration = files.find((f) => f.startsWith("0003_"));
		expect(migration).toBeDefined();
	});

	it("migration SQL contains exactly the isPublished DROP COLUMN", async () => {
		const files = await import("node:fs/promises").then((m) =>
			m.readdir(join(root, "drizzle")),
		);
		const migrationFile = files.find((f) => f.startsWith("0003_"));
		expect(migrationFile).toBeDefined();

		const sql = await readFile(
			join(root, "drizzle", migrationFile as string),
			"utf8",
		);
		const statements = sql
			.split(";")
			.map((s) => s.trim())
			.filter(Boolean);

		// Exactly one statement
		expect(statements).toHaveLength(1);

		// That statement is a DROP COLUMN for is_published
		expect(statements[0].toUpperCase()).toContain("ALTER TABLE");
		expect(statements[0].toUpperCase()).toContain("DROP COLUMN");
		expect(statements[0].toLowerCase()).toContain("is_published");
	});

	it("migration SQL does not contain any DROP TABLE statement", async () => {
		const files = await import("node:fs/promises").then((m) =>
			m.readdir(join(root, "drizzle")),
		);
		const migrationFile = files.find((f) => f.startsWith("0003_"));
		const sql = await readFile(
			join(root, "drizzle", migrationFile as string),
			"utf8",
		);
		expect(sql.toUpperCase()).not.toContain("DROP TABLE");
	});
});

// ─── Unit: TZ migration (0004) ──────────────────────────────────────────────

describe("unit: posts schema — timestamptz columns", () => {
	it("publishedAt Drizzle column definition uses withTimezone: true", () => {
		const col = posts.publishedAt as unknown as Record<string, unknown>;
		expect(col.withTimezone).toBe(true);
	});

	it("indexedAt Drizzle column definition uses withTimezone: true", () => {
		const col = posts.indexedAt as unknown as Record<string, unknown>;
		expect(col.withTimezone).toBe(true);
	});

	it("migration file 0004 exists in drizzle/", async () => {
		const files = await import("node:fs/promises").then((m) =>
			m.readdir(join(root, "drizzle")),
		);
		const migration = files.find((f) => f.startsWith("0004_"));
		expect(migration).toBeDefined();
	});

	it("migration 0004 SQL alters published_at to timestamptz USING UTC", async () => {
		const sql = await readFile(
			join(root, "drizzle", "0004_posts_timestamptz.sql"),
			"utf8",
		);
		const upper = sql.toUpperCase();
		expect(upper).toContain("ALTER TABLE");
		expect(upper).toContain("ALTER COLUMN");
		expect(upper).toContain("PUBLISHED_AT");
		expect(upper).toContain("TIMESTAMP WITH TIME ZONE");
		expect(upper).toContain("AT TIME ZONE");
		expect(upper).toContain("UTC");
	});

	it("migration 0004 SQL alters indexed_at to timestamptz USING UTC", async () => {
		const sql = await readFile(
			join(root, "drizzle", "0004_posts_timestamptz.sql"),
			"utf8",
		);
		const upper = sql.toUpperCase();
		expect(upper).toContain("INDEXED_AT");
		expect(upper).toContain("TIMESTAMP WITH TIME ZONE");
	});

	it("migration 0004 SQL does not DROP any column", async () => {
		const sql = await readFile(
			join(root, "drizzle", "0004_posts_timestamptz.sql"),
			"utf8",
		);
		expect(sql.toUpperCase()).not.toContain("DROP COLUMN");
		expect(sql.toUpperCase()).not.toContain("DROP TABLE");
	});

	it("drizzle/meta/_journal.json contains entry for 0004_posts_timestamptz", async () => {
		const raw = await readFile(
			join(root, "drizzle", "meta", "_journal.json"),
			"utf8",
		);
		const journal = JSON.parse(raw) as {
			entries: Array<{ idx: number; tag: string }>;
		};
		const entry = journal.entries.find(
			(e) => e.tag === "0004_posts_timestamptz",
		);
		expect(entry).toBeDefined();
		expect(entry?.idx).toBe(4);
	});

	it("snapshot 0004 shows published_at as timestamp with time zone", async () => {
		const raw = await readFile(
			join(root, "drizzle", "meta", "0004_snapshot.json"),
			"utf8",
		);
		const snapshot = JSON.parse(raw) as {
			tables: { "public.posts": { columns: Record<string, { type: string }> } };
		};
		expect(snapshot.tables["public.posts"].columns.published_at.type).toBe(
			"timestamp with time zone",
		);
	});

	it("snapshot 0004 shows indexed_at as timestamp with time zone", async () => {
		const raw = await readFile(
			join(root, "drizzle", "meta", "0004_snapshot.json"),
			"utf8",
		);
		const snapshot = JSON.parse(raw) as {
			tables: { "public.posts": { columns: Record<string, { type: string }> } };
		};
		expect(snapshot.tables["public.posts"].columns.indexed_at.type).toBe(
			"timestamp with time zone",
		);
	});
});

// ─── Integration: migration round-trip ──────────────────────────────────────

describe.skipIf(port5432Free)(
	"integration: migration round-trip (requires local postgres)",
	() => {
		const DB_URL = "postgres://blog:blog@localhost:5432/blog";
		let sql: import("postgres").Sql | undefined;

		beforeAll(async () => {
			const pg = await import("postgres");
			sql = pg.default(DB_URL);
		});

		afterAll(async () => {
			await sql?.end();
		});

		it("is_published column is absent from posts table after migration", async () => {
			// biome-ignore lint/style/noNonNullAssertion: set in beforeAll
			const rows = await sql!<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posts'
        AND column_name = 'is_published'
    `;
			expect(rows).toHaveLength(0);
		});

		it("posts table still has expected columns after migration", async () => {
			// biome-ignore lint/style/noNonNullAssertion: set in beforeAll
			const rows = await sql!<{ column_name: string }[]>`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'posts'
      ORDER BY column_name
    `;
			const cols = rows.map((r) => r.column_name);
			expect(cols).toContain("slug");
			expect(cols).toContain("lang");
			expect(cols).toContain("title");
			expect(cols).toContain("view_count");
			expect(cols).not.toContain("is_published");
		});
	},
);
