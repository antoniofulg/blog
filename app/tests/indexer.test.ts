import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

// ─── Hoisted mocks for db ────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
	const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
	const insert = vi.fn().mockReturnValue({ values });
	const deleteWhere = vi.fn().mockResolvedValue([]);
	const deleteChain = vi.fn().mockReturnValue({ where: deleteWhere });
	const selectWhere = vi.fn().mockResolvedValue([]);
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });
	return {
		insert,
		values,
		onConflictDoUpdate,
		deleteChain,
		deleteWhere,
		select,
		selectFrom,
		selectWhere,
	};
});

vi.mock("#/db/client", () => ({
	db: {
		insert: mocks.insert,
		delete: mocks.deleteChain,
		select: mocks.select,
	},
}));

import { removePost, syncAll, upsertPost } from "#/db/indexer";
import { posts } from "#/db/schema";

const FIXTURES = join(import.meta.dirname, "fixtures");

function resetMocks() {
	vi.clearAllMocks();
	mocks.onConflictDoUpdate.mockResolvedValue([]);
	mocks.values.mockReturnValue({
		onConflictDoUpdate: mocks.onConflictDoUpdate,
	});
	mocks.insert.mockReturnValue({ values: mocks.values });
	mocks.deleteWhere.mockResolvedValue([]);
	mocks.deleteChain.mockReturnValue({ where: mocks.deleteWhere });
	mocks.selectWhere.mockResolvedValue([]);
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
}

// ─── Unit: upsertPost ────────────────────────────────────────────────────────

describe("unit: upsertPost", () => {
	beforeEach(resetMocks);

	it("calls db.insert().values().onConflictDoUpdate() with correct field mapping", async () => {
		await upsertPost(join(FIXTURES, "hello.mdx"));
		expect(mocks.insert).toHaveBeenCalledWith(posts);
		expect(mocks.values).toHaveBeenCalledTimes(1);
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.title).toBe("Hello World");
		expect(valuesArg.description).toBe("A short intro post.");
		expect(valuesArg.isPublished).toBe(false);
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			target: unknown;
			set: Record<string, unknown>;
		};
		expect(conflictArg.target).toBe(posts.filePath);
		expect(conflictArg.set.title).toBe("Hello World");
		expect("isPublished" in conflictArg.set).toBe(false);
		expect("viewCount" in conflictArg.set).toBe(false);
	});

	it("derives slug from frontmatter slug field when present", async () => {
		await upsertPost(join(FIXTURES, "hello.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.slug).toBe("hello-world");
	});

	it("falls back to filename without extension when frontmatter has no slug", async () => {
		await upsertPost(join(FIXTURES, "no-slug.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.slug).toBe("no-slug");
	});
});

// ─── Unit: removePost ────────────────────────────────────────────────────────

describe("unit: removePost", () => {
	beforeEach(resetMocks);

	it("calls db.delete().where() with the posts table", async () => {
		await removePost("content/hello.mdx");
		expect(mocks.deleteChain).toHaveBeenCalledWith(posts);
		expect(mocks.deleteWhere).toHaveBeenCalledTimes(1);
	});
});

// ─── Unit: syncAll ───────────────────────────────────────────────────────────

describe("unit: syncAll", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "indexer-unit-"));
		await mkdir(join(tmpDir, "sub"), { recursive: true });
		const mdx = (title: string) => `---\ntitle: ${title}\n---\nContent.`;
		await writeFile(join(tmpDir, "a.mdx"), mdx("Post A"));
		await writeFile(join(tmpDir, "b.mdx"), mdx("Post B"));
		await writeFile(join(tmpDir, "sub", "c.mdx"), mdx("Post C"));
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetMocks);

	it("globs all .mdx files and calls upsertPost for each", async () => {
		mocks.selectWhere.mockResolvedValue([]);
		await syncAll(tmpDir);
		expect(mocks.insert).toHaveBeenCalledTimes(3);
	});

	it("deletes row whose file_path no longer exists on disk", async () => {
		const orphanPath = join(tmpDir, "orphan.mdx");
		const existingPath = join(tmpDir, "a.mdx");
		mocks.selectWhere.mockResolvedValue([
			{ filePath: existingPath },
			{ filePath: orphanPath },
		]);
		await syncAll(tmpDir);
		expect(mocks.deleteChain).toHaveBeenCalledTimes(1);
		expect(mocks.deleteChain).toHaveBeenCalledWith(posts);
	});
});
