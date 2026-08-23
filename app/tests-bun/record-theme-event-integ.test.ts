/**
 * PGLite integration tests for the recordThemeEvent server fn.
 *
 * Tests target `recordThemeEventHandler` — the extracted handler function —
 * against a real in-memory PGLite database with the full schema applied via
 * pushSchema. Exercises the actual INSERT path end-to-end.
 *
 * The #/db/client mock uses a lazy getter so the PGLite db instance
 * (created asynchronously in beforeAll) is resolved at call time rather than
 * at mock-factory time.
 *
 * Acceptance criteria verified here:
 *   AC-2: Bot UA → no row inserted in theme_events.
 *   AC-3: Human UA + valid input → one row with all six columns; created_at within 1 s.
 */

import {
	afterAll,
	beforeAll,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import { themeEvents } from "#/db/schema";
import type { RecordThemeEventInput } from "#/lib/analytics/record-theme-event.server";
import type { TestDb } from "../../tests/e2e/db";
import { createTestDb } from "../../tests/e2e/db";

// ── PGLite injection via hoisted getter ───────────────────────────────────────
// jest.hoisted runs before any module imports (including jest.mock factories).
// The holder provides a get/set API so the factory closure always reads the
// current value — set in beforeAll once the async createTestDb() resolves.

const dbHolder = (() => {
	// biome-ignore lint/suspicious/noExplicitAny: db type varies between drizzle adapters
	let _db: any = null;
	return {
		// biome-ignore lint/suspicious/noExplicitAny: db type varies between drizzle adapters
		set(db: any) {
			_db = db;
		},
		clear() {
			_db = null;
		},
		// biome-ignore lint/suspicious/noExplicitAny: db type varies between drizzle adapters
		get(): any {
			return _db;
		},
	};
})();

// server-only guard: no-op in Node/vitest context
mock.module("@tanstack/react-start/server-only", () => ({}));

// getRequest: used inside the server fn handler wrapper; no-op for integration tests
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

// Replace #/db/client with a lazy getter so the PGLite db is resolved at
// call time rather than at mock-factory time.
mock.module("#/db/client", () => ({
	get db() {
		return dbHolder.get();
	},
}));

// ── Import after mocks are registered ────────────────────────────────────────

const { recordThemeEventHandler } = await import(
	"#/lib/analytics/record-theme-event.server"
);

// ── Test constants ────────────────────────────────────────────────────────────

const HUMAN_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
const BOT_UA =
	"Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";

// ── Suite setup ───────────────────────────────────────────────────────────────

let testDb: TestDb;

beforeAll(async () => {
	testDb = await createTestDb();
	dbHolder.set(testDb.db);
}, 30_000);

afterAll(async () => {
	dbHolder.clear();
	await testDb?.close();
});

// ── Integration tests ─────────────────────────────────────────────────────────

describe("recordThemeEventHandler integration: PGLite INSERT", () => {
	test("human UA: inserts one row with all six columns and returns { recorded: true } (AC-3)", async () => {
		const before = Date.now();

		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "long-press",
			lang: "en",
		};
		const result = await recordThemeEventHandler({
			data: input,
			request: new Request("http://localhost/", {
				headers: {
					"User-Agent": HUMAN_UA,
					Referer: "https://github.com/tanstack",
				},
			}),
		});

		const after = Date.now();

		expect(result).toEqual({ recorded: true });

		const rows = await testDb.db.select().from(themeEvents);
		expect(rows).toHaveLength(1);
		expect(rows[0]).toMatchObject({
			theme: "cs16",
			source: "long-press",
			lang: "en",
			device: "desktop",
			referrerSource: "github",
		});

		// Task spec: "row's created_at is within the last second"
		const ts = rows[0].createdAt.getTime();
		expect(ts).toBeGreaterThanOrEqual(before - 1000);
		expect(ts).toBeLessThanOrEqual(after + 1000);
	}, 30_000);

	test("keyboard source: inserts with source='keyboard' and lang='pt-br'", async () => {
		const countBefore = (await testDb.db.select().from(themeEvents)).length;

		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
		};
		const result = await recordThemeEventHandler({
			data: input,
			request: new Request("http://localhost/", {
				headers: { "User-Agent": HUMAN_UA },
			}),
		});

		expect(result).toEqual({ recorded: true });

		const rows = await testDb.db.select().from(themeEvents);
		expect(rows).toHaveLength(countBefore + 1);

		const newest = rows[rows.length - 1];
		expect(newest).toMatchObject({
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
		});
	}, 30_000);

	test("bot UA: does not insert a row and returns { recorded: false } (AC-2)", async () => {
		const countBefore = (await testDb.db.select().from(themeEvents)).length;

		const input: RecordThemeEventInput = {
			theme: "cs16",
			source: "keyboard",
			lang: "pt-br",
		};
		const result = await recordThemeEventHandler({
			data: input,
			request: new Request("http://localhost/", {
				headers: { "User-Agent": BOT_UA },
			}),
		});

		expect(result).toEqual({ recorded: false });

		const countAfter = (await testDb.db.select().from(themeEvents)).length;
		expect(countAfter).toBe(countBefore);
	}, 30_000);
});
