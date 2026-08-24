import {
	afterAll,
	beforeAll,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import { mkdtemp, rm, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── Mock indexer so DB is not required ──────────────────────────────────────
// Split from unit tests per task-05 learning: jest.mock is file-scoped.

const indexerMocks = (() => ({
	upsertPost: jest.fn().mockResolvedValue(undefined),
	removePost: jest.fn().mockResolvedValue(undefined),
}))();

mock.module("#/db/indexer", () => indexerMocks);

const { startContentWatcher } = await import("#/lib/watcher.server");

async function waitForCondition(
	condition: () => void,
	timeoutMs = 2000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		try {
			condition();
			return;
		} catch {
			await new Promise<void>((resolve) => setImmediate(resolve));
		}
	}
	condition();
}

// ─── Bundle / config check ────────────────────────────────────────────────────

describe("config: vite-env-only", () => {
	test("vite.config.ts protects watcher.server from client bundle", async () => {
		const { readFile } = await import("node:fs/promises");
		const src = await readFile(join(process.cwd(), "vite.config.ts"), "utf8");
		expect(src).toContain("#/lib/watcher.server");
		expect(src).toContain("serverOnlyStubPlugin");
	});

	test("vite.config.ts includes content-watcher-dev Vite plugin with apply:serve", async () => {
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

	test("writing a new .mdx file calls upsertPost within 2s", async () => {
		indexerMocks.upsertPost.mockClear();
		const filePath = join(tmpDir, "mech-new.mdx");
		await writeFile(filePath, "---\ntitle: Mech New\n---\nContent.");
		await waitForCondition(() => {
			expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath);
		});
	});

	test("editing an existing .mdx file calls upsertPost again within 2s", async () => {
		const filePath = join(tmpDir, "mech-edit.mdx");
		await writeFile(filePath, "---\ntitle: Original\n---\nContent.");
		await waitForCondition(() =>
			expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath),
		);
		indexerMocks.upsertPost.mockClear();
		await writeFile(filePath, "---\ntitle: Updated\n---\nContent.");
		await waitForCondition(() => {
			expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath);
		});
	});

	test("deleting an .mdx file calls removePost within 2s", async () => {
		indexerMocks.removePost.mockClear();
		const filePath = join(tmpDir, "mech-delete.mdx");
		await writeFile(filePath, "---\ntitle: To Delete\n---\nContent.");
		await waitForCondition(() =>
			expect(indexerMocks.upsertPost).toHaveBeenCalledWith(filePath),
		);
		await unlink(filePath);
		await waitForCondition(() => {
			expect(indexerMocks.removePost).toHaveBeenCalledWith(filePath);
		});
	});
});
