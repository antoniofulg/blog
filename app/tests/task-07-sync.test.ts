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
