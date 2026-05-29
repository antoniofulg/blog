import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

// Watcher subprocess handle shape — pid/kill optional so tests can simulate a
// spawn() that returns no pid (the guard then skips the pidfile write).
type WatcherProc = {
	pid?: number;
	unref: () => void;
	kill?: (signal?: unknown) => unknown;
};

const mocks = vi.hoisted(() => ({
	execFileSync: vi.fn(),
	spawn: vi.fn(
		(): WatcherProc => ({ pid: 4242, unref: vi.fn(), kill: vi.fn() }),
	),
	syncAll: vi.fn().mockResolvedValue(undefined),
	existsSync: vi.fn(() => false),
	readFileSync: vi.fn(() => ""),
	writeFileSync: vi.fn(),
	mkdirSync: vi.fn(),
	rmSync: vi.fn(),
}));

vi.mock("node:child_process", () => ({
	execFileSync: mocks.execFileSync,
	spawn: mocks.spawn,
}));

vi.mock("node:fs", () => ({
	existsSync: mocks.existsSync,
	readFileSync: mocks.readFileSync,
	writeFileSync: mocks.writeFileSync,
	mkdirSync: mocks.mkdirSync,
	rmSync: mocks.rmSync,
}));

vi.mock("#/db/indexer", () => ({
	syncAll: mocks.syncAll,
}));

import { join } from "node:path";
import { runDevBoot } from "../../app/lib/dev-boot";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAll() {
	vi.clearAllMocks();
	mocks.execFileSync.mockReturnValue(undefined);
	mocks.spawn.mockReturnValue({ pid: 4242, unref: vi.fn(), kill: vi.fn() });
	mocks.syncAll.mockResolvedValue(undefined);
	mocks.existsSync.mockReturnValue(false);
	mocks.readFileSync.mockReturnValue("");
	mocks.writeFileSync.mockReturnValue(undefined);
	mocks.mkdirSync.mockReturnValue(undefined);
	mocks.rmSync.mockReturnValue(undefined);
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

// ─── Unit: watcher lifecycle (orphan-leak guard) ──────────────────────────────

describe("unit: runDevBoot — watcher lifecycle (leak guard)", () => {
	beforeEach(resetAll);
	afterEach(vi.restoreAllMocks);

	const PID_FILE_SUFFIX = join(".tanstack", "content-watcher.pid");

	it("writes the spawned watcher PID to the content-watcher pidfile", async () => {
		mocks.spawn.mockReturnValue({ pid: 4242, unref: vi.fn(), kill: vi.fn() });
		await runDevBoot();
		const pidWrite = mocks.writeFileSync.mock.calls.find((c) =>
			String(c[0]).endsWith(PID_FILE_SUFFIX),
		);
		expect(pidWrite).toBeDefined();
		expect(pidWrite?.[1]).toBe("4242");
	});

	it("does not write a pidfile when spawn returns no pid", async () => {
		mocks.spawn.mockReturnValue({ unref: vi.fn() });
		await runDevBoot();
		expect(mocks.writeFileSync).not.toHaveBeenCalled();
	});

	it("reaps a live stale watcher (SIGTERM) before spawning a new one", async () => {
		mocks.existsSync.mockReturnValue(true);
		mocks.readFileSync.mockReturnValue("9999");
		const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

		await runDevBoot();

		// Liveness probe (signal 0) then the actual termination.
		expect(killSpy).toHaveBeenCalledWith(9999, 0);
		expect(killSpy).toHaveBeenCalledWith(9999, "SIGTERM");
		// Stale pidfile cleared after the reap.
		expect(mocks.rmSync).toHaveBeenCalled();
		killSpy.mockRestore();
	});

	it("does not SIGTERM when no pidfile exists", async () => {
		mocks.existsSync.mockReturnValue(false);
		const killSpy = vi.spyOn(process, "kill").mockImplementation(() => true);

		await runDevBoot();

		expect(killSpy).not.toHaveBeenCalledWith(9999, "SIGTERM");
		killSpy.mockRestore();
	});

	it("skips SIGTERM when the recorded PID is already dead", async () => {
		mocks.existsSync.mockReturnValue(true);
		mocks.readFileSync.mockReturnValue("9999");
		const killSpy = vi
			.spyOn(process, "kill")
			.mockImplementation((_pid, signal) => {
				if (signal === 0) throw new Error("ESRCH"); // probe: not alive
				return true;
			});

		await runDevBoot();

		expect(killSpy).toHaveBeenCalledWith(9999, 0);
		expect(killSpy).not.toHaveBeenCalledWith(9999, "SIGTERM");
		// Stale pidfile still cleared so it never re-triggers.
		expect(mocks.rmSync).toHaveBeenCalled();
		killSpy.mockRestore();
	});
});
