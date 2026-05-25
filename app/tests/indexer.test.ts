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

// Mock OG generator — returns null by default; individual tests can override.
// This also keeps existing unit tests fast (no real satori render).
vi.mock("#/lib/og/generate", () => ({
	generateOgImage: vi.fn().mockResolvedValue(null),
}));

// Mock code-block walker — returns null by default.
vi.mock("#/lib/mdx/code-blocks.server", () => ({
	findFirstCodeBlock: vi.fn().mockReturnValue(null),
}));

import { removePost, syncAll, upsertPost } from "#/db/indexer";
import { listPostsFn } from "#/db/queries";
import { posts } from "#/db/schema";
import { findFirstCodeBlock } from "#/lib/mdx/code-blocks.server";
import { generateOgImage } from "#/lib/og/generate";

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
		await upsertPost(join(FIXTURES, "en", "hello.mdx"));
		expect(mocks.insert).toHaveBeenCalledWith(posts);
		expect(mocks.values).toHaveBeenCalledTimes(1);
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.title).toBe("Hello World");
		expect(valuesArg.description).toBe("A short intro post.");
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
		const conflictArg = mocks.onConflictDoUpdate.mock.calls[0][0] as {
			target: unknown;
			set: Record<string, unknown>;
		};
		expect(conflictArg.target).toBe(posts.filePath);
		expect(conflictArg.set.title).toBe("Hello World");
		expect("viewCount" in conflictArg.set).toBe(false);
	});

	it("derives slug from frontmatter slug field when present", async () => {
		await upsertPost(join(FIXTURES, "en", "hello.mdx"));
		const valuesArg = mocks.values.mock.calls[0][0] as Record<string, unknown>;
		expect(valuesArg.slug).toBe("hello-world");
	});

	it("falls back to filename without extension when frontmatter has no slug", async () => {
		await upsertPost(join(FIXTURES, "en", "no-slug.mdx"));
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

// ─── Unit: upsertPost — invalid locale ──────────────────────────────────────

describe("unit: upsertPost — invalid locale", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "indexer-invalid-locale-"));
		await mkdir(join(tmpDir, "fr"), { recursive: true });
		await writeFile(
			join(tmpDir, "fr", "post.mdx"),
			"---\ntitle: French Post\n---\nContent.",
		);
	});

	afterAll(async () => {
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetMocks);

	it("throws on unsupported locale directory and does not call db.insert", async () => {
		await expect(upsertPost(join(tmpDir, "fr", "post.mdx"))).rejects.toThrow(
			/Unsupported locale directory "fr"/,
		);
		expect(mocks.insert).not.toHaveBeenCalled();
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
		await mkdir(join(tmpDir, "en"), { recursive: true });
		await mkdir(join(tmpDir, "pt-br"), { recursive: true });
		const mdx = (title: string) => `---\ntitle: ${title}\n---\nContent.`;
		await writeFile(join(tmpDir, "en", "a.mdx"), mdx("Post A"));
		await writeFile(join(tmpDir, "en", "b.mdx"), mdx("Post B"));
		await writeFile(join(tmpDir, "pt-br", "c.mdx"), mdx("Post C"));
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
		const orphanPath = join(tmpDir, "en", "orphan.mdx");
		const existingPath = join(tmpDir, "en", "a.mdx");
		mocks.selectWhere.mockResolvedValue([
			{ filePath: existingPath },
			{ filePath: orphanPath },
		]);
		await syncAll(tmpDir);
		expect(mocks.deleteChain).toHaveBeenCalledTimes(1);
		expect(mocks.deleteChain).toHaveBeenCalledWith(posts);
	});

	it("file-move: deletes stale row before upserting to avoid UNIQUE(slug, lang) conflict", async () => {
		const movedPath = join(tmpDir, "en", "moved-post.mdx");
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

// ─── Unit: listPostsFn ───────────────────────────────────────────────────────

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

describe("unit: listPostsFn", () => {
	beforeEach(() => {
		resetMocks();
		mocks.orderBy.mockResolvedValue([]);
		mocks.selectWhere.mockReturnValue({ orderBy: mocks.orderBy });
	});

	it("calls db.select chain and returns posts for lang='en'", async () => {
		const result = await listPostsFn("en");
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(mocks.selectFrom).toHaveBeenCalledWith(posts);
		expect(mocks.selectWhere).toHaveBeenCalledTimes(1);
		expect(mocks.orderBy).toHaveBeenCalledTimes(1);
		expect(result).toEqual([]);
	});

	it("calls db.select chain for lang='pt-br'", async () => {
		await listPostsFn("pt-br");
		expect(mocks.selectWhere).toHaveBeenCalledTimes(1);
		expect(mocks.orderBy).toHaveBeenCalledTimes(1);
	});

	it("passes lang value into where clause for lang='en'", async () => {
		await listPostsFn("en");
		const whereArg = mocks.selectWhere.mock.calls[0][0];
		expect(whereArg).toBeDefined();
		expect(extractSQLParams(whereArg)).toContain("en");
	});

	it("passes lang value into where clause for lang='pt-br'", async () => {
		await listPostsFn("pt-br");
		const whereArg = mocks.selectWhere.mock.calls[0][0];
		expect(whereArg).toBeDefined();
		expect(extractSQLParams(whereArg)).toContain("pt-br");
	});
});

// ─── Unit: upsertPost — OG integration ──────────────────────────────────────

describe("unit: upsertPost — OG integration", () => {
	beforeEach(resetMocks);

	it("calls generateOgImage with correct locale/slug/title after frontmatter parse", async () => {
		vi.mocked(findFirstCodeBlock).mockReturnValue({
			lang: "typescript",
			code: "const x = 1;",
		});
		vi.mocked(generateOgImage).mockResolvedValue("/og/en/hello-world.png");

		await upsertPost(join(FIXTURES, "en", "hello.mdx"));

		expect(generateOgImage).toHaveBeenCalledOnce();
		const callArg = vi.mocked(generateOgImage).mock.calls[0]?.[0];
		expect(callArg?.locale).toBe("en");
		expect(callArg?.slug).toBe("hello-world");
		expect(callArg?.title).toBe("Hello World");
		expect(callArg?.firstCodeBlock).toEqual({
			lang: "typescript",
			code: "const x = 1;",
		});
	});

	it("skips generateOgImage when walker returns null (no code block)", async () => {
		vi.mocked(findFirstCodeBlock).mockReturnValue(null);

		await upsertPost(join(FIXTURES, "en", "hello.mdx"));

		// generateOgImage must NOT be called when there is no code block (AC-4)
		expect(generateOgImage).not.toHaveBeenCalled();
		// DB upsert must still happen
		expect(mocks.insert).toHaveBeenCalledWith(posts);
	});

	it("AC-5: generateOgImage returning null does not interrupt DB upsert", async () => {
		vi.mocked(findFirstCodeBlock).mockReturnValue({
			lang: "ts",
			code: "const x = 1;",
		});
		// Simulate OG generation returning null (internal failure)
		vi.mocked(generateOgImage).mockResolvedValue(null);

		await upsertPost(join(FIXTURES, "en", "hello.mdx"));

		// DB upsert must still have been called despite OG returning null
		expect(mocks.insert).toHaveBeenCalledWith(posts);
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
	});

	it("AC-5b: generateOgImage throwing does not interrupt DB upsert", async () => {
		vi.mocked(findFirstCodeBlock).mockReturnValue({
			lang: "ts",
			code: "const x = 1;",
		});
		vi.mocked(generateOgImage).mockRejectedValue(
			new Error("simulated OG crash"),
		);

		await upsertPost(join(FIXTURES, "en", "hello.mdx"));

		// DB upsert must still have been called despite OG error
		expect(mocks.insert).toHaveBeenCalledWith(posts);
		expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
	});

	it("calls findFirstCodeBlock with the MDX source string", async () => {
		vi.mocked(findFirstCodeBlock).mockReturnValue(null);
		vi.mocked(generateOgImage).mockResolvedValue(null);

		await upsertPost(join(FIXTURES, "en", "with-code.mdx"));

		expect(findFirstCodeBlock).toHaveBeenCalledOnce();
		const sourceArg = vi.mocked(findFirstCodeBlock).mock.calls[0]?.[0];
		expect(typeof sourceArg).toBe("string");
		expect(sourceArg).toContain("typescript");
	});
});
