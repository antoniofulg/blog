import { execFile } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { runSync } from "../../scripts/sync";

const execFileAsync = promisify(execFile);
const DB_URL =
	process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog";

function isPortFree(port: number): Promise<boolean> {
	return new Promise((res) => {
		const server = createServer();
		server.listen(port, () => server.close(() => res(true)));
		server.on("error", () => res(false));
	});
}

const port5432Free = await isPortFree(5432);

describe.skipIf(port5432Free)("integration: sync script", () => {
	let sql!: import("postgres").Sql;
	let tmpDir!: string;
	let prevOgDir: string | undefined;

	beforeAll(async () => {
		const pg = await import("postgres");
		sql = pg.default(DB_URL);
		tmpDir = await mkdtemp(join(tmpdir(), "sync-integ-"));
		// Redirect OG writes/unlinks to a throwaway dir. runSync invokes the real
		// syncAll, whose full-table cleanup unlinks the OG card of every real post
		// row in the shared dev DB — wiping the committed public/og/*.png cards
		// otherwise. Set on process.env so the spawned `bun run scripts/sync.ts`
		// subprocesses below inherit it via their `{ ...process.env }` env.
		prevOgDir = process.env.OG_OUTPUT_DIR;
		process.env.OG_OUTPUT_DIR = join(tmpDir, "og-out");
		await sql`DELETE FROM posts WHERE file_path LIKE ${`${tmpdir()}/%`}`;
	});

	afterAll(async () => {
		if (prevOgDir === undefined) delete process.env.OG_OUTPUT_DIR;
		else process.env.OG_OUTPUT_DIR = prevOgDir;
		if (sql && tmpDir) {
			await sql`DELETE FROM posts WHERE file_path LIKE ${`${tmpDir}/%`}`;
			await sql.end();
		}
		if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
	});

	function mdx(title: string) {
		return `---\ntitle: ${title}\n---\nContent.`;
	}

	it("2 .mdx files → 2 rows in posts", async () => {
		const dir = join(tmpDir, "sync2");
		await mkdir(join(dir, "en"), { recursive: true });
		await writeFile(join(dir, "en", "t7s2alpha.mdx"), mdx("Post Alpha"));
		await writeFile(join(dir, "en", "t7s2beta.mdx"), mdx("Post Beta"));
		await runSync(["--dir", dir]);
		const rows =
			await sql`SELECT id FROM posts WHERE file_path LIKE ${`${dir}/%`}`;
		expect(rows).toHaveLength(2);
	});

	it("idempotent: run twice → same 2 rows", async () => {
		const dir = join(tmpDir, "sync-idem");
		await mkdir(join(dir, "en"), { recursive: true });
		await writeFile(join(dir, "en", "t7idema.mdx"), mdx("Idem A"));
		await writeFile(join(dir, "en", "t7idemb.mdx"), mdx("Idem B"));
		await runSync(["--dir", dir]);
		await runSync(["--dir", dir]);
		const rows =
			await sql`SELECT id FROM posts WHERE file_path LIKE ${`${dir}/%`}`;
		expect(rows).toHaveLength(2);
	});

	it("delete one file → 1 row (orphan removed)", async () => {
		const dir = join(tmpDir, "sync-orphan");
		await mkdir(join(dir, "en"), { recursive: true });
		const keepPath = join(dir, "en", "t7keepme.mdx");
		const orphanPath = join(dir, "en", "t7orphan.mdx");
		await writeFile(keepPath, mdx("Keep Me"));
		await writeFile(orphanPath, mdx("Orphan Post"));
		await runSync(["--dir", dir]);
		await rm(orphanPath);
		await runSync(["--dir", dir]);
		const rows =
			await sql`SELECT id FROM posts WHERE file_path LIKE ${`${dir}/%`}`;
		expect(rows).toHaveLength(1);
		const remaining = await sql<{ file_path: string }[]>`
      SELECT file_path FROM posts WHERE file_path LIKE ${`${dir}/%`}
    `;
		expect(remaining[0]?.file_path).toBe(keepPath);
	});

	it("process exits non-zero when .mdx has missing required title field", async () => {
		const dir = join(tmpDir, "sync-malformed");
		await mkdir(join(dir, "en"), { recursive: true });
		await writeFile(
			join(dir, "en", "bad.mdx"),
			"---\nnotitle: true\n---\nContent.",
		);
		const scriptPath = resolve(import.meta.dirname, "../../scripts/sync.ts");
		await expect(
			execFileAsync("bun", ["run", scriptPath, "--dir", dir], {
				env: { ...process.env, DATABASE_URL: DB_URL },
				timeout: 15000,
			}),
		).rejects.toMatchObject({ code: 1 });
	}, 20000);

	it("process exits cleanly (exit 0) after sync completes", async () => {
		const dir = join(tmpDir, "sync-exit");
		await mkdir(join(dir, "en"), { recursive: true });
		await writeFile(join(dir, "en", "t7exitpost.mdx"), mdx("Exit Test"));
		const scriptPath = resolve(import.meta.dirname, "../../scripts/sync.ts");
		await expect(
			execFileAsync("bun", ["run", scriptPath, "--dir", dir], {
				env: { ...process.env, DATABASE_URL: DB_URL },
				timeout: 15000,
			}),
		).resolves.toMatchObject({ stderr: "" });
	}, 20000);
});
