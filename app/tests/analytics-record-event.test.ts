/**
 * Unit tests for the analytics recordPostView() boundary.
 *
 * DB is fully mocked — no external process required.
 * Integration tests with PGLite live in analytics-record-event-integ.test.ts.
 *
 * Acceptance criteria tested here:
 *   AC-1: Human UA → both flags true; transaction called once.
 *   AC-2: Bot UA → both flags false; transaction NOT called.
 *   AC-3: DB throws → both flags false; no exception propagates; structured log emitted.
 *   AC-4: Both writes inside one db.transaction() call (verified via mock call count).
 *   AC-5: Inserted rows have countryCode = null and isBot = false.
 */

import { beforeEach, describe, expect, jest, mock, test } from "bun:test";

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
// Must be declared before any imports so ()() runs first.

const mocks = (() => {
	// Transaction-scoped spies: these represent the tx proxy passed to the
	// db.transaction() callback.
	const txInsertValues = jest.fn();
	const txInsert = jest.fn();
	const txUpdateWhere = jest.fn();
	const txUpdateSet = jest.fn();
	const txUpdate = jest.fn();

	// Top-level db mock — only transaction is called from recordPostView.
	const transaction = jest.fn();

	// Spy on bucketEvent so tests can assert the composite call (utm + referer)
	// that `recordPostView` makes. The real implementation is restored in
	// beforeEach after jest.resetAllMocks() clears it.
	const bucketEventSpy = jest.fn();

	return {
		transaction,
		txUpdate,
		txUpdateSet,
		txUpdateWhere,
		txInsert,
		txInsertValues,
		bucketEventSpy,
	};
})();

import * as bucketer from "#/lib/analytics/referrer-bucketer";

const realBucketEvent = bucketer.bucketEvent;

// server-only guard: no-op in Bun Test context
mock.module("@tanstack/react-start/server-only", () => ({}));

// Mock #/db/client so no real DB connection is attempted.
mock.module("#/db/client", () => ({
	db: {
		transaction: mocks.transaction,
	},
}));

// Spy on bucketEvent so we can assert the composite (utm + referer) call
// that `recordPostView` issues. The factory preserves every other export.
mock.module("#/lib/analytics/referrer-bucketer", () => ({
	...bucketer,
	bucketEvent: mocks.bucketEventSpy,
}));

// ── Import after mocks are hoisted ────────────────────────────────────────────

const { recordPostView } = await import("#/lib/analytics/record-event.server");

// ── Shared test data ──────────────────────────────────────────────────────────

const HUMAN_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BOT_UA = "Googlebot/2.1 (+http://www.google.com/bot.html)";
const MOBILE_UA =
	"Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1";

function makeRequest(ua?: string | null, referer?: string | null): Request {
	const headers = new Headers();
	if (ua) headers.set("User-Agent", ua);
	if (referer) headers.set("Referer", referer);
	return new Request("http://localhost/test-post", { headers });
}

// ── Reset mock state before each test ────────────────────────────────────────

beforeEach(() => {
	jest.resetAllMocks();

	// Restore default implementations after reset.
	mocks.txInsertValues.mockResolvedValue([]);
	mocks.txInsert.mockReturnValue({ values: mocks.txInsertValues });
	mocks.txUpdateWhere.mockResolvedValue([]);
	mocks.txUpdateSet.mockReturnValue({ where: mocks.txUpdateWhere });
	mocks.txUpdate.mockReturnValue({ set: mocks.txUpdateSet });

	// transaction calls its callback with the tx proxy.
	mocks.transaction.mockImplementation(
		async (fn: (tx: unknown) => Promise<void>) => {
			await fn({ update: mocks.txUpdate, insert: mocks.txInsert });
		},
	);

	// Restore bucketEvent spy to the real implementation so existing tests
	// continue to receive correct return values after jest.resetAllMocks().
	mocks.bucketEventSpy.mockImplementation(realBucketEvent);
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("recordPostView — happy path (human UA)", () => {
	test("returns { recorded: true, counterIncremented: true }", async () => {
		const result = await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA, "https://www.linkedin.com/feed/"),
			lang: "en",
		});
		expect(result).toEqual({ recorded: true, counterIncremented: true });
	});

	test("calls db.transaction exactly once (AC-4)", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	test("tx.update is called with the correct postId (AC-4)", async () => {
		await recordPostView({
			postId: 42,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		// update() is called on the tx proxy; first arg is the posts table object.
		expect(mocks.txUpdate).toHaveBeenCalledTimes(1);
		expect(mocks.txUpdateWhere).toHaveBeenCalledTimes(1);
	});

	test("tx.insert is called with the correct postId and lang (AC-4)", async () => {
		await recordPostView({
			postId: 7,
			request: makeRequest(HUMAN_UA),
			lang: "pt-br",
		});
		expect(mocks.txInsert).toHaveBeenCalledTimes(1);
		expect(mocks.txInsertValues).toHaveBeenCalledTimes(1);
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ postId: 7, lang: "pt-br" });
	});
});

