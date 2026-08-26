/**
 * Integration tests: upsertPost OG generation
 *
 * Uses a MOCKED DB (no real Postgres required) but the REAL generateOgImage
 * (real satori + resvg render). Verifies that upsertPost:
 *   1. Writes the PNG to public/og/{locale}/{slug}.png.
 *   2. Completes the DB upsert.
 *
 * Allow up to 30 s per test — real satori renders are slow.
 */

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
import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

// ─── Hoisted mocks for DB only (OG generator NOT mocked) ────────────────────

const mocks = (() => {
	const onConflictDoUpdate = jest.fn().mockResolvedValue([]);
	const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
	const insert = jest.fn().mockReturnValue({ values });
	return { insert, values, onConflictDoUpdate };
})();

mock.module("#/db/client", () => ({
	db: {
		insert: mocks.insert,
		delete: jest
			.fn()
			.mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
		select: jest.fn().mockReturnValue({
			from: jest
				.fn()
				.mockReturnValue({ where: jest.fn().mockResolvedValue([]) }),
		}),
	},
}));

// #/lib/og/generate and #/lib/mdx/code-blocks.server are intentionally
// NOT mocked so the real implementations run.

const { upsertPost } = await import("#/db/indexer");
const { posts } = await import("#/db/schema");

const FIXTURES = join(process.cwd(), "app/tests/fixtures");
const TIMEOUT = 30_000;

const TEST_SLUG = "with-code";
const TEST_LOCALE = "en";

// Redirect OG output to a throwaway dir (OG_OUTPUT_DIR) so this real satori →
// resvg render never writes into the committed public/og tree — and a future
// post slugged `with-code` can never collide with this test's cleanup.
let ogTmpDir: string;
let outputPng: string;
let prevOgDir: string | undefined;

beforeAll(async () => {
	ogTmpDir = await mkdtemp(join(tmpdir(), "indexer-og-integ-"));
	prevOgDir = process.env.OG_OUTPUT_DIR;
	process.env.OG_OUTPUT_DIR = ogTmpDir;
	outputPng = join(ogTmpDir, TEST_LOCALE, `${TEST_SLUG}.png`);
});

afterAll(async () => {
	if (prevOgDir === undefined) delete process.env.OG_OUTPUT_DIR;
	else process.env.OG_OUTPUT_DIR = prevOgDir;
	await rm(ogTmpDir, { recursive: true, force: true });
});

function resetMocks() {
	jest.clearAllMocks();
	mocks.onConflictDoUpdate.mockResolvedValue([]);
	mocks.values.mockReturnValue({
		onConflictDoUpdate: mocks.onConflictDoUpdate,
	});
	mocks.insert.mockReturnValue({ values: mocks.values });
}

describe("integration: upsertPost OG generation", () => {
	beforeEach(resetMocks);

	test(
		"writes a PNG to public/og/en/<slug>.png AND upserts the DB row",
		async () => {
			const fixturePath = join(FIXTURES, "en", "with-code.mdx");

			await upsertPost(fixturePath);

			// DB upsert must have been called (no regression)
			expect(mocks.insert).toHaveBeenCalledWith(posts);
			expect(mocks.onConflictDoUpdate).toHaveBeenCalledTimes(1);
			const valuesArg = mocks.values.mock.calls[0]?.[0] as Record<
				string,
				unknown
			>;
			expect(valuesArg.slug).toBe(TEST_SLUG);
			expect(valuesArg.lang).toBe(TEST_LOCALE);

			// PNG must exist at the expected (redirected) output path
			expect(existsSync(outputPng)).toBe(true);
		},
		TIMEOUT,
	);
});
