/**
 * PGLite integration tests for app/db/analytics-queries.ts
 *
 * These tests exercise the full `getAnalyticsDashboard` query path against an
 * in-memory PGLite instance using the real schema applied via pushSchema.
 *
 * The #/db/client mock uses the lazy-getter pattern (vi.hoisted + getter) so
 * the PGLite db instance (resolved asynchronously in beforeAll) is injected
 * before `getAnalyticsDashboard` imports #/db/client.
 *
 * Acceptance criteria verified here:
 *   AC-1: range=30d returns typed payload with all five widget fields
 *   AC-2: postId filter cascades — numbers shrink to that post only
 *   AC-3: previousPeriodTotal equals count in the preceding same-length window
 *   AC-4: topPosts ≤ 10, sorted descending by count
 *   AC-5: non-existent postId → zeros/empty, no exception
 */

import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { analyticsEvents, posts } from "#/db/schema";
import type { TestDb } from "../../tests/e2e/db";
import { createTestDb } from "../../tests/e2e/db";

// ── PGLite injection via hoisted getter ───────────────────────────────────────

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

vi.mock("@tanstack/react-start/server-only", () => ({}));

vi.mock("#/db/client", () => ({
	get db() {
		return dbHolder.get();
	},
}));

// Import SUT after mocks
import { getAnalyticsDashboard } from "#/db/analytics-queries";

// ── Suite setup ───────────────────────────────────────────────────────────────

let testDb: TestDb;

// Seeded data IDs (set during beforeAll)
let post1Id: number;
let post2Id: number;
let post3Id: number;

beforeAll(async () => {
	testDb = await createTestDb();
	dbHolder.set(testDb.db);

	// Seed 3 posts
	const seededPosts = await testDb.db
		.insert(posts)
		.values([
			{
				filePath: "/content/posts/en/integ-q-post1.mdx",
				slug: "integ-q-post1",
				lang: "en",
				title: "Integration Query Post 1",
				viewCount: 0,
			},
			{
				filePath: "/content/posts/pt-br/integ-q-post2.mdx",
				slug: "integ-q-post2",
				lang: "pt-br",
				title: "Integration Query Post 2",
				viewCount: 0,
			},
			{
				filePath: "/content/posts/en/integ-q-post3.mdx",
				slug: "integ-q-post3",
				lang: "en",
				title: "Integration Query Post 3",
				viewCount: 0,
			},
		])
		.returning();

	post1Id = seededPosts[0].id;
	post2Id = seededPosts[1].id;
	post3Id = seededPosts[2].id;
}, 30_000);

afterAll(async () => {
	dbHolder.clear();
	await testDb?.close();
});

// ── Seed helper ───────────────────────────────────────────────────────────────

type SeedEventParams = {
	postId: number;
	createdAt: Date;
	referrerSource?: string;
	lang?: string;
	device?: string;
};

async function seedEvents(events: SeedEventParams[]) {
	await testDb.db.insert(analyticsEvents).values(
		events.map((e) => ({
			postId: e.postId,
			createdAt: e.createdAt,
			referrerSource: e.referrerSource ?? "direct",
			lang: e.lang ?? "en",
			device: e.device ?? "desktop",
			isBot: false,
		})),
	);
}

/** Return a Date N days ago from now (UTC-midnight-aligned). */
function daysAgo(n: number): Date {
	const d = new Date();
	d.setUTCHours(0, 0, 0, 0);
	d.setUTCDate(d.getUTCDate() - n);
	return d;
}

// ── Integration test suite ────────────────────────────────────────────────────

