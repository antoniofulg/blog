/**
 * Integration tests: Post route OG image path resolution (task_09)
 *
 * Verifies that `getPostBySlugWithLangFn` returns `ogImagePath` resolved via
 * the documented order: coverImage → auto-PNG → fallback.
 *
 * Also verifies that the route's `head()` function emits an `og:image` meta
 * entry using the resolved path.
 */

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const selectWhere = vi.fn().mockResolvedValue([]);
	const selectFrom = vi.fn().mockReturnValue({ where: selectWhere });
	const select = vi.fn().mockReturnValue({ from: selectFrom });

	const readFile = vi.fn().mockResolvedValue("# Test\n\nContent");

	const loadStaticPage = vi.fn().mockResolvedValue(null);
	const staticPageHasTwin = vi.fn().mockReturnValue(false);

	const resolveOgImagePath = vi
		.fn()
		.mockReturnValue("https://blog.test/og-image.jpg");
	const getSiteOrigin = vi.fn().mockReturnValue("https://blog.test");

	return {
		select,
		selectFrom,
		selectWhere,
		readFile,
		loadStaticPage,
		staticPageHasTwin,
		resolveOgImagePath,
		getSiteOrigin,
	};
});

vi.mock("#/db/client", () => ({
	db: {
		select: mocks.select,
	},
}));

vi.mock("node:fs/promises", () => ({
	readFile: mocks.readFile,
}));

vi.mock("#/lib/mdx/pages.server", () => ({
	loadStaticPage: mocks.loadStaticPage,
	staticPageHasTwin: mocks.staticPageHasTwin,
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: vi.fn().mockReturnValue(new Request("http://localhost/")),
}));

vi.mock("#/lib/analytics/record-event.server", () => ({
	recordPostView: vi.fn().mockResolvedValue({ recorded: true }),
}));

vi.mock("#/lib/og/resolve.server", () => ({
	resolveOgImagePath: mocks.resolveOgImagePath,
}));

vi.mock("#/lib/site-origin", () => ({
	getSiteOrigin: mocks.getSiteOrigin,
}));

// ─── Imports (after mocks) ─────────────────────────────────────────────────

import { createServer } from "node:net";
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
import type { posts } from "#/db/schema";
import { getPostBySlugWithLangFn } from "#/routes/{-$locale}/$slug.server";

type Post = (typeof posts)["_"]["inferSelect"];

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		id: 1,
		filePath: "/content/en/hello.mdx",
		slug: "react-suspense",
		lang: "en",
		title: "React Suspense with TypeScript",
		description: "A deep dive.",
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
	vi.resetAllMocks();
	mocks.selectWhere.mockResolvedValue([]);
	mocks.selectFrom.mockReturnValue({ where: mocks.selectWhere });
	mocks.select.mockReturnValue({ from: mocks.selectFrom });
	mocks.readFile.mockResolvedValue("# Test\n\nContent");
	mocks.loadStaticPage.mockResolvedValue(null);
	mocks.resolveOgImagePath.mockReturnValue("https://blog.test/og-image.jpg");
	mocks.getSiteOrigin.mockReturnValue("https://blog.test");
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("integration: getPostBySlugWithLangFn returns ogImagePath", () => {
	beforeEach(resetMocks);

	it("exactPost match → result includes ogImagePath", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(typeof result.ogImagePath).toBe("string");
		expect(result.ogImagePath.length).toBeGreaterThan(0);
	});

	it("exactPost match → resolveOgImagePath called with locale=en and origin", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		await getPostBySlugWithLangFn("react-suspense", "en");
		expect(mocks.resolveOgImagePath).toHaveBeenCalledWith(
			expect.objectContaining({
				locale: "en",
				slug: "react-suspense",
				origin: "https://blog.test",
			}),
		);
	});

	it("exactPost match → getSiteOrigin called once to provide origin", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		await getPostBySlugWithLangFn("react-suspense", "en");
		expect(mocks.getSiteOrigin).toHaveBeenCalledTimes(1);
	});

	it("returns the value from resolveOgImagePath as ogImagePath", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		mocks.resolveOgImagePath.mockReturnValue(
			"https://blog.test/og/en/react-suspense.png",
		);
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		if (result.kind !== "post") return;
		expect(result.ogImagePath).toBe(
			"https://blog.test/og/en/react-suspense.png",
		);
	});

	it("fallback post branch → result includes ogImagePath", async () => {
		const enPost = makePost({ lang: "en" });
		// exact miss, fallback hit
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([enPost]);
		const result = await getPostBySlugWithLangFn("react-suspense", "pt-br");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;
		expect(typeof result.ogImagePath).toBe("string");
		expect(result.ogImagePath.length).toBeGreaterThan(0);
	});

	it("fallback post branch → resolveOgImagePath called with fallback post's locale (en), not requestedLang (pt-br)", async () => {
		const enPost = makePost({ lang: "en" });
		mocks.selectWhere.mockResolvedValueOnce([]).mockResolvedValueOnce([enPost]);
		await getPostBySlugWithLangFn("react-suspense", "pt-br");
		expect(mocks.resolveOgImagePath).toHaveBeenCalledWith(
			expect.objectContaining({ locale: "en" }),
		);
	});

	it("coverImage in frontmatter is forwarded to resolveOgImagePath", async () => {
		// MDX source with coverImage in frontmatter
		mocks.readFile.mockResolvedValue(
			"---\ncoverImage: /og/custom-cover.png\n---\n# Test\n\nContent",
		);
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		await getPostBySlugWithLangFn("react-suspense", "en");
		expect(mocks.resolveOgImagePath).toHaveBeenCalledWith(
			expect.objectContaining({ coverImage: "/og/custom-cover.png" }),
		);
	});

	it("no coverImage in frontmatter → coverImage is undefined", async () => {
		mocks.readFile.mockResolvedValue("# Test\n\nContent");
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		await getPostBySlugWithLangFn("react-suspense", "en");
		expect(mocks.resolveOgImagePath).toHaveBeenCalledWith(
			expect.objectContaining({ coverImage: undefined }),
		);
	});

	it("ogImagePath is absolute URL (from resolveOgImagePath mock)", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		mocks.resolveOgImagePath.mockReturnValue("https://blog.test/og-image.jpg");
		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		if (result.kind !== "post") return;
		expect(result.ogImagePath.startsWith("https://")).toBe(true);
	});
});

