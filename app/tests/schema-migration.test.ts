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
