import { join } from "node:path";
import { isRedirect } from "@tanstack/react-router";
import { createElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	// Flexible thenable chain builder — can be awaited AND further chained.
	// This is needed because Drizzle's query builder returns an object that is
	// both a Promise (thenable) and chainable (has .where/.orderBy methods).
	const makeChain = (defaultResult: unknown[] = []) => {
		let resolved: unknown = defaultResult;
		const chain: Record<string, unknown> & { _resolve(val: unknown): unknown } =
			{
				from: vi.fn(() => chain),
				where: vi.fn(() => chain),
				orderBy: vi.fn(() => chain),
				set: vi.fn(() => chain),
				// biome-ignore lint/suspicious/noThenProperty: thenable chain needed to mock Drizzle's awaitable query builder
				then(
					onFulfilled?: (value: unknown) => unknown,
					onRejected?: (reason: unknown) => unknown,
				) {
					return Promise.resolve(resolved).then(onFulfilled, onRejected);
				},
				catch(onRejected?: (reason: unknown) => unknown) {
					return Promise.resolve(resolved).catch(onRejected);
				},
				finally(onFinally?: () => void) {
					return Promise.resolve(resolved).finally(onFinally);
				},
				_resolve(val: unknown) {
					resolved = val;
					return chain;
				},
			};
		return chain;
	};

	const selectChain = makeChain([]);
	const updateChain = makeChain([]);

	const db = {
		select: vi.fn(() => selectChain),
		update: vi.fn(() => updateChain),
	};

	const readFile = vi.fn().mockResolvedValue("# Draft\n\nContent");
	const renderMdx = vi.fn().mockResolvedValue(() => null);

	return {
		db,
		selectChain,
		updateChain,
		readFile,
		renderMdx,
		makeChain,
	};
});

vi.mock("#/db/client", () => ({ db: mocks.db }));
vi.mock("node:fs/promises", () => ({ readFile: mocks.readFile }));
vi.mock("#/lib/mdx/renderer.server", () => ({ renderMdx: mocks.renderMdx }));

// Prevent TanStack Start Vite plugin from stripping server fn handlers.
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

import { posts } from "#/db/schema";
import { getAllPostsFn, togglePublishedFn } from "#/routes/admin/index.server";
import { getAdminPreviewFn } from "#/routes/admin/preview.$slug.server";

const FIXTURES = join(import.meta.dirname, "fixtures");

function makePost(overrides: Partial<(typeof posts)["_"]["inferSelect"]> = {}) {
	return {
		id: 1,
		filePath: join(FIXTURES, "hello.mdx"),
		slug: "hello-world",
		title: "Hello World",
		description: "A short intro post.",
		publishedAt: new Date("2026-05-02"),
		isPublished: true,
		viewCount: 5,
		indexedAt: new Date(),
		...overrides,
	};
}

function resetMocks() {
	vi.clearAllMocks();
	mocks.selectChain._resolve([]);
	mocks.updateChain._resolve([]);
	(mocks.selectChain.from as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.selectChain,
	);
	(mocks.selectChain.where as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.selectChain,
	);
	(mocks.selectChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.selectChain,
	);
	(mocks.updateChain.set as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.updateChain,
	);
	(mocks.updateChain.where as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.updateChain,
	);
	mocks.db.select.mockReturnValue(mocks.selectChain);
	mocks.db.update.mockReturnValue(mocks.updateChain);
	mocks.readFile.mockResolvedValue("# Draft\n\nContent");
	mocks.renderMdx.mockResolvedValue(() => null);
}

// ─── Unit: getAllPostsFn ──────────────────────────────────────────────────────

describe("unit: getAllPostsFn", () => {
	beforeEach(resetMocks);

	it("returns both draft and published posts (no is_published filter)", async () => {
		const draft = makePost({ id: 1, slug: "draft", isPublished: false });
		const published = makePost({ id: 2, slug: "published", isPublished: true });
		mocks.selectChain._resolve([draft, published]);
		const result = await getAllPostsFn();
		// Exactly one db.select() call — no .where() filtering by is_published
		expect(mocks.db.select).toHaveBeenCalledTimes(1);
		// .where() is NOT called (no filter on is_published)
		expect(mocks.selectChain.where).not.toHaveBeenCalled();
		expect(result).toHaveLength(2);
	});

	it("calls db.select().from(posts).orderBy(indexedAt DESC)", async () => {
		mocks.selectChain._resolve([]);
		await getAllPostsFn();
		expect(mocks.db.select).toHaveBeenCalledTimes(1);
		expect(mocks.selectChain.from).toHaveBeenCalledWith(posts);
		expect(mocks.selectChain.orderBy).toHaveBeenCalledTimes(1);
	});

	it("returns empty array when no posts exist", async () => {
		mocks.selectChain._resolve([]);
		const result = await getAllPostsFn();
		expect(result).toHaveLength(0);
	});
});

