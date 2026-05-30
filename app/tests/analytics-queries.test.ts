/**
 * Unit tests for app/db/analytics-queries.ts
 *
 * DB is fully mocked — no external process required.
 * Integration tests with PGLite live in analytics-integ.test.ts.
 *
 * Coverage goals:
 *   - resolveRange: all 6 presets produce correct window boundaries
 *   - Zod validation: rejects invalid range + negative postId
 *   - getAnalyticsDashboard: returns correctly shaped payload; respects postId filter
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Hoisted mock setup ────────────────────────────────────────────────────────

// server-only guard: no-op in Node/vitest context
vi.mock("@tanstack/react-start/server-only", () => ({}));

// Reusable fluent query-chain builder.
// Drizzle query chains are awaitable objects. We build on top of a real
// Promise so the object's `then` comes from Promise.prototype (not an own
// property) — this avoids Biome's noThenProperty lint rule and correctly
// participates in Promise.all / await chains.
function makeChain<T>(resolveValue: T[]) {
	// biome-ignore lint/suspicious/noExplicitAny: stub needs to accept any type for fluent returns
	const base: any = Promise.resolve(resolveValue);
	for (const key of [
		"from",
		"where",
		"innerJoin",
		"groupBy",
		"orderBy",
		"limit",
	]) {
		base[key] = vi.fn().mockReturnValue(base);
	}
	return base as Promise<T[]>;
}

const dbMock = vi.hoisted(() => {
	const selectFn = vi.fn();
	return { selectFn };
});

vi.mock("#/db/client", () => ({
	get db() {
		return { select: dbMock.selectFn };
	},
}));

// Import SUT after mocks are registered
import {
	fillDailyGaps,
	fillReferrerDayGaps,
	getAnalyticsDashboard,
	resolveRange,
} from "#/db/analytics-queries";
// Real canonical list — imported so this test catches drift if a new
// ReferrerSource is added without updating the array.
import { ALL_SOURCES } from "#/lib/analytics/referrer-bucketer";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Seed the mock so Q1–Q7 (and optionally Q8) return the given arrays. */
function seedMock(overrides: {
	summary?: object[];
	topReferrer?: object[];
	topLang?: object[];
	prevTotal?: object[];
	dailyTrend?: object[];
	referrerByDay?: object[];
	topPosts?: object[];
	sparklines?: object[];
}) {
	const {
		summary = [
			{
				totalVisits: 50,
				uniquePosts: 3,
				mobile: 10,
				tablet: 5,
				desktop: 35,
				langEn: 30,
				langPtBr: 20,
			},
		],
		topReferrer = [{ source: "google", cnt: 20 }],
		topLang = [{ lang: "en", cnt: 30 }],
		prevTotal = [{ total: 8 }],
		dailyTrend = [{ date: "2026-05-23", cnt: 5 }],
		referrerByDay = [{ date: "2026-05-23", source: "direct", cnt: 3 }],
		topPosts = [
			{
				postId: 1,
				slug: "test-post",
				title: "Test Post",
				lang: "en",
				cnt: 50,
			},
		],
		sparklines = [{ postId: 1, date: "2026-05-23", cnt: 5 }],
	} = overrides;

	// Queries run in Promise.all order: Q1, Q2, Q3, Q4, Q5, Q6, Q7, then Q8
	dbMock.selectFn
		.mockReturnValueOnce(makeChain(summary)) // Q1
		.mockReturnValueOnce(makeChain(topReferrer)) // Q2
		.mockReturnValueOnce(makeChain(topLang)) // Q3
		.mockReturnValueOnce(makeChain(prevTotal)) // Q4
		.mockReturnValueOnce(makeChain(dailyTrend)) // Q5
		.mockReturnValueOnce(makeChain(referrerByDay)) // Q6
		.mockReturnValueOnce(makeChain(topPosts)) // Q7
		.mockReturnValueOnce(makeChain(sparklines)); // Q8
}

