import {
	afterAll,
	beforeAll,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import { mkdir, mkdtemp, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, relative } from "node:path";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

// makeDbChain wraps a real Promise so it can be awaited directly AND supports
// Drizzle's .where()/.orderBy()/.limit() query builder chain in tests.
function makeDbChain(rows: unknown[] = []) {
	return Object.assign(Promise.resolve(rows), {
		where: () => makeDbChain(rows),
		orderBy: () => makeDbChain(rows),
		limit: () => makeDbChain(rows),
	});
}

const dbMocks = (() => {
	const from = jest.fn().mockImplementation(() => makeDbChain());
	const select = jest.fn().mockReturnValue({ from });
	return { select, from };
})();

mock.module("#/db/client", () => ({
	db: { select: dbMocks.select },
}));

import {
	getPostInventory,
	getRouteInventory,
	type PostEntry,
	ROUTE_METADATA,
	type RouteAuthLevel,
	type RouteEntry,
	resolveRoutePath,
} from "#/lib/site-model.server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function resetDbMocks() {
	jest.clearAllMocks();
	dbMocks.from.mockImplementation(() => makeDbChain());
	dbMocks.select.mockReturnValue({ from: dbMocks.from });
}

const ROUTES_DIR = join(import.meta.dirname, "../../app/routes");
const EXCLUDED = new Set(["__root.tsx", "routeTree.gen.ts"]);

async function walkRouteKeys(routesDir: string): Promise<string[]> {
	const keys: string[] = [];
	async function walk(dir: string): Promise<void> {
		const entries = await readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			const full = join(dir, entry.name);
			if (entry.isDirectory()) {
				await walk(full);
			} else if (entry.name.endsWith(".tsx")) {
				const rel = relative(routesDir, full);
				if (!EXCLUDED.has(basename(rel))) {
					keys.push(rel);
				}
			}
		}
	}
	await walk(routesDir);
	return keys;
}

function assertCoverage(keys: string[]): void {
	const missing = keys.filter((k) => !(k in ROUTE_METADATA));
	if (missing.length > 0) {
		throw new Error(
			`Route files missing from ROUTE_METADATA: ${missing.join(", ")}`,
		);
	}
}

// ─── Unit: ROUTE_METADATA shape ──────────────────────────────────────────────

describe("unit: ROUTE_METADATA", () => {
	test("is a non-empty object", () => {
		expect(typeof ROUTE_METADATA).toBe("object");
		expect(Object.keys(ROUTE_METADATA).length).toBeGreaterThan(0);
	});

	test("every entry has required shape", () => {
		const validAuth: RouteAuthLevel[] = ["public", "admin"];
		for (const [, meta] of Object.entries(ROUTE_METADATA)) {
			expect(typeof meta.path).toBe("string");
			expect(validAuth).toContain(meta.auth);
			expect(typeof meta.intent).toBe("string");
		}
	});
});

// ─── Unit: getRouteInventory ──────────────────────────────────────────────────

describe("unit: getRouteInventory", () => {
	// Provide a live slug so slug routes are included in the inventory count
	beforeEach(() => {
		dbMocks.from.mockImplementation(() => makeDbChain([{ slug: "test-slug" }]));
		dbMocks.select.mockReturnValue({ from: dbMocks.from });
	});

	test("returns one RouteEntry per non-null ROUTE_METADATA entry when DB has posts", async () => {
		const inventory = await getRouteInventory();
		const expectedCount = Object.values(ROUTE_METADATA).filter(
			(m) => m.expectedStatus !== null,
		).length;
		expect(inventory).toHaveLength(expectedCount);
	});

	test("filters out expectedStatus: null entries (layout/opt-out routes)", async () => {
		const inventory = await getRouteInventory();
		for (const entry of inventory) {
			expect(entry.expectedStatus).not.toBeNull();
		}
	});

	test("each RouteEntry has required shape", async () => {
		const inventory = await getRouteInventory();
		const validAuth: RouteAuthLevel[] = ["public", "admin"];
		const validStatuses = [200, 302, 401, 404];
		for (const entry of inventory) {
			expect(typeof entry.path).toBe("string");
			expect(validAuth).toContain(entry.auth);
			expect(validStatuses).toContain(entry.expectedStatus);
			expect(typeof entry.intent).toBe("string");
		}
	});

	test("inventory count equals (total route files - excluded - opt-outs) when DB has posts", async () => {
		const keys = await walkRouteKeys(ROUTES_DIR);
		const optOutCount = Object.values(ROUTE_METADATA).filter(
			(m) => m.expectedStatus === null,
		).length;
		const inventory = await getRouteInventory();
		expect(inventory).toHaveLength(keys.length - optOutCount);
	});

	test("slug routes excluded from inventory when DB has no posts", async () => {
		dbMocks.from.mockImplementation(() => makeDbChain([]));
		const inventory = await getRouteInventory();
		const slugRoutes = inventory.filter((e) => e.path.includes(":slug"));
		expect(slugRoutes).toHaveLength(0);
	});
});

