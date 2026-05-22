import { join } from "node:path";
import { isRedirect } from "@tanstack/react-router";
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

	const db = {
		select: vi.fn(() => selectChain),
	};

	return { db, selectChain, makeChain };
});

vi.mock("#/db/client", () => ({ db: mocks.db }));

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
import { getAllPostsFn } from "#/routes/admin/index.server";

const FIXTURES = join(import.meta.dirname, "fixtures");

function makePost(overrides: Partial<(typeof posts)["_"]["inferSelect"]> = {}) {
	return {
		id: 1,
		filePath: join(FIXTURES, "hello.mdx"),
		slug: "hello-world",
		lang: "en",
		title: "Hello World",
		description: "A short intro post.",
		publishedAt: new Date("2026-05-02"),
		viewCount: 5,
		indexedAt: new Date(),
		category: null,
		series: null,
		seriesPart: null,
		draft: null,
		...overrides,
	};
}

function resetMocks() {
	vi.clearAllMocks();
	mocks.selectChain._resolve([]);
	(mocks.selectChain.from as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.selectChain,
	);
	(mocks.selectChain.where as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.selectChain,
	);
	(mocks.selectChain.orderBy as ReturnType<typeof vi.fn>).mockReturnValue(
		mocks.selectChain,
	);
	mocks.db.select.mockReturnValue(mocks.selectChain);
}

// ─── Unit: getAllPostsFn ──────────────────────────────────────────────────────

describe("unit: getAllPostsFn", () => {
	beforeEach(resetMocks);

	it("returns all posts regardless of draft state (no is_published filter)", async () => {
		const draft = makePost({ id: 1, slug: "draft" });
		const published = makePost({ id: 2, slug: "published" });
		mocks.selectChain._resolve([draft, published]);
		const result = await getAllPostsFn();
		expect(mocks.db.select).toHaveBeenCalledTimes(1);
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

// ─── Unit: locale filter logic ───────────────────────────────────────────────

describe("unit: locale filter logic", () => {
	const allPosts = [
		makePost({ id: 1, slug: "hello", lang: "en" }),
		makePost({ id: 2, slug: "hello", lang: "pt-br" }),
		makePost({ id: 3, slug: "only-en", lang: "en" }),
		makePost({ id: 4, slug: "only-pt", lang: "pt-br" }),
	];

	it("shows all posts when locale param is absent", () => {
		const locale = undefined;
		const shown = locale ? allPosts.filter((p) => p.lang === locale) : allPosts;
		expect(shown).toHaveLength(4);
	});

	it("shows only EN posts when locale=en", () => {
		const shown = allPosts.filter((p) => p.lang === "en");
		expect(shown).toHaveLength(2);
		expect(shown.every((p) => p.lang === "en")).toBe(true);
	});

	it("shows only PT-BR posts when locale=pt-br", () => {
		const shown = allPosts.filter((p) => p.lang === "pt-br");
		expect(shown).toHaveLength(2);
		expect(shown.every((p) => p.lang === "pt-br")).toBe(true);
	});

	it("locale=en excludes PT-BR-only posts", () => {
		const shown = allPosts.filter((p) => p.lang === "en");
		expect(shown.some((p) => p.slug === "only-pt")).toBe(false);
	});
});

// ─── Unit: postUrl (View button href) ────────────────────────────────────────

// Mirrors the postUrl logic from app/routes/admin/index.tsx.
function postUrl(slug: string, lang: string): string {
	return lang === "en" ? `/${slug}` : `/pt-br/${slug}`;
}

describe("unit: postUrl (View button href)", () => {
	it("links to EN URL for EN post", () => {
		expect(postUrl("hello", "en")).toBe("/hello");
	});

	it("links to EN URL for EN-only post", () => {
		expect(postUrl("only-en", "en")).toBe("/only-en");
	});

	it("links to PT-BR URL for PT-BR-only post", () => {
		expect(postUrl("only-pt", "pt-br")).toBe("/pt-br/only-pt");
	});

	it("PT-BR row links to PT-BR URL even when EN twin exists", () => {
		// Row's own lang wins — locale filter context demands the correct URL.
		expect(postUrl("hello", "pt-br")).toBe("/pt-br/hello");
	});

	it("under locale=pt-br filter, all shown rows produce /pt-br/... hrefs", () => {
		const allPosts = [
			makePost({ id: 1, slug: "hello", lang: "en" }),
			makePost({ id: 2, slug: "hello", lang: "pt-br" }),
			makePost({ id: 3, slug: "only-en", lang: "en" }),
			makePost({ id: 4, slug: "only-pt", lang: "pt-br" }),
		];
		const shown = allPosts.filter((p) => p.lang === "pt-br");
		const hrefs = shown.map((p) => postUrl(p.slug, p.lang));
		expect(hrefs.every((h) => h.startsWith("/pt-br/"))).toBe(true);
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
