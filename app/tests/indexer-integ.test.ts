import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { removePost, syncAll, upsertPost } from "#/db/indexer";

const DB_URL = "postgres://blog:blog@localhost:5432/blog";

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();
		server.listen(port, () => server.close(() => resolve(true)));
		server.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);

describe.skipIf(port5432Free)("integration: indexer", () => {
	// definite assignment assertion — assigned in beforeAll
	let sql!: import("postgres").Sql;
	let tmpDir!: string;

	beforeAll(async () => {
		const pg = await import("postgres");
		sql = pg.default(DB_URL);
		tmpDir = await mkdtemp(join(tmpdir(), "indexer-integ-"));
	});

	afterAll(async () => {
		if (tmpDir) {
			await sql`DELETE FROM posts WHERE file_path LIKE ${`${tmpDir}/%`}`;
			await sql.end();
		}
		if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
	});

	function mdx(title: string, extra = "") {
		return `---\ntitle: ${title}\n${extra}---\nContent.`;
	}

	it("upsertPost creates row with is_published=false and correct slug", async () => {
		const dir = join(tmpDir, "en");
		await mkdir(dir, { recursive: true });
		const filePath = join(dir, "integ-hello.mdx");
		await writeFile(filePath, mdx("Integration Hello", "slug: integ-hello\n"));
		await upsertPost(filePath);
		const rows = await sql<{ is_published: boolean; slug: string }[]>`
      SELECT is_published, slug FROM posts WHERE file_path = ${filePath}
    `;
		expect(rows).toHaveLength(1);
		expect(rows[0].is_published).toBe(false);
		expect(rows[0].slug).toBe("integ-hello");
	});

	it("second upsertPost updates title but preserves is_published and view_count", async () => {
		const dir = join(tmpDir, "en");
		await mkdir(dir, { recursive: true });
		const filePath = join(dir, "integ-preserve.mdx");
		await writeFile(filePath, mdx("Original Title", "slug: integ-preserve\n"));
		await upsertPost(filePath);
		await sql`UPDATE posts SET is_published = true, view_count = 5 WHERE file_path = ${filePath}`;
		await writeFile(filePath, mdx("Updated Title", "slug: integ-preserve\n"));
		await upsertPost(filePath);
		const rows = await sql<
			{ title: string; is_published: boolean; view_count: number }[]
		>`
      SELECT title, is_published, view_count FROM posts WHERE file_path = ${filePath}
    `;
		expect(rows).toHaveLength(1);
		expect(rows[0].title).toBe("Updated Title");
		expect(rows[0].is_published).toBe(true);
		expect(rows[0].view_count).toBe(5);
	});

	it("removePost deletes row; subsequent query returns 0 rows", async () => {
		const dir = join(tmpDir, "en");
		await mkdir(dir, { recursive: true });
		const filePath = join(dir, "integ-remove.mdx");
		await writeFile(filePath, mdx("To Remove"));
		await upsertPost(filePath);
		await removePost(filePath);
		const rows = await sql`SELECT id FROM posts WHERE file_path = ${filePath}`;
		expect(rows).toHaveLength(0);
	});

	it("syncAll on directory with 3 .mdx files produces 3 rows", async () => {
		const syncDir = join(tmpDir, "sync3");
		await mkdir(join(syncDir, "en"), { recursive: true });
		await writeFile(join(syncDir, "en", "s1.mdx"), mdx("Sync One"));
		await writeFile(join(syncDir, "en", "s2.mdx"), mdx("Sync Two"));
		await writeFile(join(syncDir, "en", "s3.mdx"), mdx("Sync Three"));
		await syncAll(syncDir);
		const rows =
			await sql`SELECT id FROM posts WHERE file_path LIKE ${`${syncDir}/%`}`;
		expect(rows).toHaveLength(3);
	});

	it("syncAll after deleting a file removes the orphaned row", async () => {
		const syncDir = join(tmpDir, "sync-orphan");
		await mkdir(join(syncDir, "en"), { recursive: true });
		const keepPath = join(syncDir, "en", "keep.mdx");
		const orphanPath = join(syncDir, "en", "orphan.mdx");
		await writeFile(keepPath, mdx("Keep Me"));
		await writeFile(orphanPath, mdx("Orphan"));
		await syncAll(syncDir);
		let rows =
			await sql`SELECT id FROM posts WHERE file_path LIKE ${`${syncDir}/%`}`;
		expect(rows).toHaveLength(2);
		await rm(orphanPath);
		await syncAll(syncDir);
		rows =
			await sql`SELECT id FROM posts WHERE file_path LIKE ${`${syncDir}/%`}`;
		expect(rows).toHaveLength(1);
		const remaining = await sql<{ file_path: string }[]>`
      SELECT file_path FROM posts WHERE file_path LIKE ${`${syncDir}/%`}
    `;
		expect(remaining[0].file_path).toBe(keepPath);
	});
});