// ─── Unit: resolveRoutePath ───────────────────────────────────────────────────

describe("unit: resolveRoutePath", () => {
	const base: RouteEntry = {
		path: "/",
		locale: "en",
		auth: "public",
		expectedStatus: 200,
		intent: "test",
	};

	test("returns path unchanged when no sampleSlug", () => {
		expect(resolveRoutePath({ ...base, path: "/about" })).toBe("/about");
	});

	test("returns path unchanged for parameterized route with no sampleSlug", () => {
		expect(resolveRoutePath({ ...base, path: "/:slug" })).toBe("/:slug");
	});

	test("replaces :slug with sampleSlug", () => {
		expect(
			resolveRoutePath({ ...base, path: "/:slug", sampleSlug: "my-post" }),
		).toBe("/my-post");
	});

	test("replaces all :slug occurrences", () => {
		expect(
			resolveRoutePath({
				...base,
				path: "/admin/preview/:slug",
				sampleSlug: "draft-post",
			}),
		).toBe("/admin/preview/draft-post");
	});

	test("leaves other path segments unchanged", () => {
		expect(
			resolveRoutePath({
				...base,
				path: "/about",
				sampleSlug: "irrelevant",
			}),
		).toBe("/about");
	});
});

// ─── Unit: ROUTE_METADATA sampleSlug for parameterized routes ─────────────────

describe("unit: ROUTE_METADATA parameterized routes resolve slug at runtime", () => {
	test("/:slug entry has no static sampleSlug — resolved at runtime from DB", () => {
		const entry = ROUTE_METADATA["{-$locale}/$slug.tsx"];
		expect(entry).toBeDefined();
		expect(entry.sampleSlug).toBeUndefined();
	});

	test("getRouteInventory uses live DB slug for parameterized routes", async () => {
		dbMocks.from.mockImplementation(() =>
			makeDbChain([{ slug: "my-live-post" }]),
		);
		dbMocks.select.mockReturnValue({ from: dbMocks.from });
		const inventory = await getRouteInventory();
		const slugRoute = inventory.find((e) => e.path === "/:slug");
		expect(slugRoute?.sampleSlug).toBe("my-live-post");
	});

	test("getRouteInventory excludes slug routes when DB returns no posts", async () => {
		dbMocks.from.mockImplementation(() => makeDbChain([]));
		dbMocks.select.mockReturnValue({ from: dbMocks.from });
		const inventory = await getRouteInventory();
		expect(inventory.find((e) => e.path === "/:slug")).toBeUndefined();
	});
});

// ─── Drift: ROUTE_METADATA vs app/routes/**/*.tsx ────────────────────────────

