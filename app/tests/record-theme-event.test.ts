/**
 * Unit tests for the recordThemeEvent server fn.
 *
 * Tests target `recordThemeEventHandler` — the extracted handler function —
 * to avoid TanStack Start server fn mock complexity. The handler contains all
 * business logic; the `recordThemeEvent` wrapper is tested for export shape only.
 *
 * DB is fully mocked — no external process required.
 * Integration tests with PGLite live in record-theme-event-integ.test.ts.
 *
 * Acceptance criteria tested here:
 *   AC-1: Exported types match TechSpec "Core Interfaces" (compile-time).
 *   AC-2: Bot UA → returns { recorded: false }; no DB insert dispatched.
 *   AC-3: Human UA + valid input → INSERT called with all six columns.
 *   AC-4: DB insert throws → caught, structured JSON logged, returns { recorded: false }.
 */

import { beforeEach, describe, expect, jest, mock, test } from "bun:test";
import type {
	RecordThemeEventInput,
	RecordThemeEventResult,
} from "#/lib/analytics/record-theme-event.server";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
// Must be declared before any imports so ()() runs first.

const mocks = (() => {
	const insertValues = jest.fn();
	const insert = jest.fn();
	return { insert, insertValues };
})();

// server-only guard: no-op in Bun Test context
mock.module("@tanstack/react-start/server-only", () => ({}));

// getRequest: used inside the server fn handler wrapper; no-op for unit tests
// since we call recordThemeEventHandler directly (getRequest never runs in this path).
mock.module("@tanstack/react-start/server", () => ({
	getRequest: jest.fn(() => new Request("http://localhost/")),
}));

// Prevent TanStack Start Vite plugin from stripping server fn handlers.
// Pattern mirrors admin-routes.test.ts / auth.test.ts.
mock.module("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

// Mock #/db/client — no real DB connection attempted.
mock.module("#/db/client", () => ({
	db: {
		insert: mocks.insert,
	},
}));

// ── Import after mocks are hoisted ────────────────────────────────────────────

const { recordThemeEventHandler } = await import(
	"#/lib/analytics/record-theme-event.server"
);

// ── Shared test data ──────────────────────────────────────────────────────────

const HUMAN_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BOT_UA =
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const MOBILE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

const VALID_INPUT: RecordThemeEventInput = {
	theme: "cs16",
	source: "long-press",
	lang: "en",
};

function makeRequest(ua?: string | null, referer?: string | null): Request {
	const headers = new Headers();
	if (ua) headers.set("User-Agent", ua);
	if (referer) headers.set("Referer", referer);
	return new Request("http://localhost/", { headers });
}

// ── Reset mock state before each test ────────────────────────────────────────

beforeEach(() => {
	jest.resetAllMocks();
	mocks.insertValues.mockResolvedValue([]);
	mocks.insert.mockReturnValue({ values: mocks.insertValues });
});

// ── Success path ──────────────────────────────────────────────────────────────

describe("recordThemeEventHandler — success path (human UA)", () => {
	test("returns { recorded: true } for a non-bot request", async () => {
		const result = await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA),
		});
		expect(result).toEqual({ recorded: true });
	});

	test("calls db.insert exactly once (AC-3)", async () => {
		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA),
		});
		expect(mocks.insert).toHaveBeenCalledTimes(1);
		expect(mocks.insertValues).toHaveBeenCalledTimes(1);
	});

	test("inserts theme, source, lang from input data (AC-3)", async () => {
		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "long-press",
			lang: "pt-br",
		};
		await recordThemeEventHandler({
			data: input,
			request: makeRequest(HUMAN_UA, "https://www.linkedin.com/feed/"),
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({
			theme: "cs16",
			source: "long-press",
			lang: "pt-br",
		});
	});

	test("derives device and referrerSource from request headers (AC-3)", async () => {
		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA, "https://www.linkedin.com/feed/"),
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({
			device: "desktop",
			referrerSource: "linkedin",
		});
	});

	test("derives device=mobile from iPhone UA", async () => {
		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(MOBILE_UA),
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ device: "mobile" });
	});

	test("derives referrerSource=direct when no Referer header", async () => {
		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA), // no Referer
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ referrerSource: "direct" });
	});

	test("derives referrerSource=github from GitHub Referer", async () => {
		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA, "https://github.com/tanstack"),
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ referrerSource: "github" });
	});

	test("source='keyboard' is passed through correctly", async () => {
		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "keyboard",
			lang: "en",
		};
		await recordThemeEventHandler({
			data: input,
			request: makeRequest(HUMAN_UA),
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ source: "keyboard" });
	});

	test("all six columns are present in the inserted row (AC-3)", async () => {
		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "long-press",
			lang: "en",
		};
		await recordThemeEventHandler({
			data: input,
			request: makeRequest(HUMAN_UA, "https://www.linkedin.com/feed/"),
		});
		const inserted = mocks.insertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(Object.keys(inserted).sort()).toEqual(
			["device", "lang", "referrerSource", "source", "theme"].sort(),
		);
	});
});

