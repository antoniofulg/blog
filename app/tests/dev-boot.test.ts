import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import * as realChildProcess from "node:child_process";
import * as realFs from "node:fs";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

// Watcher subprocess handle shape — pid/kill optional so tests can simulate a
// spawn() that returns no pid (the guard then skips the pidfile write).
type WatcherProc = {
	pid?: number;
	unref: () => void;
	kill?: (signal?: unknown) => unknown;
};

const mocks = (() => ({
	execFileSync: jest.fn(),
	spawn: jest.fn(
		(): WatcherProc => ({ pid: 4242, unref: jest.fn(), kill: jest.fn() }),
	),
	syncAll: jest.fn().mockResolvedValue(undefined),
	existsSync: jest.fn(() => false),
	readFileSync: jest.fn(() => ""),
	writeFileSync: jest.fn(),
	mkdirSync: jest.fn(),
	rmSync: jest.fn(),
}))();

mock.module("node:child_process", () => ({
	...realChildProcess,
	execFileSync: mocks.execFileSync,
	spawn: mocks.spawn,
}));

mock.module("node:fs", () => ({
	...realFs,
	existsSync: mocks.existsSync,
	readFileSync: mocks.readFileSync,
	writeFileSync: mocks.writeFileSync,
	mkdirSync: mocks.mkdirSync,
	rmSync: mocks.rmSync,
}));

mock.module("#/db/indexer", () => ({
	syncAll: mocks.syncAll,
}));

import { join } from "node:path";

const { runDevBoot } = await import("#/lib/dev-boot");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAll() {
	jest.clearAllMocks();
	mocks.execFileSync.mockReturnValue(undefined);
	mocks.spawn.mockReturnValue({ pid: 4242, unref: jest.fn(), kill: jest.fn() });
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
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("calls syncAll exactly once", async () => {
		await runDevBoot();
		expect(mocks.syncAll).toHaveBeenCalledTimes(1);
	});

	test("passes content dir to syncAll", async () => {
		await runDevBoot("./content");
		expect(mocks.syncAll).toHaveBeenCalledWith("./content");
	});

	test("custom dir propagates to syncAll", async () => {
		await runDevBoot("/tmp/custom");
		expect(mocks.syncAll).toHaveBeenCalledWith("/tmp/custom");
	});
});

// ─── Unit: call order ─────────────────────────────────────────────────────────

describe("unit: runDevBoot — call order", () => {
	beforeEach(resetAll);
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("migrate → seed → sync (strict ordering)", async () => {
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

	test("sync called before watcher subprocess spawn", async () => {
		const callOrder: string[] = [];
		mocks.syncAll.mockImplementation(async () => {
			callOrder.push("sync");
		});
		mocks.spawn.mockImplementation(() => {
			callOrder.push("spawn");
			return { unref: jest.fn() };
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
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("re-throws when syncAll rejects", async () => {
		mocks.syncAll.mockRejectedValue(new Error("DB connection failed"));
		await expect(runDevBoot()).rejects.toThrow("DB connection failed");
	});

	test("does not spawn watcher when syncAll throws", async () => {
		mocks.syncAll.mockRejectedValue(new Error("boom"));
		await expect(runDevBoot()).rejects.toThrow();
		expect(mocks.spawn).not.toHaveBeenCalled();
	});
});

// ─── Unit: log output ────────────────────────────────────────────────────────

describe("unit: runDevBoot — [sync] log messages", () => {
	beforeEach(resetAll);
	afterEach(() => {
		jest.restoreAllMocks();
	});

	test("logs [sync] sync_started before calling syncAll", async () => {
		const loggedBeforeSync: string[] = [];
		const logSpy = jest
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

	test("logs [sync] sync_completed after syncAll resolves", async () => {
		const logSpy = jest.spyOn(console, "log").mockImplementation(() => {});
		await runDevBoot();
		const msgs = logSpy.mock.calls.map((c) => c[0] as string);
		expect(
			msgs.some((m) => m.includes("[sync]") && m.includes("sync_completed")),
		).toBe(true);
		logSpy.mockRestore();
	});

	test("logs [sync] sync_failed when syncAll throws", async () => {
		const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
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
	afterEach(() => {
		jest.restoreAllMocks();
	});

	const PID_FILE_SUFFIX = join(".tanstack", "content-watcher.pid");

	test("writes the spawned watcher PID to the content-watcher pidfile", async () => {
		mocks.spawn.mockReturnValue({
			pid: 4242,
			unref: jest.fn(),
			kill: jest.fn(),
		});
		await runDevBoot();
		const pidWrite = mocks.writeFileSync.mock.calls.find((c) =>
			String(c[0]).endsWith(PID_FILE_SUFFIX),
		);
		expect(pidWrite).toBeDefined();
		expect(pidWrite?.[1]).toBe("4242");
	});

	test("does not write a pidfile when spawn returns no pid", async () => {
		mocks.spawn.mockReturnValue({ unref: jest.fn() });
		await runDevBoot();
		expect(mocks.writeFileSync).not.toHaveBeenCalled();
	});

	test("reaps a live stale watcher (SIGTERM) before spawning a new one", async () => {
		mocks.existsSync.mockReturnValue(true);
		mocks.readFileSync.mockReturnValue("9999");
		const killSpy = jest.spyOn(process, "kill").mockImplementation(() => true);

		await runDevBoot();

		// Liveness probe (signal 0) then the actual termination.
		expect(killSpy).toHaveBeenCalledWith(9999, 0);
		expect(killSpy).toHaveBeenCalledWith(9999, "SIGTERM");
		// Stale pidfile cleared after the reap.
		expect(mocks.rmSync).toHaveBeenCalled();
		killSpy.mockRestore();
	});

	test("does not SIGTERM when no pidfile exists", async () => {
		mocks.existsSync.mockReturnValue(false);
		const killSpy = jest.spyOn(process, "kill").mockImplementation(() => true);

		await runDevBoot();

		expect(killSpy).not.toHaveBeenCalledWith(9999, "SIGTERM");
		killSpy.mockRestore();
	});

	test("skips SIGTERM when the recorded PID is already dead", async () => {
		mocks.existsSync.mockReturnValue(true);
		mocks.readFileSync.mockReturnValue("9999");
		const killSpy = jest
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
