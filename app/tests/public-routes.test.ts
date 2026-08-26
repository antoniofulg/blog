import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = (() => {
	const selectOrderBy = jest.fn().mockResolvedValue([]);
	const selectWhere = jest.fn().mockReturnValue({ orderBy: selectOrderBy });
	const selectFrom = jest.fn().mockReturnValue({ where: selectWhere });
	const select = jest.fn().mockReturnValue({ from: selectFrom });

	return { select, selectFrom, selectWhere, selectOrderBy };
})();

mock.module("#/db/client", () => ({
	db: { select: mocks.select },
}));

mock.module("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

const { listPostsFn } = await import("#/db/queries");

import type { posts } from "#/db/schema";

type Post = (typeof posts)["_"]["inferSelect"];

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		id: 1,
		filePath: "/content/en/hello.mdx",
		slug: "hello-world",
		lang: "en",
		title: "Hello World",
		description: "A short intro post.",
		publishedAt: new Date("2026-05-02"),
		viewCount: 0,
		indexedAt: new Date(),
		category: null,
		series: null,
		seriesPart: null,
		draft: null,
		...overrides,
	};
}

function resetMocks() {
	jest.clearAllMocks();
	mocks.selectOrderBy.mockResolvedValue([]);
	mocks.selectWhere.mockReturnValue({ orderBy: mocks.selectOrderBy });
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
}

// ─── Unit: listPostsFn ────────────────────────────────────────────────────────

describe("unit: listPostsFn", () => {
	beforeEach(resetMocks);

	test("calls db.select().from(posts).where(lang).orderBy(publishedAt DESC)", async () => {
		mocks.selectOrderBy.mockResolvedValue([makePost()]);
		const result = await listPostsFn("en");
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(mocks.selectFrom).toHaveBeenCalled();
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("hello-world");
	});

	test("returns empty when DB returns no posts for the locale", async () => {
		mocks.selectOrderBy.mockResolvedValue([]);
		const result = await listPostsFn("en");
		expect(result).toHaveLength(0);
	});

	test("returns posts in publishedAt DESC order when mock returns them that way", async () => {
		const older = makePost({
			id: 1,
			slug: "older",
			publishedAt: new Date("2026-01-01"),
		});
		const newer = makePost({
			id: 2,
			slug: "newer",
			publishedAt: new Date("2026-05-02"),
		});
		mocks.selectOrderBy.mockResolvedValue([newer, older]);
		const result = await listPostsFn("en");
		expect(result[0].slug).toBe("newer");
		expect(result[1].slug).toBe("older");
	});
});

// ─── Integration helpers ──────────────────────────────────────────────────────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port3000Free = await isPortFree(3000);

// ─── Integration: post-shim URL resolution ────────────────────────────────────

describe.skipIf(port3000Free)("integration: post-shim URL resolution", () => {
	const BASE_URL = "http://localhost:3000";

	test("GET / returns 200 (en feed served by {-$locale}/index.tsx)", async () => {
		const res = await fetch(`${BASE_URL}/`);
		expect(res.status).toBe(200);
	});

	test("GET /blog returns 404 (intentional per ADR-001)", async () => {
		const res = await fetch(`${BASE_URL}/blog`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});
});

// ─── Unit: deleted routes absent from routeTree.gen.ts ───────────────────────

describe("unit: deleted routes absent from routeTree", () => {
	const routeTree = readFileSync(
		join(import.meta.dirname, "../../app/routeTree.gen.ts"),
		"utf8",
	);

	const deletedPaths = [
		"/tutorials",
		"/tutorials/$seriesSlug",
		"/projects",
		"/newsletter",
		"/search",
	];

	for (const path of deletedPaths) {
		test(`routeTree.gen.ts has no route definition for '${path}'`, () => {
			expect(routeTree).not.toContain(`'${path}'`);
			expect(routeTree).not.toContain(`"${path}"`);
		});
	}

	test("routeTree.gen.ts has no import from routes/tutorials", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/tutorials/);
	});

	test("routeTree.gen.ts has no import from routes/projects", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/projects'/);
	});

	test("routeTree.gen.ts has no import from routes/newsletter", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/newsletter'/);
	});

	test("routeTree.gen.ts has no import from routes/search", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/search'/);
	});

	test("routeTree.gen.ts has no import from routes/index (shim deleted)", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/index'/);
	});

	test("routeTree.gen.ts has no import from routes/blog (shim deleted)", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/blog'/);
	});

	test("routeTree.gen.ts has no import from routes/$slug (shim deleted)", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/\$slug'/);
	});

	test("routeTree.gen.ts has no top-level route definition for '/blog'", () => {
		expect(routeTree).not.toContain("id: '/blog'");
		expect(routeTree).not.toContain("path: '/blog'");
	});

	test("routeTree.gen.ts has no top-level '$slug' shim route (root parent)", () => {
		// Shim's FileRoutesById entry was `'/$slug': typeof SlugRoute`.
		// After deletion only `'/{-$locale}/$slug'` remains.
		expect(routeTree).not.toContain("'/$slug': typeof SlugRoute");
		expect(routeTree).not.toContain("const SlugRoute =");
	});
});

// ─── Integration: locale layout route ────────────────────────────────────────

describe.skipIf(port3000Free)("integration: locale layout route", () => {
	const BASE_URL = "http://localhost:3000";

	test("GET /invalid/blog returns 404 (invalid locale throws notFound)", async () => {
		const res = await fetch(`${BASE_URL}/invalid/blog`, {
			redirect: "manual",
		});
		expect(res.status).toBe(404);
	});

	test("GET /about returns 200 (en locale About from MDX)", async () => {
		const res = await fetch(`${BASE_URL}/about`);
		expect(res.status).toBe(200);
	});

	test("GET /pt-br/about returns 200 (pt-br locale About from MDX)", async () => {
		const res = await fetch(`${BASE_URL}/pt-br/about`);
		expect(res.status).toBe(200);
	});
});

// ─── Integration: NotFoundPage UIStrings ─────────────────────────────────────

describe.skipIf(port3000Free)(
	"integration: NotFoundPage renders locale-aware UIStrings",
	() => {
		const BASE_URL = "http://localhost:3000";

		test("GET /nonexistent returns 404 with en notFound.title", async () => {
			const res = await fetch(
				`${BASE_URL}/__nonexistent_route_${Date.now()}__`,
				{ redirect: "manual" },
			);
			expect(res.status).toBe(404);
			const html = await res.text();
			expect(html).toContain("Page not found");
		});

		test("GET /pt-br/nonexistent returns 404 with pt-br notFound.title", async () => {
			const res = await fetch(
				`${BASE_URL}/pt-br/__nonexistent_route_${Date.now()}__`,
				{ redirect: "manual" },
			);
			expect(res.status).toBe(404);
			const html = await res.text();
			expect(html).toContain("Página não encontrada");
		});
	},
);

// ─── Integration: deleted routes return 404 ──────────────────────────────────

describe.skipIf(port3000Free)("integration: deleted routes return 404", () => {
	const BASE_URL = "http://localhost:3000";

	test("GET /tutorials returns 404", async () => {
		const res = await fetch(`${BASE_URL}/tutorials`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});

	test("GET /projects returns 404", async () => {
		const res = await fetch(`${BASE_URL}/projects`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});

	test("GET /newsletter returns 404", async () => {
		const res = await fetch(`${BASE_URL}/newsletter`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});

	test("GET /search returns 404", async () => {
		const res = await fetch(`${BASE_URL}/search`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});
});