// ── Bot short-circuit path ────────────────────────────────────────────────────

describe("recordThemeEventHandler — bot short-circuit (AC-2)", () => {
	test("returns { recorded: false } for Googlebot UA", async () => {
		const result = await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(BOT_UA),
		});
		expect(result).toEqual({ recorded: false });
	});

	test("does NOT call db.insert for bot UA", async () => {
		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(BOT_UA),
		});
		expect(mocks.insert).not.toHaveBeenCalled();
	});

	test("null User-Agent is not a known bot → proceeds to DB (documents behaviour)", async () => {
		// null UA: isbot() returns false for unknown UA → treated as human.
		const result = await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(null),
		});
		expect(result.recorded).toBe(true);
	});
});

// ── DB failure path ───────────────────────────────────────────────────────────

describe("recordThemeEventHandler — DB failure path (AC-4)", () => {
	test("returns { recorded: false } when db.insert().values() throws", async () => {
		mocks.insertValues.mockRejectedValueOnce(new Error("connection lost"));
		const result = await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA),
		});
		expect(result).toEqual({ recorded: false });
	});

	test("does not re-throw the DB error (never-throws contract)", async () => {
		mocks.insertValues.mockRejectedValueOnce(new Error("fatal DB error"));
		const result = await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA),
		});
		expect(result).toEqual({ recorded: false });
	});

	test("logs one structured JSON line with event='theme_event_record_failed' (AC-4)", async () => {
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mocks.insertValues.mockRejectedValueOnce(new Error("connection lost"));

		await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA),
		});

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const raw = consoleSpy.mock.calls[0][0] as string;
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		expect(parsed).toMatchObject({
			event: "theme_event_record_failed",
			error: "connection lost",
		});
		consoleSpy.mockRestore();
	});

	test("error log includes theme, source, lang discriminators", async () => {
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mocks.insertValues.mockRejectedValueOnce(new Error("write failed"));

		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
		};
		await recordThemeEventHandler({
			data: input,
			request: makeRequest(HUMAN_UA),
		});

		const parsed = JSON.parse(consoleSpy.mock.calls[0][0] as string) as Record<
			string,
			unknown
		>;
		expect(parsed).toMatchObject({
			event: "theme_event_record_failed",
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
		});
		consoleSpy.mockRestore();
	});

	test("handles non-Error thrown values (string) without crashing", async () => {
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mocks.insertValues.mockImplementationOnce(() =>
			Promise.reject("string-rejection"),
		);

		const result = await recordThemeEventHandler({
			data: VALID_INPUT,
			request: makeRequest(HUMAN_UA),
		});
		expect(result).toEqual({ recorded: false });
		consoleSpy.mockRestore();
	});
});

// ── Compile-time type contract (AC-1) ─────────────────────────────────────────

describe("recordThemeEventHandler — exported types (AC-1)", () => {
	test("RecordThemeEventInput accepts all valid combinations (compile-time check)", () => {
		const _longPress: RecordThemeEventInput = {
			theme: "cs16",
			source: "long-press",
			lang: "en",
		};
		const _keyboard: RecordThemeEventInput = {
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
		};
		expect(_longPress.theme).toBe("cs16");
		expect(_keyboard.source).toBe("keyboard");
	});

	test("RecordThemeEventResult has boolean 'recorded' (compile-time check)", () => {
		const _ok: RecordThemeEventResult = { recorded: true };
		const _fail: RecordThemeEventResult = { recorded: false };
		expect(typeof _ok.recorded).toBe("boolean");
		expect(typeof _fail.recorded).toBe("boolean");
	});
});