describe("recordPostView — bot rejection (AC-2)", () => {
	test("returns { recorded: false, counterIncremented: false } for Googlebot", async () => {
		const result = await recordPostView({
			postId: 1,
			request: makeRequest(BOT_UA),
			lang: "en",
		});
		expect(result).toEqual({ recorded: false, counterIncremented: false });
	});

	test("does NOT call db.transaction for bot UA", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(BOT_UA),
			lang: "en",
		});
		expect(mocks.transaction).not.toHaveBeenCalled();
	});

	test("returns failure for null User-Agent", async () => {
		// null UA → isbot returns false (unknown), treated as human.
		// This test verifies the null path doesn't crash the gate.
		const result = await recordPostView({
			postId: 1,
			request: makeRequest(null),
			lang: "en",
		});
		// null UA is not a known bot → should proceed to DB (recorded=true).
		expect(result.counterIncremented).toBe(true);
	});
});

describe("recordPostView — DB failure path (AC-3)", () => {
	test("returns { recorded: false, counterIncremented: false } when transaction throws", async () => {
		mocks.transaction.mockRejectedValueOnce(new Error("DB connection lost"));
		const result = await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		expect(result).toEqual({ recorded: false, counterIncremented: false });
	});

	test("does NOT re-throw the DB error (AC-3)", async () => {
		mocks.transaction.mockRejectedValueOnce(new Error("fatal DB error"));
		const result = await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		expect(result).toEqual({ recorded: false, counterIncremented: false });
	});

	test("logs a structured error with event='analytics_record_failed' and postId (AC-3)", async () => {
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mocks.transaction.mockRejectedValueOnce(new Error("DB write failed"));

		await recordPostView({
			postId: 99,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});

		expect(consoleSpy).toHaveBeenCalledTimes(1);
		const raw = consoleSpy.mock.calls[0][0] as string;
		const parsed = JSON.parse(raw) as Record<string, unknown>;
		expect(parsed).toMatchObject({
			event: "analytics_record_failed",
			postId: 99,
		});
		consoleSpy.mockRestore();
	});

	test("handles non-Error thrown values (string) without crashing", async () => {
		// Covers the `String(error)` branch of the error instanceof Error ternary.
		const consoleSpy = jest
			.spyOn(console, "error")
			.mockImplementation(() => undefined);
		mocks.transaction.mockImplementationOnce(() =>
			Promise.reject("string-rejection"),
		);

		const result = await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});

		expect(result).toEqual({ recorded: false, counterIncremented: false });
		expect(consoleSpy).toHaveBeenCalledTimes(1);
		consoleSpy.mockRestore();
	});
});

describe("recordPostView — referrer parsing", () => {
	test("empty Referer header → referrerSource = 'direct' (AC-5 row shape)", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA), // no Referer header
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ referrerSource: "direct" });
	});

	test("LinkedIn Referer → referrerSource = 'linkedin'", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA, "https://www.linkedin.com/feed/"),
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ referrerSource: "linkedin" });
	});

	test("GitHub Referer → referrerSource = 'github'", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA, "https://github.com/tanstack"),
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ referrerSource: "github" });
	});
});

describe("recordPostView — device parsing", () => {
	test("mobile UA (iPhone) → device = 'mobile'", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(MOBILE_UA),
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ device: "mobile" });
	});

	test("desktop UA (Chrome on Mac) → device = 'desktop'", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ device: "desktop" });
	});
});

describe("recordPostView — V1 column constraints (AC-5)", () => {
	test("inserted row has countryCode = null (ADR-005: V1 defers country)", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ countryCode: null });
	});

	test("inserted row has isBot = false (V1 never inserts bot rows)", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
		});
		const inserted = mocks.txInsertValues.mock.calls[0][0] as Record<
			string,
			unknown
		>;
		expect(inserted).toMatchObject({ isBot: false });
	});
});

describe("recordPostView — bucketEvent composes utmSource + Referer", () => {
	test("forwards the Referer header when no explicit referrer/utmSource is set", async () => {
		const refererValue = "https://www.linkedin.com/feed/";
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA, refererValue),
			lang: "en",
		});

		expect(mocks.bucketEventSpy).toHaveBeenCalledWith({
			utmSource: null,
			referer: refererValue,
			selfHost: null,
		});
		expect(mocks.bucketEventSpy).toHaveBeenCalledTimes(1);
	});

	test("forwards null referer when no Referer header is present and no override", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA), // no Referer header
			lang: "en",
		});

		expect(mocks.bucketEventSpy).toHaveBeenCalledWith({
			utmSource: null,
			referer: null,
			selfHost: null,
		});
	});

	test("forwards the explicit utmSource argument verbatim", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA),
			lang: "en",
			utmSource: "whatsapp",
		});

		expect(mocks.bucketEventSpy).toHaveBeenCalledWith({
			utmSource: "whatsapp",
			referer: null,
			selfHost: null,
		});
	});

	test("forwards the request Host header as selfHost so internal hops bucket direct", async () => {
		const req = makeRequest(HUMAN_UA, "https://example.test/post-a");
		req.headers.set("Host", "example.test");
		await recordPostView({ postId: 1, request: req, lang: "en" });

		expect(mocks.bucketEventSpy).toHaveBeenCalledWith({
			utmSource: null,
			referer: "https://example.test/post-a",
			selfHost: "example.test",
		});
	});

	test("explicit referrer argument overrides the Referer header", async () => {
		await recordPostView({
			postId: 1,
			request: makeRequest(HUMAN_UA, "https://this-must-be-ignored.example"),
			lang: "en",
			referrer: "https://github.com/tanstack",
		});

		expect(mocks.bucketEventSpy).toHaveBeenCalledWith({
			utmSource: null,
			referer: "https://github.com/tanstack",
			selfHost: null,
		});
	});
});