describe("drift: ROUTE_METADATA covers all app/routes/**/*.tsx", () => {
	test("no current route file is missing from ROUTE_METADATA", async () => {
		const keys = await walkRouteKeys(ROUTES_DIR);
		expect(() => assertCoverage(keys)).not.toThrow();
	});

	test("adding a fake-route.tsx triggers failure with route name in message", () => {
		const fakeKey = "fake-route.tsx";
		const realKeys = Object.keys(ROUTE_METADATA);
		expect(() => assertCoverage([...realKeys, fakeKey])).toThrowError(
			/fake-route\.tsx/,
		);
	});

	test("empty file list passes coverage check (vacuous truth)", () => {
		expect(() => assertCoverage([])).not.toThrow();
	});

	test("error message names all missing routes when multiple are absent", () => {
		const fakeKeys = ["missing-a.tsx", "missing-b.tsx"];
		let message = "";
		try {
			assertCoverage(fakeKeys);
		} catch (e) {
			message = (e as Error).message;
		}
		expect(message).toContain("missing-a.tsx");
		expect(message).toContain("missing-b.tsx");
	});
});

// ─── Unit: getPostInventory — no content dir ─────────────────────────────────

describe("unit: getPostInventory — no content dir", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "site-model-nodir-"));
		jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
	});

	afterAll(async () => {
		jest.restoreAllMocks();
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetDbMocks);

	test("returns empty array when app/content/posts does not exist", async () => {
		const result = await getPostInventory();
		expect(result).toEqual([]);
	});
});

// ─── Unit: getPostInventory — fixture posts ───────────────────────────────────

describe("unit: getPostInventory — fixture posts", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "site-model-"));
		await mkdir(join(tmpDir, "app", "content", "posts", "en"), {
			recursive: true,
		});
		await mkdir(join(tmpDir, "app", "content", "posts", "pt-br"), {
			recursive: true,
		});

		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "twin-post.mdx"),
			"---\ntitle: Twin Post EN\nslug: twin-post\n---\nContent.",
		);
		await writeFile(
			join(tmpDir, "app", "content", "posts", "pt-br", "twin-post.mdx"),
			"---\ntitle: Twin Post PT-BR\nslug: twin-post\n---\nContent.",
		);
		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "solo-post.mdx"),
			"---\ntitle: Solo Post\n---\nContent.",
		);

		jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
	});

	afterAll(async () => {
		jest.restoreAllMocks();
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetDbMocks);

	test("returns one PostEntry per .mdx file", async () => {
		const result = await getPostInventory();
		expect(result).toHaveLength(3);
	});

	test("each entry has required PostEntry shape", async () => {
		const result = await getPostInventory();
		for (const entry of result) {
			expect(typeof entry.slug).toBe("string");
			expect(["en", "pt-br"]).toContain(entry.lang);
			expect(typeof entry.filePath).toBe("string");
			expect(typeof entry.frontmatter.title).toBe("string");
			expect(typeof entry.hasTwin).toBe("boolean");
		}
	});

	test("hasTwin=true for posts where both en and pt-br variants exist", async () => {
		const result = await getPostInventory();
		const twinPosts = result.filter((e: PostEntry) => e.slug === "twin-post");
		expect(twinPosts).toHaveLength(2);
		for (const post of twinPosts) {
			expect(post.hasTwin).toBe(true);
		}
	});

	test("hasTwin=false for posts with no counterpart locale", async () => {
		const result = await getPostInventory();
		const solo = result.find((e: PostEntry) => e.slug === "solo-post");
		expect(solo).toBeDefined();
		expect(solo?.hasTwin).toBe(false);
	});

	test("lang derived from parent directory name", async () => {
		const result = await getPostInventory();
		for (const entry of result) {
			if (entry.filePath.includes("/en/")) {
				expect(entry.lang).toBe("en");
			} else if (entry.filePath.includes("/pt-br/")) {
				expect(entry.lang).toBe("pt-br");
			}
		}
	});

	test("slug derived from frontmatter slug field when present", async () => {
		const result = await getPostInventory();
		const twinEn = result.find((e: PostEntry) =>
			e.filePath.endsWith("/en/twin-post.mdx"),
		);
		expect(twinEn?.slug).toBe("twin-post");
	});

	test("slug derived from filename when frontmatter has no slug", async () => {
		const result = await getPostInventory();
		const solo = result.find((e: PostEntry) =>
			e.filePath.endsWith("solo-post.mdx"),
		);
		expect(solo?.slug).toBe("solo-post");
	});
});

