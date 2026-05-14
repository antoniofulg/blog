import { existsSync, readdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	syncAll: vi.fn().mockResolvedValue(undefined),
	closeDb: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/db/indexer", () => ({ syncAll: mocks.syncAll }));
vi.mock("#/db/client", () => ({
	db: {},
	closeDb: mocks.closeDb,
}));

import { parseDir, runSync } from "../../scripts/sync";

// ─── Unit: parseDir ───────────────────────────────────────────────────────────

describe("unit: parseDir", () => {
	it("returns resolved content/ path when no --dir arg", () => {
		const dir = parseDir([]);
		expect(dir).toMatch(/content$/);
	});

	it("returns resolved --dir path when provided", () => {
		const dir = parseDir(["--dir", "./other"]);
		expect(dir).toMatch(/other$/);
	});
});

// ─── Unit: runSync ────────────────────────────────────────────────────────────

describe("unit: runSync", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.syncAll.mockResolvedValue(undefined);
	});

	it("calls syncAll with content/ path when no --dir given", async () => {
		await runSync([]);
		expect(mocks.syncAll).toHaveBeenCalledTimes(1);
		const arg = mocks.syncAll.mock.calls[0]?.[0] as string;
		expect(arg).toMatch(/content$/);
	});

	it("calls syncAll with override path when --dir ./other given", async () => {
		await runSync(["--dir", "./other"]);
		expect(mocks.syncAll).toHaveBeenCalledTimes(1);
		const arg = mocks.syncAll.mock.calls[0]?.[0] as string;
		expect(arg).toMatch(/other$/);
	});

	it("returns error result with message when syncAll throws", async () => {
		mocks.syncAll.mockRejectedValue(new Error("DB connection failed"));
		const result = await runSync([]);
		expect(result.status).toBe("error");
		expect(result.message).toContain("DB connection failed");
	});

	it("returns success result on happy path", async () => {
		const result = await runSync([]);
		expect(result.status).toBe("success");
	});

	it("includes contentDir in returned result", async () => {
		const result = await runSync(["--dir", "./other"]);
		expect(result.contentDir).toMatch(/other$/);
	});
});

// ─── Fixture isolation: lorem-ipsum not in content/ ──────────────────────────

describe("fixture isolation: lorem-ipsum.mdx", () => {
	const CONTENT_DIR = resolve(import.meta.dirname, "../../content");
	const FIXTURES_DIR = resolve(import.meta.dirname, "fixtures");

	it("lorem-ipsum.mdx does not exist in content/en/ (fixture moved to tests/fixtures/)", () => {
		expect(existsSync(join(CONTENT_DIR, "en", "lorem-ipsum.mdx"))).toBe(false);
	});

	it("lorem-ipsum.mdx exists at app/tests/fixtures/lorem-ipsum.mdx", () => {
		expect(existsSync(join(FIXTURES_DIR, "lorem-ipsum.mdx"))).toBe(true);
	});

	it("content/ contains no lorem-ipsum slug (sync would not create that row)", () => {
		function findMdx(dir: string): string[] {
			if (!existsSync(dir)) return [];
			return readdirSync(dir, { withFileTypes: true }).flatMap((e) =>
				e.isDirectory()
					? findMdx(join(dir, e.name))
					: e.name.endsWith(".mdx")
						? [join(dir, e.name)]
						: [],
			);
		}
		const files = findMdx(CONTENT_DIR);
		expect(files.every((f) => !f.includes("lorem-ipsum"))).toBe(true);
	});
});
