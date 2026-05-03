import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

// ─── Mock indexer so DB is not required ──────────────────────────────────────
// Split from unit tests per task-05 learning: vi.mock is file-scoped.

const indexerMocks = vi.hoisted(() => ({
	upsertPost: vi.fn().mockResolvedValue(undefined),
	removePost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/db/indexer", () => indexerMocks);

import { startContentWatcher } from "#/lib/watcher.server";

// ─── Bundle / config check ────────────────────────────────────────────────────

describe("config: vite-env-only", () => {
	it("vite.config.ts lists watcher.server.ts in denyImports client files", async () => {
		const { readFile } = await import("node:fs/promises");
		const src = await readFile(join(process.cwd(), "vite.config.ts"), "utf8");
		expect(src).toContain("watcher.server.ts");
		expect(src).toContain("denyImports");
	});

	it("vite.config.ts includes content-watcher-dev Vite plugin with apply:serve", async () => {
		const { readFile } = await import("node:fs/promises");
		const src = await readFile(join(process.cwd(), "vite.config.ts"), "utf8");
		expect(src).toContain("content-watcher-dev");
		expect(src).toContain('apply: "serve"');
	});
});

// ─── Mechanism: real fs.watch + mocked indexer ───────────────────────────────
// Watcher started once in beforeAll; each test uses a unique filename
// to avoid cross-test interference.

describe("mechanism: real fs.watch", () => {
	let tmpDir!: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "watcher-mech-"));
		// Start watcher once for the entire describe block
		startContentWatcher(tmpDir);
		// Give fs.watch a moment to register with the OS
		await new Promise((r) => setTimeout(r, 50));
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	it("writing a new .mdx file calls upsertPost within 2s", async () => {
		indexerMocks.upsertPost.mockClear();
		const filePath = join(tmpDir, "mech-new.mdx");
		await writeFile(filePath, "---\ntitle: Mech New\n---\nContent.");
		await vi.waitFor(
			() => {
				expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath);
			},
			{ timeout: 2000, interval: 50 },
		);
	});

	it("editing an existing .mdx file calls upsertPost again within 2s", async () => {
		const filePath = join(tmpDir, "mech-edit.mdx");
		await writeFile(filePath, "---\ntitle: Original\n---\nContent.");
		await vi.waitFor(
			() => expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath),
			{ timeout: 2000 },
		);
		indexerMocks.upsertPost.mockClear();
		await writeFile(filePath, "---\ntitle: Updated\n---\nContent.");
		await vi.waitFor(
			() => {
				expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath);
			},
			{ timeout: 2000, interval: 50 },
		);
	});

	it("deleting an .mdx file calls removePost within 2s", async () => {
		indexerMocks.removePost.mockClear();
		const filePath = join(tmpDir, "mech-delete.mdx");
		await writeFile(filePath, "---\ntitle: To Delete\n---\nContent.");
		await vi.waitFor(
			() => expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath),
			{ timeout: 2000 },
		);
		await unlink(filePath);
		await vi.waitFor(
			() => {
				expect(indexerMocks.removePost).toHaveBeenCalledWith(filePath);
			},
			{ timeout: 2000, interval: 50 },
		);
	});
});