// ── Tests: resolveRange ───────────────────────────────────────────────────────

describe("resolveRange", () => {
	const ONE_DAY_MS = 24 * 60 * 60 * 1000;

	it("7d — window is exactly 7 days long", () => {
		const before = Date.now();
		const { start, end } = resolveRange("7d");
		const after = Date.now();

		// end should be approximately now
		expect(end.getTime()).toBeGreaterThanOrEqual(before);
		expect(end.getTime()).toBeLessThanOrEqual(after + 5); // 5ms tolerance

		// start should be 7 days before end
		const diff = end.getTime() - start.getTime();
		expect(diff).toBeGreaterThanOrEqual(7 * ONE_DAY_MS - 1000); // 1s tolerance
		expect(diff).toBeLessThanOrEqual(7 * ONE_DAY_MS + 1000);
	});

	it("30d — window is exactly 30 days long", () => {
		const { start, end } = resolveRange("30d");
		const diff = end.getTime() - start.getTime();
		expect(diff).toBeGreaterThanOrEqual(30 * ONE_DAY_MS - 1000);
		expect(diff).toBeLessThanOrEqual(30 * ONE_DAY_MS + 1000);
	});

	it("90d — window is exactly 90 days long", () => {
		const { start, end } = resolveRange("90d");
		const diff = end.getTime() - start.getTime();
		expect(diff).toBeGreaterThanOrEqual(90 * ONE_DAY_MS - 1000);
		expect(diff).toBeLessThanOrEqual(90 * ONE_DAY_MS + 1000);
	});

	it("mtd — start is the first day of the current month at midnight", () => {
		const { start, end } = resolveRange("mtd");
		const now = new Date();

		expect(start.getFullYear()).toBe(now.getFullYear());
		expect(start.getMonth()).toBe(now.getMonth());
		expect(start.getDate()).toBe(1);
		expect(start.getHours()).toBe(0);
		expect(start.getMinutes()).toBe(0);

		// end is approximately now
		expect(end.getTime()).toBeGreaterThan(start.getTime());
	});

	it("ytd — start is January 1st of the current year at midnight", () => {
		const { start } = resolveRange("ytd");
		const now = new Date();

		expect(start.getFullYear()).toBe(now.getFullYear());
		expect(start.getMonth()).toBe(0);
		expect(start.getDate()).toBe(1);
	});

	it("all — start is Unix epoch (new Date(0))", () => {
		const { start, end } = resolveRange("all");
		expect(start.getTime()).toBe(0);
		expect(end.getTime()).toBeGreaterThan(0);
	});
});

// ── Tests: Zod validation ─────────────────────────────────────────────────────

describe("getAnalyticsDashboard — Zod validation", () => {
	it("throws ZodError for unrecognised range string", async () => {
		await expect(
			getAnalyticsDashboard({ range: "invalid" as never }),
		).rejects.toThrow();
	});

	it("throws ZodError for negative postId", async () => {
		await expect(
			getAnalyticsDashboard({ range: "7d", postId: -1 }),
		).rejects.toThrow();
	});

	it("throws ZodError for zero postId", async () => {
		await expect(
			getAnalyticsDashboard({ range: "7d", postId: 0 }),
		).rejects.toThrow();
	});

	it("accepts valid range without postId", async () => {
		seedMock({});
		await expect(
			getAnalyticsDashboard({ range: "30d" }),
		).resolves.not.toThrow();
	});

	it("accepts valid range with positive postId", async () => {
		seedMock({});
		await expect(
			getAnalyticsDashboard({ range: "7d", postId: 42 }),
		).resolves.not.toThrow();
	});
});

// ── Tests: getAnalyticsDashboard shape ────────────────────────────────────────

