import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(() => ({ unref: vi.fn() })),
	syncAll: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:child_process", () => ({
	execFileSync: mocks.execFileSync,
	spawn: mocks.spawn,
}));

vi.mock("#/db/indexer", () => ({
	syncAll: mocks.syncAll,
}));

import { runDevBoot } from "../../app/lib/dev-boot";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAll() {
	vi.clearAllMocks();
	mocks.execFileSync.mockReturnValue(undefined);
	mocks.spawn.mockReturnValue({ unref: vi.fn() });
	mocks.syncAll.mockResolvedValue(undefined);
}

// ─── Unit: invocation count ───────────────────────────────────────────────────

describe("unit: runDevBoot — syncAll invocation count", () => {
	beforeEach(resetAll);
	afterEach(vi.restoreAllMocks);

	it("calls syncAll exactly once", async () => {
		await runDevBoot();
		expect(mocks.syncAll).toHaveBeenCalledTimes(1);
	});

	it("passes content dir to syncAll", async () => {
		await runDevBoot("./content");
		expect(mocks.syncAll).toHaveBeenCalledWith("./content");
	});

	it("custom dir propagates to syncAll", async () => {
		await runDevBoot("/tmp/custom");
		expect(mocks.syncAll).toHaveBeenCalledWith("/tmp/custom");
	});
});

// ─── Unit: call order ─────────────────────────────────────────────────────────

describe("unit: runDevBoot — call order", () => {
	beforeEach(resetAll);
	afterEach(vi.restoreAllMocks);

	it("migrate → seed → sync (strict ordering)", async () => {
		const callOrder: string[] = [];
		mocks.execFileSync.mockImplementation((_cmd: string, args: string[]) => {
			if ((args as string[])[1] === "db:migrate") callOrder.push("migrate");
			if ((args as string[])[1] === "db:seed") callOrder.push("seed");
		});
		mocks.syncAll.mockImplementation(async () => {
			callOrder.push("sync");
		});

		await runDevBoot();

		expect(callOrder.indexOf("migrate")).toBeLessThan(
			callOrder.indexOf("seed"),
		);
		expect(callOrder.indexOf("seed")).toBeLessThan(callOrder.indexOf("sync"));
	});

	it("sync called before watcher subprocess spawn", async () => {
		const callOrder: string[] = [];
		mocks.syncAll.mockImplementation(async () => {
			callOrder.push("sync");
		});
		mocks.spawn.mockImplementation(() => {
			callOrder.push("spawn");
			return { unref: vi.fn() };
		});

		await runDevBoot();

		expect(callOrder.indexOf("sync")).toBeGreaterThan(-1);
		expect(callOrder.indexOf("spawn")).toBeGreaterThan(-1);
		expect(callOrder.indexOf("sync")).toBeLessThan(callOrder.indexOf("spawn"));
	});
});

// ─── Unit: error propagation ──────────────────────────────────────────────────

describe("unit: runDevBoot — error propagation", () => {
	beforeEach(resetAll);
	afterEach(vi.restoreAllMocks);

	it("re-throws when syncAll rejects", async () => {
		mocks.syncAll.mockRejectedValue(new Error("DB connection failed"));
		await expect(runDevBoot()).rejects.toThrow("DB connection failed");
	});

	it("does not spawn watcher when syncAll throws", async () => {
		mocks.syncAll.mockRejectedValue(new Error("boom"));
		await expect(runDevBoot()).rejects.toThrow();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});
});

// ─── Unit: log output ────────────────────────────────────────────────────────

describe("unit: runDevBoot — [sync] log messages", () => {
	beforeEach(resetAll);
	afterEach(vi.restoreAllMocks);

	it("logs [sync] sync_started before calling syncAll", async () => {
		const loggedBeforeSync: string[] = [];
		const logSpy = vi
			.spyOn(console, "log")
			.mockImplementation((msg: string) => {
				loggedBeforeSync.push(msg);
			});
		let syncCalled = false;
		mocks.syncAll.mockImplementation(async () => {
			syncCalled = true;
		});

		await runDevBoot();

		const startedIdx = loggedBeforeSync.findIndex(
			(m) => m.includes("[sync]") && m.includes("sync_started"),
		);
		expect(startedIdx).toBeGreaterThan(-1);
		expect(syncCalled).toBe(true);
		logSpy.mockRestore();
	});

	it("logs [sync] sync_completed after syncAll resolves", async () => {
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
		await runDevBoot();
		const msgs = logSpy.mock.calls.map((c) => c[0] as string);
		expect(
			msgs.some((m) => m.includes("[sync]") && m.includes("sync_completed")),
		).toBe(true);
		logSpy.mockRestore();
	});

	it("logs [sync] sync_failed when syncAll throws", async () => {
		const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
		mocks.syncAll.mockRejectedValue(new Error("oops"));
		await expect(runDevBoot()).rejects.toThrow();
		const msgs = errorSpy.mock.calls.map((c) => c[0] as string);
		expect(
			msgs.some((m) => m.includes("[sync]") && m.includes("sync_failed")),
		).toBe(true);
		errorSpy.mockRestore();
	});
});