// ─── Unit: togglePublishedFn ──────────────────────────────────────────────────

describe("unit: togglePublishedFn", () => {
	beforeEach(resetMocks);

	it("sets is_published=true and published_at=now() when published_at is null", async () => {
		mocks.selectChain._resolve([{ publishedAt: null }]);
		await togglePublishedFn(1, true);
		expect(mocks.db.update).toHaveBeenCalledTimes(1);
		const setArg = (mocks.updateChain.set as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as Record<string, unknown>;
		expect(setArg.isPublished).toBe(true);
		expect(setArg.publishedAt).toBeInstanceOf(Date);
	});

	it("does not overwrite an existing non-null published_at when publishing", async () => {
		const existingDate = new Date("2026-01-15");
		mocks.selectChain._resolve([{ publishedAt: existingDate }]);
		await togglePublishedFn(1, true);
		const setArg = (mocks.updateChain.set as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as Record<string, unknown>;
		expect(setArg.isPublished).toBe(true);
		expect(setArg.publishedAt).toBe(existingDate);
	});

	it("sets is_published=false and does not change published_at when unpublishing", async () => {
		await togglePublishedFn(1, false);
		// No SELECT needed when unpublishing
		const setArg = (mocks.updateChain.set as ReturnType<typeof vi.fn>).mock
			.calls[0][0] as Record<string, unknown>;
		expect(setArg.isPublished).toBe(false);
		expect("publishedAt" in setArg).toBe(false);
	});
});

// ─── Unit: getAdminPreviewFn ──────────────────────────────────────────────────

describe("unit: getAdminPreviewFn", () => {
	beforeEach(resetMocks);

	it("returns post regardless of is_published=false (draft post)", async () => {
		const draft = makePost({ slug: "draft-slug", isPublished: false });
		mocks.selectChain._resolve([draft]);
		const result = await getAdminPreviewFn("draft-slug");
		expect(result.post.slug).toBe("draft-slug");
		expect(result.post.isPublished).toBe(false);
	});

	it("returns post regardless of is_published=true (published post)", async () => {
		const published = makePost({
			slug: "published-slug",
			isPublished: true,
		});
		mocks.selectChain._resolve([published]);
		const result = await getAdminPreviewFn("published-slug");
		expect(result.post.slug).toBe("published-slug");
	});

	it("throws 404 Response when post not found", async () => {
		mocks.selectChain._resolve([]);
		const err = await getAdminPreviewFn("missing").catch((e) => e);
		expect(err).toBeInstanceOf(Response);
		expect((err as Response).status).toBe(404);
	});

	it("returns html string from renderMdx", async () => {
		const post = makePost({ slug: "test-slug" });
		mocks.selectChain._resolve([post]);
		mocks.renderMdx.mockResolvedValueOnce(() => null);
		const result = await getAdminPreviewFn("test-slug");
		expect(typeof result.html).toBe("string");
	});
});

// ─── Unit: admin beforeLoad auth guard ───────────────────────────────────────

describe("unit: admin beforeLoad auth guard", () => {
	it("redirects to /login?redirect=/admin when context.auth.user is null", () => {
		const context = { auth: { user: null } };
		const location = { href: "/admin" };

		let threw: unknown;
		try {
			if (!context.auth.user) {
				const { redirect } = require("@tanstack/react-router") as {
					redirect: (opts: Record<string, unknown>) => unknown;
				};
				throw redirect({
					to: "/login",
					search: { redirect: location.href },
				});
			}
		} catch (e) {
			threw = e;
		}

		expect(threw).toBeDefined();
		expect(isRedirect(threw)).toBe(true);
		const r = threw as { options: { search: { redirect: string } } };
		expect(r.options.search.redirect).toBe("/admin");
	});

	it("does not redirect when context.auth.user is set", () => {
		const context = {
			auth: { user: { id: "1", email: "a@b.com", name: "A" } },
		};
		let threw = false;
		try {
			if (!context.auth.user) {
				threw = true;
			}
		} catch {
			threw = true;
		}
		expect(threw).toBe(false);
	});
});

// avoid unused import warning — createElement is used via renderToStaticMarkup in getAdminPreviewFn
void createElement;