describe("getAnalyticsDashboard — returned payload shape", () => {
	beforeEach(() => {
		vi.resetAllMocks();
	});

	afterEach(() => {
		vi.resetAllMocks();
	});

	it("returns all five widget data fields with correct shape (AC-1)", async () => {
		seedMock({});
		const result = await getAnalyticsDashboard({ range: "30d" });

		// summary
		expect(result.summary).toMatchObject({
			totalVisits: expect.any(Number),
			uniquePosts: expect.any(Number),
			previousPeriodTotal: expect.any(Number),
		});
		// summary nullables
		expect(
			result.summary.topReferrer === null ||
				typeof result.summary.topReferrer === "object",
		).toBe(true);
		expect(
			result.summary.topLanguage === null ||
				typeof result.summary.topLanguage === "object",
		).toBe(true);

		// dailyTrend
		expect(Array.isArray(result.dailyTrend)).toBe(true);
		if (result.dailyTrend.length > 0) {
			expect(result.dailyTrend[0]).toMatchObject({
				date: expect.any(String),
				count: expect.any(Number),
			});
		}

		// referrerByDay
		expect(Array.isArray(result.referrerByDay)).toBe(true);

		// topPosts
		expect(Array.isArray(result.topPosts)).toBe(true);
		if (result.topPosts.length > 0) {
			expect(result.topPosts[0]).toMatchObject({
				postId: expect.any(Number),
				slug: expect.any(String),
				title: expect.any(String),
				lang: expect.any(String),
				count: expect.any(Number),
				sparkline: expect.any(Array),
			});
		}

		// deviceSplit
		expect(result.deviceSplit).toMatchObject({
			mobile: expect.any(Number),
			tablet: expect.any(Number),
			desktop: expect.any(Number),
		});
	});

	it("maps totalVisits from the DB count value (AC-1)", async () => {
		seedMock({
			summary: [
				{ totalVisits: 42, uniquePosts: 2, mobile: 5, tablet: 2, desktop: 35 },
			],
		});
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.summary.totalVisits).toBe(42);
		expect(result.summary.uniquePosts).toBe(2);
	});

	it("maps deviceSplit from conditional sums (AC-1)", async () => {
		seedMock({
			summary: [
				{
					totalVisits: 100,
					uniquePosts: 5,
					mobile: 40,
					tablet: 20,
					desktop: 40,
				},
			],
		});
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.deviceSplit).toEqual({ mobile: 40, tablet: 20, desktop: 40 });
	});

	it("maps languageSplit from conditional sums", async () => {
		seedMock({
			summary: [
				{
					totalVisits: 100,
					uniquePosts: 5,
					mobile: 40,
					tablet: 20,
					desktop: 40,
					langEn: 70,
					langPtBr: 30,
				},
			],
		});
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.languageSplit).toEqual({ en: 70, "pt-br": 30 });
	});

	it("topReferrer is null when no referrer rows returned", async () => {
		seedMock({ topReferrer: [] });
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.summary.topReferrer).toBeNull();
	});

	it("topLanguage is null when no lang rows returned", async () => {
		seedMock({ topLang: [] });
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.summary.topLanguage).toBeNull();
	});

	it("topReferrer carries correct source and count when present", async () => {
		seedMock({ topReferrer: [{ source: "linkedin", cnt: 15 }] });
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.summary.topReferrer).toEqual({
			source: "linkedin",
			count: 15,
		});
	});

	it("previousPeriodTotal mapped from Q4 count (AC-3)", async () => {
		seedMock({ prevTotal: [{ total: 25 }] });
		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.summary.previousPeriodTotal).toBe(25);
	});

	it("previousPeriodTotal is 0 for range=all (no previous period query runs)", async () => {
		// For "all" range, Q4 is Promise.resolve([{ total: 0 }]) — only 7 select
		// calls are made (Q4 uses the short-circuit path).
		dbMock.selectFn
			.mockReturnValueOnce(
				makeChain([
					{
						totalVisits: 10,
						uniquePosts: 1,
						mobile: 3,
						tablet: 1,
						desktop: 6,
					},
				]),
			) // Q1
			.mockReturnValueOnce(makeChain([{ source: "direct", cnt: 10 }])) // Q2
			.mockReturnValueOnce(makeChain([{ lang: "en", cnt: 10 }])) // Q3
			// Q4 skipped (Promise.resolve used internally)
			.mockReturnValueOnce(makeChain([{ date: "2026-05-23", cnt: 10 }])) // Q5
			.mockReturnValueOnce(
				makeChain([{ date: "2026-05-23", source: "direct", cnt: 10 }]),
			) // Q6
			.mockReturnValueOnce(
				makeChain([
					{
						postId: 1,
						slug: "a",
						title: "A",
						lang: "en",
						cnt: 10,
					},
				]),
			) // Q7
			.mockReturnValueOnce(
				makeChain([{ postId: 1, date: "2026-05-23", cnt: 10 }]),
			); // Q8

		const result = await getAnalyticsDashboard({ range: "all" });
		expect(result.summary.previousPeriodTotal).toBe(0);
	});

	it("topPosts are sorted descending by count and limited to ≤10 (AC-4)", async () => {
		const topPostsMock = Array.from({ length: 10 }, (_, i) => ({
			postId: i + 1,
			slug: `post-${i + 1}`,
			title: `Post ${i + 1}`,
			lang: "en",
			cnt: 100 - i * 5, // 100, 95, 90, ... — descending
		}));
		// Sparklines: one entry per post
		const sparklinesMock = topPostsMock.map((p) => ({
			postId: p.postId,
			date: "2026-05-23",
			cnt: p.cnt,
		}));
		seedMock({ topPosts: topPostsMock, sparklines: sparklinesMock });

		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.topPosts.length).toBeLessThanOrEqual(10);
		// Q7 returns already-sorted data from DB; verify mapping preserves order
		expect(result.topPosts[0].count).toBeGreaterThanOrEqual(
			result.topPosts[result.topPosts.length - 1].count,
		);
	});

	it("topPosts sparkline is an array of numbers (AC-1)", async () => {
		seedMock({});
		const result = await getAnalyticsDashboard({ range: "30d" });
		for (const p of result.topPosts) {
			expect(Array.isArray(p.sparkline)).toBe(true);
			for (const n of p.sparkline) {
				expect(typeof n).toBe("number");
			}
		}
	});

	it("empty DB returns zeros and empty arrays (AC-5)", async () => {
		dbMock.selectFn
			.mockReturnValueOnce(
				makeChain([
					{
						totalVisits: 0,
						uniquePosts: 0,
						mobile: 0,
						tablet: 0,
						desktop: 0,
					},
				]),
			) // Q1
			.mockReturnValueOnce(makeChain([])) // Q2
			.mockReturnValueOnce(makeChain([])) // Q3
			.mockReturnValueOnce(makeChain([{ total: 0 }])) // Q4
			.mockReturnValueOnce(makeChain([])) // Q5
			.mockReturnValueOnce(makeChain([])) // Q6
			.mockReturnValueOnce(makeChain([])); // Q7 (no topPosts → Q8 skipped)

		const result = await getAnalyticsDashboard({ range: "30d" });
		expect(result.summary.totalVisits).toBe(0);
		expect(result.summary.uniquePosts).toBe(0);
		expect(result.summary.topReferrer).toBeNull();
		expect(result.summary.topLanguage).toBeNull();
		expect(result.summary.previousPeriodTotal).toBe(0);
		expect(result.dailyTrend).toEqual([]);
		expect(result.referrerByDay).toEqual([]);
		expect(result.topPosts).toEqual([]);
		expect(result.deviceSplit).toEqual({ mobile: 0, tablet: 0, desktop: 0 });
	});

	it("non-existent postId returns zeros and empty arrays without throwing (AC-5)", async () => {
		// Simulate a postId that has no matching events
		dbMock.selectFn
			.mockReturnValueOnce(
				makeChain([
					{
						totalVisits: 0,
						uniquePosts: 0,
						mobile: 0,
						tablet: 0,
						desktop: 0,
					},
				]),
			)
			.mockReturnValueOnce(makeChain([]))
			.mockReturnValueOnce(makeChain([]))
			.mockReturnValueOnce(makeChain([{ total: 0 }]))
			.mockReturnValueOnce(makeChain([]))
			.mockReturnValueOnce(makeChain([]))
			.mockReturnValueOnce(makeChain([]));

		await expect(
			getAnalyticsDashboard({ range: "30d", postId: 99999 }),
		).resolves.toMatchObject({
			summary: { totalVisits: 0 },
			topPosts: [],
			dailyTrend: [],
		});
	});

	it("sparklines are filled with 0 for days with no events for a post", async () => {
		// Two posts; post 2 has no event on day 1 (only day 2)
		seedMock({
			topPosts: [
				{ postId: 1, slug: "a", title: "A", lang: "en", cnt: 10 },
				{ postId: 2, slug: "b", title: "B", lang: "en", cnt: 5 },
			],
			sparklines: [
				{ postId: 1, date: "2026-05-22", cnt: 6 },
				{ postId: 1, date: "2026-05-23", cnt: 4 },
				// post 2 only has day 2
				{ postId: 2, date: "2026-05-23", cnt: 5 },
			],
		});

		const result = await getAnalyticsDashboard({ range: "7d" });
		const post1 = result.topPosts.find((p) => p.postId === 1);
		const post2 = result.topPosts.find((p) => p.postId === 2);

		// post1 should have 2 entries (both dates)
		expect(post1?.sparkline).toHaveLength(2);
		expect(post1?.sparkline).toEqual([6, 4]);

		// post2 sparkline should be [0, 5] — zero-filled for the missing day
		expect(post2?.sparkline).toHaveLength(2);
		expect(post2?.sparkline[0]).toBe(0); // day "2026-05-22" → no event
		expect(post2?.sparkline[1]).toBe(5); // day "2026-05-23" → 5 events
	});
});

