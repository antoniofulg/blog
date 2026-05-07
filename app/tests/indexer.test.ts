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
	const orderBy = vi.fn().mockResolvedValue([]);
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
		orderBy,
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
import { getPublishedPostsFn } from "#/db/queries";
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
	mocks.orderBy.mockResolvedValue([]);
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

// ─── Unit: upsertPost — lang derivation ─────────────────────────────────────

describe("unit: upsertPost — lang derivation", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "indexer-lang-"));
		await mkdir(join(tmpDir, "en"), { recursive: true });
		await mkdir(join(tmpDir, "pt-br"), { recursive: true });
		const mdx = (title: string) => `---\ntitle: ${title}\n---\nContent.`;
		await writeFile(join(tmpDir, "en", "post.mdx"), mdx("English Post"));
		await writeFile(join(tmpDir, "pt-br", "post.mdx"), mdx("Portuguese Post"));
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetMocks);

	it("derives lang='en' from content/en/file.mdx path", async () => {
		await upsertPost(join(tmpDir, "en", "post.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.lang).toBe("en");
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			set: Record<string, unknown>;
		};
		expect(conflictArg.set.lang).toBe("en");
	});

	it("derives lang='pt-br' from content/pt-br/file.mdx path", async () => {
		await upsertPost(join(tmpDir, "pt-br", "post.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.lang).toBe("pt-br");
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			set: Record<string, unknown>;
		};
		expect(conflictArg.set.lang).toBe("pt-br");
	});
});

// ─── Unit: upsertPost — new frontmatter fields ───────────────────────────────

describe("unit: upsertPost — new frontmatter fields", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "indexer-fields-"));
		await mkdir(join(tmpDir, "en"), { recursive: true });
		await writeFile(
			join(tmpDir, "en", "with-category.mdx"),
			"---\ntitle: Cat Post\ncategory: frontend\n---\nContent.",
		);
		await writeFile(
			join(tmpDir, "en", "with-series.mdx"),
			"---\ntitle: Series Post\nseries: my-series\nseriesPart: 2\n---\nContent.",
		);
		await writeFile(
			join(tmpDir, "en", "with-draft.mdx"),
			"---\ntitle: Draft Post\ndraft: true\n---\nContent.",
		);
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetMocks);

	it("persists category value from frontmatter", async () => {
		await upsertPost(join(tmpDir, "en", "with-category.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.category).toBe("frontend");
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			set: Record<string, unknown>;
		};
		expect(conflictArg.set.category).toBe("frontend");
	});

	it("persists series and seriesPart from frontmatter", async () => {
		await upsertPost(join(tmpDir, "en", "with-series.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.series).toBe("my-series");
		expect(valuesArg.seriesPart).toBe(2);
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			set: Record<string, unknown>;
		};
		expect(conflictArg.set.series).toBe("my-series");
		expect(conflictArg.set.seriesPart).toBe(2);
	});

	it("persists draft=true from frontmatter", async () => {
		await upsertPost(join(tmpDir, "en", "with-draft.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.draft).toBe(true);
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			set: Record<string, unknown>;
		};
		expect(conflictArg.set.draft).toBe(true);
	});

	it("sets category null when not in frontmatter", async () => {
		await upsertPost(join(tmpDir, "en", "with-draft.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.category).toBeNull();
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

	it("file-move: deletes stale row before upserting to avoid UNIQUE(slug, lang) conflict", async () => {
		const movedPath = join(tmpDir, "moved-post.mdx");
		mocks.selectWhere.mockResolvedValue([{ filePath: movedPath }]);
		await syncAll(tmpDir);
		// stale row for moved file deleted
		expect(mocks.deleteChain).toHaveBeenCalledTimes(1);
		expect(mocks.deleteChain).toHaveBeenCalledWith(posts);
		// current files upserted (3 files: a.mdx, b.mdx, sub/c.mdx)
		expect(mocks.insert).toHaveBeenCalledTimes(3);
		// delete must precede all inserts
		const deleteOrder = mocks.deleteChain.mock.invocationCallOrder[0];
		const firstInsertOrder = mocks.insert.mock.invocationCallOrder[0];
		expect(deleteOrder).toBeLessThan(firstInsertOrder);
	});
});

// ─── Unit: getPublishedPostsFn ───────────────────────────────────────────────

function extractSQLParams(node: unknown, acc: unknown[] = []): unknown[] {
	if (!node || typeof node !== "object") return acc;
	if (Array.isArray(node)) {
		for (const item of node) extractSQLParams(item, acc);
		return acc;
	}
	const obj = node as Record<string, unknown>;
	if ("value" in obj && "encoder" in obj) {
		acc.push(obj.value);
		return acc;
	}
	if ("queryChunks" in obj && Array.isArray(obj.queryChunks)) {
		for (const chunk of obj.queryChunks as unknown[]) {
			extractSQLParams(chunk, acc);
		}
	}
	return acc;
}

describe("unit: getPublishedPostsFn", () => {
	beforeEach(() => {
		resetMocks();
		mocks.orderBy.mockResolvedValue([]);
		mocks.selectWhere.mockReturnValue({ orderBy: mocks.orderBy });
	});

	it("calls db.select chain and returns posts for lang='en'", async () => {
		const result = await getPublishedPostsFn("en");
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(mocks.selectFrom).toHaveBeenCalledWith(posts);
		expect(mocks.selectWhere).toHaveBeenCalledTimes(1);
		expect(mocks.orderBy).toHaveBeenCalledTimes(1);
		expect(result).toEqual([]);
	});

	it("calls db.select chain for lang='pt-br'", async () => {
		await getPublishedPostsFn("pt-br");
		expect(mocks.selectWhere).toHaveBeenCalledTimes(1);
		expect(mocks.orderBy).toHaveBeenCalledTimes(1);
	});

	it("passes lang value into where clause for lang='en'", async () => {
		await getPublishedPostsFn("en");
		const whereArg = mocks.selectWhere.mock.calls[0][0];
		expect(whereArg).toBeDefined();
		expect(extractSQLParams(whereArg)).toContain("en");
	});

	it("passes lang value into where clause for lang='pt-br'", async () => {
		await getPublishedPostsFn("pt-br");
		const whereArg = mocks.selectWhere.mock.calls[0][0];
		expect(whereArg).toBeDefined();
		expect(extractSQLParams(whereArg)).toContain("pt-br");
	});
});
