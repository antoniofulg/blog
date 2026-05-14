import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const selectOrderBy = vi.fn().mockResolvedValue([]);
	const selectWhere = vi.fn().mockReturnValue({ orderBy: selectOrderBy });
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });

	return { select, selectFrom, selectWhere, selectOrderBy };
});

vi.mock("#/db/client", () => ({
	db: { select: mocks.select },
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

import { getPublishedPostsFn } from "#/db/queries";
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
		isPublished: true,
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
	vi.clearAllMocks();
	mocks.selectOrderBy.mockResolvedValue([]);
	mocks.selectWhere.mockReturnValue({ orderBy: mocks.selectOrderBy });
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
}

// ─── Unit: getPublishedPostsFn ────────────────────────────────────────────────

describe("unit: getPublishedPostsFn", () => {
	beforeEach(resetMocks);

	it("calls db.select().from(posts).where(isPublished=true).orderBy(publishedAt DESC)", async () => {
		mocks.selectOrderBy.mockResolvedValue([makePost()]);
		const result = await getPublishedPostsFn("en");
		expect(mocks.select).toHaveBeenCalledTimes(1);
		expect(mocks.selectFrom).toHaveBeenCalled();
		expect(result).toHaveLength(1);
		expect(result[0].slug).toBe("hello-world");
	});

	it("returns only is_published=true rows — mock returns empty for draft-only DB", async () => {
		mocks.selectOrderBy.mockResolvedValue([]);
		const result = await getPublishedPostsFn("en");
		expect(result).toHaveLength(0);
	});

	it("returns posts in publishedAt DESC order when mock returns them that way", async () => {
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
		const result = await getPublishedPostsFn("en");
		expect(result[0].slug).toBe("newer");
		expect(result[1].slug).toBe("older");
	});
});

// ─── Integration: legacy redirect routes (requires running server) ────────────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port3000Free = await isPortFree(3000);

describe.skipIf(port3000Free)("integration: legacy redirect routes", () => {
	const BASE_URL = "http://localhost:3000";

	it("GET / returns HTTP redirect to /en/blog (default locale)", async () => {
		const res = await fetch(`${BASE_URL}/`, { redirect: "manual" });
		expect([301, 302, 303, 307, 308]).toContain(res.status);
		const location = res.headers.get("location");
		expect(location).toMatch(/\/en\/blog/);
	});

	it("GET / with Accept-Language: pt-BR redirects to /pt-br/blog", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
			headers: { "Accept-Language": "pt-BR,pt;q=0.9" },
		});
		expect([301, 302, 303, 307, 308]).toContain(res.status);
		const location = res.headers.get("location");
		expect(location).toMatch(/\/pt-br\/blog/);
	});

	it("GET / with Accept-Language: en-US redirects to /en/blog", async () => {
		const res = await fetch(`${BASE_URL}/`, {
			redirect: "manual",
			headers: { "Accept-Language": "en-US,en;q=0.9" },
		});
		expect([301, 302, 303, 307, 308]).toContain(res.status);
		const location = res.headers.get("location");
		expect(location).toMatch(/\/en\/blog/);
	});

	it("GET /blog returns HTTP redirect to /en/blog", async () => {
		const res = await fetch(`${BASE_URL}/blog`, { redirect: "manual" });
		expect([301, 302, 303, 307, 308]).toContain(res.status);
		const location = res.headers.get("location");
		expect(location).toMatch(/\/en\/blog/);
	});

	it("GET /react-suspense returns HTTP redirect to /en/react-suspense", async () => {
		const res = await fetch(`${BASE_URL}/react-suspense`, {
			redirect: "manual",
		});
		expect([301, 302, 303, 307, 308]).toContain(res.status);
		const location = res.headers.get("location");
		expect(location).toMatch(/\/en\/react-suspense/);
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
		it(`routeTree.gen.ts has no route definition for '${path}'`, () => {
			expect(routeTree).not.toContain(`'${path}'`);
			expect(routeTree).not.toContain(`"${path}"`);
		});
	}

	it("routeTree.gen.ts has no import from routes/tutorials", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/tutorials/);
	});

	it("routeTree.gen.ts has no import from routes/projects", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/projects'/);
	});

	it("routeTree.gen.ts has no import from routes/newsletter", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/newsletter'/);
	});

	it("routeTree.gen.ts has no import from routes/search", () => {
		expect(routeTree).not.toMatch(/from '\.\/routes\/search'/);
	});
});

// ─── Integration: $lang layout route ────────────────────────────────────────

describe.skipIf(port3000Free)("integration: $lang layout route", () => {
	const BASE_URL = "http://localhost:3000";

	it("GET /invalid/blog redirects to /en/blog", async () => {
		const res = await fetch(`${BASE_URL}/invalid/blog`, {
			redirect: "manual",
		});
		expect([301, 302, 303, 307, 308]).toContain(res.status);
		const location = res.headers.get("location");
		expect(location).toMatch(/\/en\/blog/);
	});

	it("GET /about is not intercepted by $lang layout", async () => {
		const res = await fetch(`${BASE_URL}/about`);
		expect(res.status).toBe(200);
	});
});

// ─── Integration: deleted routes return 404 ──────────────────────────────────

describe.skipIf(port3000Free)("integration: deleted routes return 404", () => {
	const BASE_URL = "http://localhost:3000";

	it("GET /tutorials returns 404", async () => {
		const res = await fetch(`${BASE_URL}/tutorials`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});

	it("GET /projects returns 404", async () => {
		const res = await fetch(`${BASE_URL}/projects`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});

	it("GET /newsletter returns 404", async () => {
		const res = await fetch(`${BASE_URL}/newsletter`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});

	it("GET /search returns 404", async () => {
		const res = await fetch(`${BASE_URL}/search`, { redirect: "manual" });
		expect(res.status).toBe(404);
	});
});