// ─── Unit: getPostInventory — edge cases ─────────────────────────────────────

describe("unit: getPostInventory — edge cases", () => {
	let tmpDir: string;

	beforeAll(async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "site-model-edge-"));
		await mkdir(join(tmpDir, "app", "content", "posts", "en"), {
			recursive: true,
		});
		await mkdir(join(tmpDir, "app", "content", "posts", "fr"), {
			recursive: true,
		});

		// YAML date parsed as Date object by gray-matter (instanceof Date branch)
		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "dated.mdx"),
			"---\ntitle: Post With Date\npublishedAt: 2026-01-01\n---\nContent.",
		);
		// String publishedAt — gray-matter returns string when quoted (String() branch)
		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "string-date.mdx"),
			'---\ntitle: Post With String Date\npublishedAt: "2026-06-01"\n---\nContent.',
		);
		// Full frontmatter — covers seriesPart parseInt branch
		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "series-post.mdx"),
			"---\ntitle: Series Post\nseries: my-series\nseriesPart: 3\n---\nContent.",
		);
		// Missing title — parseMdxFrontmatter throws; getPostInventory skips file
		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "no-title.mdx"),
			"---\ndescription: No title here\n---\nContent.",
		);
		// Non-.mdx file — covers the else-if false branch in findMdxFiles walk
		await writeFile(
			join(tmpDir, "app", "content", "posts", "en", "readme.txt"),
			"not an mdx file",
		);
		// Invalid locale directory — deriveLang throws; getPostInventory skips file
		await writeFile(
			join(tmpDir, "app", "content", "posts", "fr", "french.mdx"),
			"---\ntitle: French Post\n---\nContent.",
		);

		jest.spyOn(process, "cwd").mockReturnValue(tmpDir);
	});

	afterAll(async () => {
		jest.restoreAllMocks();
		await rm(tmpDir, { recursive: true, force: true });
	});

	beforeEach(resetDbMocks);

	test("skips files with missing title frontmatter (no-title.mdx omitted from result)", async () => {
		const result = await getPostInventory();
		const hasNoTitle = result.some((e: PostEntry) =>
			e.filePath.includes("no-title.mdx"),
		);
		expect(hasNoTitle).toBe(false);
	});

	test("skips files in unsupported locale directory (fr/)", async () => {
		const result = await getPostInventory();
		const hasFrench = result.some((e: PostEntry) =>
			e.filePath.includes("/fr/"),
		);
		expect(hasFrench).toBe(false);
	});

	test("parses publishedAt as ISO date string when gray-matter returns a Date object", async () => {
		const result = await getPostInventory();
		const dated = result.find((e: PostEntry) =>
			e.filePath.includes("dated.mdx"),
		);
		expect(dated).toBeDefined();
		expect(dated?.frontmatter.publishedAt).toMatch(/^\d{4}-\d{2}-\d{2}/);
	});

	test("parses publishedAt from string value when not a Date object", async () => {
		const result = await getPostInventory();
		const stringDated = result.find((e: PostEntry) =>
			e.filePath.includes("string-date.mdx"),
		);
		expect(stringDated).toBeDefined();
		expect(stringDated?.frontmatter.publishedAt).toBe("2026-06-01");
	});

	test("parses seriesPart from integer frontmatter field", async () => {
		const result = await getPostInventory();
		const series = result.find((e: PostEntry) =>
			e.filePath.includes("series-post.mdx"),
		);
		expect(series).toBeDefined();
		expect(series?.frontmatter.seriesPart).toBe(3);
	});

	test("non-.mdx files in content dir are ignored", async () => {
		const result = await getPostInventory();
		const hasReadme = result.some((e: PostEntry) =>
			e.filePath.includes("readme.txt"),
		);
		expect(hasReadme).toBe(false);
	});
});

// ─── Integration: getPostInventory — real content dir ────────────────────────

describe("integration: getPostInventory — real content dir", () => {
	beforeEach(resetDbMocks);

	test("returns an array (empty when no MDX files present)", async () => {
		const result = await getPostInventory();
		expect(Array.isArray(result)).toBe(true);
	});
});
