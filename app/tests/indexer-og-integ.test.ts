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

import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks for DB only (OG generator NOT mocked) ────────────────────

const mocks = vi.hoisted(() => {
	const onConflictDoUpdate = vi.fn().mockResolvedValue([]);
	const values = vi.fn().mockReturnValue({ onConflictDoUpdate });
	const insert = vi.fn().mockReturnValue({ values });
	return { insert, values, onConflictDoUpdate };
});

vi.mock("#/db/client", () => ({
	db: {
		insert: mocks.insert,
		delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
		select: vi.fn().mockReturnValue({
			from: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
		}),
	},
}));

// #/lib/og/generate and #/lib/mdx/code-blocks.server are intentionally
// NOT mocked so the real implementations run.

import { upsertPost } from "#/db/indexer";
import { posts } from "#/db/schema";

const FIXTURES = join(import.meta.dirname, "fixtures");
const TIMEOUT = 30_000;

const TEST_SLUG = "with-code";
const TEST_LOCALE = "en";
const OUTPUT_PNG = join(
	process.cwd(),
	"public",
	"og",
	TEST_LOCALE,
	`${TEST_SLUG}.png`,
);

afterAll(async () => {
	if (existsSync(OUTPUT_PNG)) {
		await rm(OUTPUT_PNG, { force: true });
	}
});

function resetMocks() {
	vi.clearAllMocks();
	mocks.onConflictDoUpdate.mockResolvedValue([]);
	mocks.values.mockReturnValue({
		onConflictDoUpdate: mocks.onConflictDoUpdate,
	});
	mocks.insert.mockReturnValue({ values: mocks.values });
}

describe("integration: upsertPost OG generation", () => {
	beforeEach(resetMocks);

	it(
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

			// PNG must exist at the expected public path
			expect(existsSync(OUTPUT_PNG)).toBe(true);
		},
		TIMEOUT,
	);
});