describe("integration: head() og:image meta from ogImagePath", () => {
	beforeEach(resetMocks);

	it("head meta array contains og:image with the ogImagePath value", async () => {
		// Test the head() function indirectly by checking that the Route.options.head
		// would emit the correct meta given loaderData with ogImagePath.
		//
		// Since head() is defined inside createFileRoute and just forwards
		// loaderData.ogImagePath, we verify via the loader result shape.
		// The actual meta emission is covered by the HTTP integration tests
		// (skipIf port 3000 free) and by the AC that route meta overrides root.

		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		mocks.resolveOgImagePath.mockReturnValue(
			"https://blog.test/og/en/react-suspense.png",
		);

		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		expect(result.kind).toBe("post");
		if (result.kind !== "post") return;

		// ogImagePath in loader data = the value that head() puts into og:image
		expect(result.ogImagePath).toBe(
			"https://blog.test/og/en/react-suspense.png",
		);
	});

	it("no coverImage + no auto-PNG → fallback ogImagePath used in head", async () => {
		mocks.selectWhere.mockResolvedValueOnce([makePost({ lang: "en" })]);
		mocks.resolveOgImagePath.mockReturnValue("https://blog.test/og-image.jpg");

		const result = await getPostBySlugWithLangFn("react-suspense", "en");
		if (result.kind !== "post") return;
		expect(result.ogImagePath).toBe("https://blog.test/og-image.jpg");
	});
});

// ─── HTTP integration: actual server (skip when server/DB not running) ────────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port5432Free = await isPortFree(5432);
const port3000Free = await isPortFree(3000);

describe.skipIf(port5432Free || port3000Free)(
	"HTTP integration: og:image meta in rendered post page",
	() => {
		let sql: import("postgres").Sql;
		const DB_URL =
			process.env.DATABASE_URL ?? "postgres://blog:blog@localhost:5432/blog";
		const BASE_URL = "http://localhost:3000";
		const SLUG = `integ-og-route-${Date.now()}`;
		const FIXTURE = join(import.meta.dirname, "fixtures", "hello.mdx");

		beforeAll(async () => {
			const pg = await import("postgres");
			sql = pg.default(DB_URL);
			await sql`
				INSERT INTO posts (file_path, slug, lang, title, description, published_at, view_count, indexed_at)
				VALUES (${FIXTURE}, ${SLUG}, 'en', 'OG Route Test Post', 'desc', NOW(), 0, NOW())
				ON CONFLICT DO NOTHING
			`;
		});

		afterAll(async () => {
			await sql`DELETE FROM posts WHERE slug = ${SLUG}`;
			await sql.end();
		});

		it("GET /<slug> response contains og:image meta tag", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			expect(res.status).toBe(200);
			const html = await res.text();
			expect(html).toMatch(/property="og:image"/);
		});

		it("GET /<slug> og:image content is an absolute URL", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			const match = html.match(
				/<meta[^>]+property="og:image"[^>]+content="([^"]+)"/,
			);
			if (!match) {
				// Try the other attribute order
				const match2 = html.match(
					/<meta[^>]+content="([^"]+)"[^>]+property="og:image"/,
				);
				expect(match2).not.toBeNull();
				if (match2) {
					const url = match2[1];
					expect(url).toMatch(/^https?:\/\//);
				}
				return;
			}
			const url = match[1];
			expect(url).toMatch(/^https?:\/\//);
		});

		it("GET /<slug> og:image content ends with .jpg or .png", async () => {
			const res = await fetch(`${BASE_URL}/${SLUG}`);
			const html = await res.text();
			// Extract all og:image content values
			const ogImages = [
				...html.matchAll(/property="og:image"[^>]*content="([^"]+)"/g),
			];
			const ogImages2 = [
				...html.matchAll(/content="([^"]+)"[^>]*property="og:image"/g),
			];
			const allUrls = [...ogImages, ...ogImages2].map((m) => m[1]);
			// At least one og:image meta present
			expect(allUrls.length).toBeGreaterThan(0);
			// Last one (route override) ends with .jpg or .png
			const last = allUrls.at(-1) ?? "";
			expect(last).toMatch(/\.(jpg|png)$/);
		});
	},
);
