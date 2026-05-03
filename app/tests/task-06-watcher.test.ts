import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const fsMock = vi.hoisted(() => {
	let captured: ((event: string, filename: string | null) => void) | null =
		null;
	const watchFn = vi
		.fn()
		.mockImplementation(
			(
				_dir: unknown,
				_opts: unknown,
				cb: (event: string, filename: string | null) => void,
			) => {
				captured = cb;
				return { close: vi.fn() };
			},
		);
	return {
		watchFn,
		trigger(event: string, filename: string | null) {
			captured?.(event, filename);
		},
		reset() {
			captured = null;
			watchFn.mockClear();
		},
	};
});

const statMock = vi.hoisted(() => vi.fn());

const indexerMocks = vi.hoisted(() => ({
	upsertPost: vi.fn().mockResolvedValue(undefined),
	removePost: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("node:fs", () => ({ watch: fsMock.watchFn }));
vi.mock("node:fs/promises", () => ({ stat: statMock }));
vi.mock("#/db/indexer", () => indexerMocks);

import { startContentWatcher } from "#/lib/watcher.server";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAll() {
	vi.clearAllMocks(); // prevent spy call history from leaking between tests
	fsMock.reset();
	statMock.mockReset();
	indexerMocks.upsertPost.mockReset().mockResolvedValue(undefined);
	indexerMocks.removePost.mockReset().mockResolvedValue(undefined);
}

// ─── Unit: non-.mdx filtering ────────────────────────────────────────────────

describe("unit: non-.mdx filtering", () => {
	beforeEach(() => {
		resetAll();
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("ignores .txt files — upsertPost and removePost not called", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "readme.txt");
		await vi.advanceTimersByTimeAsync(200);
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
		expect(indexerMocks.removePost).not.toHaveBeenCalled();
	});

	it("ignores .ts files", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "config.ts");
		await vi.advanceTimersByTimeAsync(200);
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
	});

	it("ignores null filename", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", null);
		await vi.advanceTimersByTimeAsync(200);
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
	});
});

// ─── Unit: debounce ───────────────────────────────────────────────────────────

describe("unit: debounce", () => {
	beforeEach(() => {
		resetAll();
		vi.useFakeTimers();
		statMock.mockResolvedValue({});
	});
	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("two rapid 'change' events within 100ms → exactly one upsertPost call", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		fsMock.trigger("change", "post.mdx");
		await vi.advanceTimersByTimeAsync(200);
		expect(indexerMocks.upsertPost).toHaveBeenCalledTimes(1);
	});

	it("two events 150ms apart → two upsertPost calls", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		await vi.advanceTimersByTimeAsync(150);
		fsMock.trigger("change", "post.mdx");
		await vi.advanceTimersByTimeAsync(150);
		expect(indexerMocks.upsertPost).toHaveBeenCalledTimes(2);
	});
});

// ─── Unit: rename event — stat-based creation/deletion ───────────────────────

describe("unit: rename event stat dispatch", () => {
	beforeEach(() => {
		resetAll();
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("'rename' + stat resolves → calls upsertPost with correct path", async () => {
		statMock.mockResolvedValue({});
		startContentWatcher("/content");
		fsMock.trigger("rename", "new-post.mdx");
		await vi.advanceTimersByTimeAsync(200);
		expect(indexerMocks.upsertPost).toHaveBeenCalledWith(
			"/content/new-post.mdx",
		);
		expect(indexerMocks.removePost).not.toHaveBeenCalled();
	});

	it("'rename' + stat rejects (ENOENT) → calls removePost with correct path", async () => {
		statMock.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);
		startContentWatcher("/content");
		fsMock.trigger("rename", "deleted-post.mdx");
		await vi.advanceTimersByTimeAsync(200);
		expect(indexerMocks.removePost).toHaveBeenCalledWith(
			"/content/deleted-post.mdx",
		);
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
	});
});

// ─── Unit: fs.watch startup failure ──────────────────────────────────────────

describe("unit: watcher start failure", () => {
	beforeEach(resetAll);

	it("does not throw if fs.watch itself throws — logs watcher_start_failed", () => {
		fsMock.watchFn.mockImplementationOnce(() => {
			throw new Error("EMFILE: too many open files");
		});
		const errorSpy = vi.spyOn(console, "error");
		expect(() => startContentWatcher("/content")).not.toThrow();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("watcher_start_failed"),
		);
	});
});

// ─── Unit: startup log ────────────────────────────────────────────────────────

describe("unit: startup log", () => {
	beforeEach(resetAll);

	it("logs watcher_started JSON to console.log on invocation", () => {
		const logSpy = vi.spyOn(console, "log");
		startContentWatcher("/content");
		const calls = logSpy.mock.calls.map((c) => c[0] as string);
		const found = calls.some(
			(msg) => msg.includes("watcher_started") && msg.includes("/content"),
		);
		expect(found).toBe(true);
	});
});

// ─── Unit: 5-second startup warning ──────────────────────────────────────────

describe("unit: startup warning", () => {
	beforeEach(() => {
		resetAll();
		vi.useFakeTimers();
	});
	afterEach(() => {
		vi.clearAllTimers();
		vi.useRealTimers();
	});

	it("emits watcher_no_events warning after 5s with no events", async () => {
		const warnSpy = vi.spyOn(console, "warn");
		startContentWatcher("/content");
		await vi.advanceTimersByTimeAsync(5001);
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("watcher_no_events"),
		);
	});

	it("does NOT emit warning if a .mdx event fired before 5s", async () => {
		const warnSpy = vi.spyOn(console, "warn");
		statMock.mockResolvedValue({});
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		await vi.advanceTimersByTimeAsync(5001);
		expect(warnSpy).not.toHaveBeenCalled();
	});
});