// ── Tests: fillDailyGaps ──────────────────────────────────────────────────────

describe("fillDailyGaps", () => {
	const w = (start: string, end: string) => ({
		start: new Date(`${start}T00:00:00Z`),
		end: new Date(`${end}T23:59:59Z`),
	});

	it("returns empty array for empty input (no data, no axis to fill)", () => {
		expect(fillDailyGaps([], w("2025-01-01", "2025-01-07"), "7d")).toEqual([]);
	});

	it("returns input unchanged when all dates are present (no gaps)", () => {
		const rows = [
			{ date: "2025-01-01", count: 5 },
			{ date: "2025-01-02", count: 3 },
			{ date: "2025-01-03", count: 7 },
		];
		const result = fillDailyGaps(rows, w("2025-01-01", "2025-01-03"), "7d");
		expect(result).toHaveLength(3);
		expect(result.map((r) => r.date)).toEqual([
			"2025-01-01",
			"2025-01-02",
			"2025-01-03",
		]);
	});

	it("inserts zero-count entries for missing dates", () => {
		const rows = [
			{ date: "2025-01-01", count: 5 },
			{ date: "2025-01-03", count: 7 },
		];
		const result = fillDailyGaps(rows, w("2025-01-01", "2025-01-03"), "7d");
		expect(result).toHaveLength(3);
		expect(result[1]).toEqual({ date: "2025-01-02", count: 0 });
	});

	it("fills all days from window.start to window.end", () => {
		const rows = [{ date: "2025-01-05", count: 10 }];
		const result = fillDailyGaps(rows, w("2025-01-01", "2025-01-07"), "7d");
		expect(result).toHaveLength(7);
		expect(result[0]).toEqual({ date: "2025-01-01", count: 0 });
		expect(result[4]).toEqual({ date: "2025-01-05", count: 10 });
		expect(result[6]).toEqual({ date: "2025-01-07", count: 0 });
	});

	it("for range='all', fills from first data row date (not epoch)", () => {
		// window.start is epoch but data starts at "2025-01-03"
		const rows = [
			{ date: "2025-01-03", count: 2 },
			{ date: "2025-01-05", count: 4 },
		];
		// end is Jan 5 so fill is 3 days: Jan 3, Jan 4, Jan 5
		const result = fillDailyGaps(rows, w("1970-01-01", "2025-01-05"), "all");
		expect(result).toHaveLength(3);
		expect(result[0].date).toBe("2025-01-03");
		expect(result[1]).toEqual({ date: "2025-01-04", count: 0 });
		expect(result[2].date).toBe("2025-01-05");
	});

	it("preserves ascending order of output dates", () => {
		const rows = [
			{ date: "2025-01-03", count: 1 },
			{ date: "2025-01-01", count: 3 },
		];
		// Even with out-of-order input, output is sorted by date
		const result = fillDailyGaps(rows, w("2025-01-01", "2025-01-03"), "7d");
		expect(result.map((r) => r.date)).toEqual([
			"2025-01-01",
			"2025-01-02",
			"2025-01-03",
		]);
	});
});

