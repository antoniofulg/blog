/**
 * PGLite integration tests for the analytics recordPostView() boundary.
 *
 * These tests exercise the full dual-write path (posts.view_count UPDATE +
 * analytics_events INSERT) against an in-memory PGLite instance with the
 * real schema applied via pushSchema.
 *
 * The #/db/client mock uses a lazy getter pattern so the PGLite db instance
 * (created asynchronously in beforeAll) can be injected before recordPostView
 * calls import("#/db/client") inside its function body.
 *
 * Acceptance criteria verified here:
 *   AC-1: Human UA → one event row, view_count = 1.
 *   AC-2: Bot UA → no event row, view_count stays 0.
 *   AC-5: Inserted row has country_code = NULL, is_bot = false.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { analyticsEvents, posts } from "#/db/schema";
import type { TestDb } from "../../tests/e2e/db";
import { createTestDb } from "../../tests/e2e/db";

// ── PGLite injection via hoisted getter ───────────────────────────────────────
// vi.hoisted runs before any module imports (including vi.mock factories).
// The holder provides a get/set API so the factory closure always reads the
// current value — set in beforeAll once the async createTestDb() resolves.

const dbHolder = vi.hoisted(() => {
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
});

// server-only guard: no-op in Node/vitest context
vi.mock("@tanstack/react-start/server-only", () => ({}));

// Replace #/db/client with a lazy getter so the PGLite db is resolved at
// call time rather than at mock-factory time.
vi.mock("#/db/client", () => ({
	get db() {
		return dbHolder.get();
	},
}));

// ── Import boundary AFTER mocks are registered ────────────────────────────────

import { recordPostView } from "#/lib/analytics/record-event.server";

// ── Test constants ────────────────────────────────────────────────────────────

const HUMAN_UA =
	"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const BOT_UA = "Googlebot/2.1 (+http://www.google.com/bot.html)";

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

describe("recordPostView integration: PGLite dual-write", () => {
	it("human UA: seeds post, records view, asserts one event row and view_count = 1 (AC-1, AC-5)", async () => {
		// Seed a post with view_count = 0.
		const [seededPost] = await testDb.db
			.insert(posts)
			.values({
				filePath: "/content/posts/en/integ-test-post.mdx",
				slug: "integ-test-post",
				lang: "en",
				title: "Integration Test Post",
				viewCount: 0,
			})
			.returning();

		const request = new Request("http://localhost/integ-test-post", {
			headers: {
				"User-Agent": HUMAN_UA,
				Referer: "https://github.com/tanstack",
			},
		});

		const result = await recordPostView({
			postId: seededPost.id,
			request,
			lang: "en",
		});

		// AC-1: result flags
		expect(result).toEqual({ recorded: true, counterIncremented: true });

		// AC-1: one event row inserted
		const events = await testDb.db
			.select()
			.from(analyticsEvents)
			.where(eq(analyticsEvents.postId, seededPost.id));

		expect(events).toHaveLength(1);

		// AC-5: column constraints
		expect(events[0]).toMatchObject({
			postId: seededPost.id,
			referrerSource: "github",
			lang: "en",
			device: "desktop",
			countryCode: null,
			isBot: false,
		});

		// AC-1: view_count incremented from 0 to 1
		const [updatedPost] = await testDb.db
			.select()
			.from(posts)
			.where(eq(posts.id, seededPost.id));

		expect(updatedPost.viewCount).toBe(1);
	}, 30_000);

	it("bot UA: no event row inserted and view_count stays 0 (AC-2)", async () => {
		// Seed a separate post so this test is isolated.
		const [seededPost] = await testDb.db
			.insert(posts)
			.values({
				filePath: "/content/posts/en/integ-bot-test-post.mdx",
				slug: "integ-bot-test-post",
				lang: "en",
				title: "Integration Bot Test Post",
				viewCount: 0,
			})
			.returning();

		const request = new Request("http://localhost/integ-bot-test-post", {
			headers: {
				"User-Agent": BOT_UA,
			},
		});

		const result = await recordPostView({
			postId: seededPost.id,
			request,
			lang: "en",
		});

		// AC-2: result flags
		expect(result).toEqual({ recorded: false, counterIncremented: false });

		// AC-2: no event rows
		const events = await testDb.db
			.select()
			.from(analyticsEvents)
			.where(eq(analyticsEvents.postId, seededPost.id));

		expect(events).toHaveLength(0);

		// AC-2: view_count unchanged
		const [unchangedPost] = await testDb.db
			.select()
			.from(posts)
			.where(eq(posts.id, seededPost.id));

		expect(unchangedPost.viewCount).toBe(0);
	}, 30_000);
});