describe("getAnalyticsDashboard integration: PGLite", () => {
	it("IT1: seed 100 events across 7 days → summary.totalVisits = 100 (AC-1)", async () => {
		// Seed 100 events spread across 7 days, 3 referrer buckets, 3 devices
		const events: SeedEventParams[] = [];
		const referrers = ["google", "linkedin", "direct"];
		const devices = ["mobile", "desktop", "tablet"];

		for (let i = 0; i < 100; i++) {
			events.push({
				postId: i % 3 === 0 ? post1Id : i % 3 === 1 ? post2Id : post3Id,
				createdAt: daysAgo(i % 7), // spread across 7 days
				referrerSource: referrers[i % 3],
				lang: i % 2 === 0 ? "en" : "pt-br",
				device: devices[i % 3],
			});
		}

		await seedEvents(events);

		const result = await getAnalyticsDashboard({ range: "7d" });

		// All 5 widget fields present
		expect(result.summary).toBeDefined();
		expect(result.dailyTrend).toBeDefined();
		expect(result.referrerByDay).toBeDefined();
		expect(result.topPosts).toBeDefined();
		expect(result.deviceSplit).toBeDefined();

		// AC-1: total = exactly the number we seeded in the 7d window
		// (all 100 events are within range since we use days 0–6)
		expect(result.summary.totalVisits).toBe(100);
	}, 30_000);

	it("IT2: postId filter cascades — all widget values shrink to post1 only (AC-2)", async () => {
		// Count how many of the 100 seeded events belong to post1
		// post1Id gets events at i % 3 === 0 → indices 0,3,6,...99 → 34 events
		const post1EventCount = Math.ceil(100 / 3);

		const result = await getAnalyticsDashboard({
			range: "7d",
			postId: post1Id,
		});

		// summary should reflect only post1
		expect(result.summary.totalVisits).toBe(post1EventCount);
		expect(result.summary.uniquePosts).toBe(1);

		// topPosts should only contain post1
		expect(result.topPosts.every((p) => p.postId === post1Id)).toBe(true);

		// referrerByDay rows should all belong to post1's events
		// (we can't directly check postId but the count should be ≤ post1EventCount)
		const referrerByDayTotal = result.referrerByDay.reduce(
			(sum, r) => sum + r.count,
			0,
		);
		expect(referrerByDayTotal).toBe(post1EventCount);

		// deviceSplit should sum to post1EventCount
		const deviceTotal =
			result.deviceSplit.mobile +
			result.deviceSplit.tablet +
			result.deviceSplit.desktop;
		expect(deviceTotal).toBe(post1EventCount);
	}, 30_000);

	it("IT3: zero events → getAnalyticsDashboard returns empty arrays and zero counts", async () => {
		// Use a fresh DB with no events (no shared test data).
		const freshDb = await createTestDb();
		const originalDb = dbHolder.get();
		dbHolder.set(freshDb.db);

		try {
			// Seed a post (needed for joins in topPosts, but no events)
			await freshDb.db.insert(posts).values({
				filePath: "/content/posts/en/empty-test.mdx",
				slug: "empty-test",
				lang: "en",
				title: "Empty Test",
				viewCount: 0,
			});

			const result = await getAnalyticsDashboard({ range: "all" });

			expect(result.summary.totalVisits).toBe(0);
			expect(result.summary.uniquePosts).toBe(0);
			expect(result.summary.topReferrer).toBeNull();
			expect(result.summary.topLanguage).toBeNull();
			expect(result.summary.previousPeriodTotal).toBe(0);
			expect(result.dailyTrend).toEqual([]);
			expect(result.referrerByDay).toEqual([]);
			expect(result.topPosts).toEqual([]);
			expect(result.deviceSplit).toEqual({
				mobile: 0,
				tablet: 0,
				desktop: 0,
			});
		} finally {
			dbHolder.set(originalDb);
			await freshDb.close();
		}
	}, 30_000);

	it("IT4: previousPeriodTotal matches count from preceding 7d window (AC-3)", async () => {
		// Use a fresh DB for precise control over timestamps.
		const freshDb = await createTestDb();
		const originalDb = dbHolder.get();
		dbHolder.set(freshDb.db);

		try {
			const [seedPost] = await freshDb.db
				.insert(posts)
				.values({
					filePath: "/content/posts/en/prev-period-test.mdx",
					slug: "prev-period-test",
					lang: "en",
					title: "Previous Period Test",
					viewCount: 0,
				})
				.returning();

			const nowMs = Date.now();
			const DAY_MS = 24 * 60 * 60 * 1000;
			const HALF_DAY_MS = DAY_MS / 2;

			// Current 7d window: [now-7d, now]
			// Place 7 events at 0.5d, 1d, 1.5d, 2d, 2.5d, 3d, 3.5d ago —
			// all strictly inside (well away from the now-7d boundary).
			const currentEvents: SeedEventParams[] = Array.from(
				{ length: 7 },
				(_, i) => ({
					postId: seedPost.id,
					createdAt: new Date(nowMs - (i + 1) * HALF_DAY_MS),
				}),
			);

			// Previous 7d window: [now-14d, now-7d]
			// Place 12 events at 7.5d, 8d, 8.5d, 9d, 9.5d, 10d, 10.5d, 11d,
			// 11.5d, 12d, 12.5d, 13d ago — all strictly inside the window.
			const prevEvents: SeedEventParams[] = Array.from(
				{ length: 12 },
				(_, i) => ({
					postId: seedPost.id,
					createdAt: new Date(nowMs - (7.5 + i * 0.5) * DAY_MS),
				}),
			);

			await freshDb.db.insert(analyticsEvents).values(
				[...currentEvents, ...prevEvents].map((e) => ({
					postId: e.postId,
					createdAt: e.createdAt,
					referrerSource: "direct",
					lang: "en",
					device: "desktop",
					isBot: false,
				})),
			);

			const result = await getAnalyticsDashboard({ range: "7d" });

			// Current window: 7 events
			expect(result.summary.totalVisits).toBe(7);

			// Previous window: 12 events
			expect(result.summary.previousPeriodTotal).toBe(12);
		} finally {
			dbHolder.set(originalDb);
			await freshDb.close();
		}
	}, 30_000);

	it("topPosts are limited to ≤10 and sorted descending by event count (AC-4)", async () => {
		const result = await getAnalyticsDashboard({ range: "7d" });
		expect(result.topPosts.length).toBeLessThanOrEqual(10);

		if (result.topPosts.length >= 2) {
			// Verify descending order
			for (let i = 0; i < result.topPosts.length - 1; i++) {
				expect(result.topPosts[i].count).toBeGreaterThanOrEqual(
					result.topPosts[i + 1].count,
				);
			}
		}
	}, 30_000);

	it("non-existent postId returns zeros and empty arrays without throwing (AC-5)", async () => {
		const result = await getAnalyticsDashboard({
			range: "7d",
			postId: 999999,
		});

		expect(result.summary.totalVisits).toBe(0);
		expect(result.summary.uniquePosts).toBe(0);
		expect(result.topPosts).toEqual([]);
		expect(result.dailyTrend).toEqual([]);
		expect(result.referrerByDay).toEqual([]);
	}, 30_000);

	it("referrerByDay contains at least the seeded referrer buckets", async () => {
		const result = await getAnalyticsDashboard({ range: "7d" });
		const sources = new Set(result.referrerByDay.map((r) => r.source));
		// We seeded google, linkedin, direct in IT1
		expect(sources.has("google")).toBe(true);
		expect(sources.has("linkedin")).toBe(true);
		expect(sources.has("direct")).toBe(true);
	}, 30_000);

	it("dailyTrend has ≤8 entries for range=7d (7-day window spans 8 calendar days inclusive after gap-fill)", async () => {
		const result = await getAnalyticsDashboard({ range: "7d" });
		// resolveRange("7d") = [now-7d, now]; fillDailyGaps fills every calendar
		// day in that inclusive window → 8 rows (today + 7 preceding days).
		expect(result.dailyTrend.length).toBeLessThanOrEqual(8);
	}, 30_000);

	it("deviceSplit sums match totalVisits", async () => {
		const result = await getAnalyticsDashboard({ range: "7d" });
		const deviceTotal =
			result.deviceSplit.mobile +
			result.deviceSplit.tablet +
			result.deviceSplit.desktop;
		expect(deviceTotal).toBe(result.summary.totalVisits);
	}, 30_000);
});