// ── Tests: fillReferrerDayGaps ────────────────────────────────────────────────

describe("fillReferrerDayGaps", () => {
	const w = (start: string, end: string) => ({
		start: new Date(`${start}T00:00:00Z`),
		end: new Date(`${end}T23:59:59Z`),
	});

	it("returns empty array for empty input", () => {
		expect(
			fillReferrerDayGaps([], w("2025-01-01", "2025-01-03"), "7d"),
		).toEqual([]);
	});

	it("returns input unchanged when all dates are present", () => {
		const rows = [
			{ date: "2025-01-01", source: "google", count: 3 },
			{ date: "2025-01-02", source: "direct", count: 2 },
		];
		const result = fillReferrerDayGaps(
			rows,
			w("2025-01-01", "2025-01-02"),
			"7d",
		);
		expect(result.filter((r) => r.count > 0)).toHaveLength(2);
	});

	it("inserts sentinel rows for missing dates", () => {
		const rows = [
			{ date: "2025-01-01", source: "google", count: 3 },
			{ date: "2025-01-03", source: "linkedin", count: 5 },
		];
		const result = fillReferrerDayGaps(
			rows,
			w("2025-01-01", "2025-01-03"),
			"7d",
		);
		const jan2 = result.filter((r) => r.date === "2025-01-02");
		expect(jan2).toHaveLength(1);
		expect(jan2[0]).toEqual({
			date: "2025-01-02",
			source: "__gap__",
			count: 0,
		});
	});

	it("gap sentinel is not a real ReferrerSource — does not pollute activeSources", () => {
		// Simulates a blog with only LinkedIn traffic + one quiet gap day.
		// The activeSources computation in referrer-sources-bar.tsx filters
		// ALL_SOURCES against the set of sources present in the filled rows.
		// "__gap__" must NOT appear in ALL_SOURCES so "other" stays absent.
		// ALL_SOURCES is imported from the real module so any drift between
		// the canonical list and this assertion fails fast.
		const rows = [{ date: "2025-01-01", source: "linkedin", count: 5 }];
		const result = fillReferrerDayGaps(
			rows,
			w("2025-01-01", "2025-01-02"),
			"7d",
		);
		const present = new Set(result.map((r) => r.source));
		const activeSources = ALL_SOURCES.filter((s) => present.has(s));
		expect(activeSources).toEqual(["linkedin"]);
		expect(activeSources).not.toContain("other");
	});

	it("output is sorted by date", () => {
		const rows = [
			{ date: "2025-01-03", source: "google", count: 3 },
			{ date: "2025-01-01", source: "direct", count: 2 },
		];
		const result = fillReferrerDayGaps(
			rows,
			w("2025-01-01", "2025-01-03"),
			"7d",
		);
		const dates = result.map((r) => r.date);
		expect(dates[0]).toBe("2025-01-01");
		expect(dates[dates.length - 1]).toBe("2025-01-03");
	});
});
