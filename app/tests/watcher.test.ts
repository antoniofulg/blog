import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const fsMock = (() => {
	let captured: ((event: string, filename: string | null) => void) | null =
		null;
	const watchFn = jest
		.fn()
		.mockImplementation(
			(
				_dir: unknown,
				_opts: unknown,
				cb: (event: string, filename: string | null) => void,
			) => {
				captured = cb;
				return { close: jest.fn() };
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
})();

const statMock = (() => jest.fn())();

const indexerMocks = (() => ({
	upsertPost: jest.fn().mockResolvedValue(undefined),
	removePost: jest.fn().mockResolvedValue(undefined),
}))();

mock.module("node:fs", () => ({ watch: fsMock.watchFn }));
mock.module("node:fs/promises", () => ({ stat: statMock }));
mock.module("#/db/indexer", () => indexerMocks);

const { startContentWatcher } = await import("#/lib/watcher.server");

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetAll() {
	jest.clearAllMocks(); // prevent spy call history from leaking between tests
	fsMock.reset();
	statMock.mockReset();
	indexerMocks.upsertPost.mockReset().mockResolvedValue(undefined);
	indexerMocks.removePost.mockReset().mockResolvedValue(undefined);
}

// ─── Unit: non-.mdx filtering ────────────────────────────────────────────────

describe("unit: non-.mdx filtering", () => {
	beforeEach(() => {
		resetAll();
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("ignores .txt files — upsertPost and removePost not called", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "readme.txt");
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
		expect(indexerMocks.removePost).not.toHaveBeenCalled();
	});

	test("ignores .ts files", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "config.ts");
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
	});

	test("ignores null filename", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", null);
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
	});
});

// ─── Unit: debounce ───────────────────────────────────────────────────────────

describe("unit: debounce", () => {
	beforeEach(() => {
		resetAll();
		jest.useFakeTimers();
		statMock.mockResolvedValue({});
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("two rapid 'change' events within 100ms → exactly one upsertPost call", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		fsMock.trigger("change", "post.mdx");
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).toHaveBeenCalledTimes(1);
	});

	test("two events 150ms apart → two upsertPost calls", async () => {
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		jest.advanceTimersByTime(150);
		await Promise.resolve();
		fsMock.trigger("change", "post.mdx");
		jest.advanceTimersByTime(150);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).toHaveBeenCalledTimes(2);
	});
});

// ─── Unit: rename event — stat-based creation/deletion ───────────────────────

describe("unit: rename event stat dispatch", () => {
	beforeEach(() => {
		resetAll();
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("'rename' + stat resolves → calls upsertPost with correct path", async () => {
		statMock.mockResolvedValue({});
		startContentWatcher("/content");
		fsMock.trigger("rename", "new-post.mdx");
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).toHaveBeenCalledWith(
			"/content/new-post.mdx",
		);
		expect(indexerMocks.removePost).not.toHaveBeenCalled();
	});

	test("'rename' + stat rejects (ENOENT) → calls removePost with correct path", async () => {
		statMock.mockRejectedValue(
			Object.assign(new Error("ENOENT"), { code: "ENOENT" }),
		);
		startContentWatcher("/content");
		fsMock.trigger("rename", "deleted-post.mdx");
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.removePost).toHaveBeenCalledWith(
			"/content/deleted-post.mdx",
		);
		expect(indexerMocks.upsertPost).not.toHaveBeenCalled();
	});
});

// ─── Unit: upsertPost failure does not trigger removePost ────────────────────

describe("unit: upsertPost error isolation", () => {
	beforeEach(() => {
		resetAll();
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("upsertPost throws (e.g. YAML parse error) → removePost is NOT called, error logged", async () => {
		const errorSpy = jest.spyOn(console, "error");
		statMock.mockResolvedValue({});
		indexerMocks.upsertPost.mockRejectedValue(new Error("YAML parse error"));
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		jest.advanceTimersByTime(200);
		await Promise.resolve();
		expect(indexerMocks.upsertPost).toHaveBeenCalledWith("/content/post.mdx");
		expect(indexerMocks.removePost).not.toHaveBeenCalled();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("upsert_failed"),
		);
	});
});

// ─── Unit: fs.watch startup failure ──────────────────────────────────────────

describe("unit: watcher start failure", () => {
	beforeEach(resetAll);

	test("does not throw if fs.watch itself throws — logs watcher_start_failed", () => {
		fsMock.watchFn.mockImplementationOnce(() => {
			throw new Error("EMFILE: too many open files");
		});
		const errorSpy = jest.spyOn(console, "error");
		expect(() => startContentWatcher("/content")).not.toThrow();
		expect(errorSpy).toHaveBeenCalledWith(
			expect.stringContaining("watcher_start_failed"),
		);
	});
});

// ─── Unit: startup log ────────────────────────────────────────────────────────

describe("unit: startup log", () => {
	beforeEach(resetAll);

	test("logs watcher_started JSON to console.log on invocation", () => {
		const logSpy = jest.spyOn(console, "log");
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
		jest.useFakeTimers();
	});
	afterEach(() => {
		jest.clearAllTimers();
		jest.useRealTimers();
	});

	test("emits watcher_no_events warning after 5s with no events", async () => {
		const warnSpy = jest.spyOn(console, "warn");
		startContentWatcher("/content");
		jest.advanceTimersByTime(5001);
		await Promise.resolve();
		expect(warnSpy).toHaveBeenCalledWith(
			expect.stringContaining("watcher_no_events"),
		);
	});

	test("does NOT emit warning if a .mdx event fired before 5s", async () => {
		const warnSpy = jest.spyOn(console, "warn");
		statMock.mockResolvedValue({});
		startContentWatcher("/content");
		fsMock.trigger("change", "post.mdx");
		jest.advanceTimersByTime(5001);
		await Promise.resolve();
		expect(warnSpy).not.toHaveBeenCalled();
	});
});
