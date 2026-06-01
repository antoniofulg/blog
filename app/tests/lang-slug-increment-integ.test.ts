/**
 * PGLite integration tests for incrementViewCountFn.
 *
 * Exercises the full path:
 *   incrementViewCountFn(id)
 *     → DB lang lookup (posts.lang)
 *     → recordPostView({ postId, request, lang })
 *     → dual-write: posts.view_count UPDATE + analytics_events INSERT
 *
 * Acceptance criteria verified:
 *   AC-1: human UA → view_count = 1 and one event row inserted.
 *   AC-2: Googlebot UA → view_count = 0 and zero event rows inserted.
 */

import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { analyticsEvents, posts } from "#/db/schema";
import type { TestDb } from "../../tests/e2e/db";
import { createTestDb } from "../../tests/e2e/db";

// ── Hoisted holders ───────────────────────────────────────────────────────────
// vi.hoisted runs before module imports so the mock factories close over
// these holders and always read the current value set in beforeAll / per-test.

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

const reqHolder = vi.hoisted(() => {
	let _req: Request = new Request("http://localhost/");
	return {
		set(req: Request) {
			_req = req;
		},
		get(): Request {
			return _req;
		},
	};
});

// ── Module mocks ──────────────────────────────────────────────────────────────

// Suppress the server-only import guard used by record-event.server.ts and session.ts.
vi.mock("@tanstack/react-start/server-only", () => ({}));

// Provide a controllable getRequest() so we can inject Request objects without
// running inside a real TanStack Start server context.
vi.mock("@tanstack/react-start/server", () => ({
	getRequest: () => reqHolder.get(),
}));

// Stub createServerFn so the static import at the top of $slug.server.ts resolves.
vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

// Replace #/db/client with a lazy getter — the PGLite instance is async, so it
// must be set in beforeAll after createTestDb() resolves.
vi.mock("#/db/client", () => ({
	get db() {
		return dbHolder.get();
	},
}));

// ── Import SUT after mocks ────────────────────────────────────────────────────

import { incrementViewCountFn } from "#/routes/{-$locale}/$slug.server";

// ── Constants ─────────────────────────────────────────────────────────────────

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

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("incrementViewCountFn integration: PGLite via recordPostView", () => {
	it("human UA: view_count increments to 1 and one event row is inserted (AC-1)", async () => {
		const [seededPost] = await testDb.db
			.insert(posts)
			.values({
				filePath: "/content/posts/en/incr-integ-human.mdx",
				slug: "incr-integ-human",
				lang: "en",
				title: "Increment Integ Human Test",
				viewCount: 0,
			})
			.returning();

		reqHolder.set(
			new Request("http://localhost/incr-integ-human", {
				headers: {
					"User-Agent": HUMAN_UA,
					// `Referer` is set but ignored — the increment fetch is
					// same-origin so the browser would always put the post
					// URL here, hence we now route the upstream source
					// through the explicit `referrer` argument instead.
					Referer: "https://this-header-must-be-ignored.example",
				},
			}),
		);

		await incrementViewCountFn({
			id: seededPost.id,
			referrer: "https://github.com/tanstack",
			utmSource: null,
		});

		// AC-1: view_count incremented
		const [updatedPost] = await testDb.db
			.select()
			.from(posts)
			.where(eq(posts.id, seededPost.id));

		expect(updatedPost.viewCount).toBe(1);

		// AC-1: one event row inserted with `referrer_source` derived from the
		// explicit `referrer` argument (NOT the request's `Referer` header).
		const events = await testDb.db
			.select()
			.from(analyticsEvents)
			.where(eq(analyticsEvents.postId, seededPost.id));

		expect(events).toHaveLength(1);
		expect(events[0]).toMatchObject({
			postId: seededPost.id,
			lang: "en",
			isBot: false,
			referrerSource: "github",
		});
	}, 30_000);

	it("Googlebot UA: view_count stays 0 and no event row is inserted (AC-2)", async () => {
		const [seededPost] = await testDb.db
			.insert(posts)
			.values({
				filePath: "/content/posts/en/incr-integ-bot.mdx",
				slug: "incr-integ-bot",
				lang: "en",
				title: "Increment Integ Bot Test",
				viewCount: 0,
			})
			.returning();

		reqHolder.set(
			new Request("http://localhost/incr-integ-bot", {
				headers: { "User-Agent": BOT_UA },
			}),
		);

		await incrementViewCountFn({
			id: seededPost.id,
			referrer: null,
			utmSource: null,
		});

		// AC-2: view_count unchanged
		const [unchangedPost] = await testDb.db
			.select()
			.from(posts)
			.where(eq(posts.id, seededPost.id));

		expect(unchangedPost.viewCount).toBe(0);

		// AC-2: no event rows
		const events = await testDb.db
			.select()
			.from(analyticsEvents)
			.where(eq(analyticsEvents.postId, seededPost.id));

		expect(events).toHaveLength(0);
	}, 30_000);

	it("unknown post id: returns without error and no event row inserted", async () => {
		reqHolder.set(
			new Request("http://localhost/nonexistent", {
				headers: { "User-Agent": HUMAN_UA },
			}),
		);

		// Should resolve without throwing even for a non-existent post id.
		await expect(
			incrementViewCountFn({
				id: 999_999_999,
				referrer: null,
				utmSource: null,
			}),
		).resolves.toBeUndefined();

		const events = await testDb.db
			.select()
			.from(analyticsEvents)
			.where(eq(analyticsEvents.postId, 999_999_999));

		expect(events).toHaveLength(0);
	}, 30_000);
});
