/**
 * Analytics query layer.
 *
 * Exposes one composite function — `getAnalyticsDashboard` — that returns all
 * dashboard widget data in a single logical round-trip. Internally the function
 * runs ≤ 8 Postgres queries, parallelised via `Promise.all`. Query 8 (sparklines)
 * is skipped when the top-posts result is empty.
 *
 * ## Key invariants
 * - Every query filters `is_bot = false` (V1 never inserts bots, but the partial
 *   index `idx_events_nonbot_created` expects this predicate).
 * - The `postId` filter cascades to every sub-query when present.
 * - Date values from daily aggregations use `AT TIME ZONE 'UTC'` so that PGLite
 *   (local-timezone) and production Postgres (UTC) return consistent strings.
 *
 * @module
 */

import {
	and,
	count,
	countDistinct,
	desc,
	eq,
	gte,
	inArray,
	lte,
	sql,
} from "drizzle-orm";
import { z } from "zod";
import { db } from "#/db/client";
import { analyticsEvents, posts } from "#/db/schema";

// ── Public types ──────────────────────────────────────────────────────────────

export type AnalyticsRange = "7d" | "30d" | "90d" | "mtd" | "ytd" | "all";

export type AnalyticsQueryInput = {
	range: AnalyticsRange;
	postId?: number;
};

export type AnalyticsDashboardData = {
	summary: {
		totalVisits: number;
		uniquePosts: number;
		topReferrer: { source: string; count: number } | null;
		topLanguage: { lang: "en" | "pt-br"; count: number } | null;
		previousPeriodTotal: number;
	};
	dailyTrend: Array<{ date: string; count: number }>;
	referrerByDay: Array<{ date: string; source: string; count: number }>;
	topPosts: Array<{
		postId: number;
		slug: string;
		title: string;
		lang: "en" | "pt-br";
		count: number;
		sparkline: number[];
	}>;
	deviceSplit: { mobile: number; tablet: number; desktop: number };
};

// ── Input validation schema ───────────────────────────────────────────────────

const analyticsQueryInputSchema = z.object({
	range: z.enum(["7d", "30d", "90d", "mtd", "ytd", "all"]),
	postId: z.number().int().positive().optional(),
});

// ── Range resolution ──────────────────────────────────────────────────────────

type DateWindow = { start: Date; end: Date };

/**
 * Translate a named range preset into a concrete `{ start, end }` window.
 * For `"all"` the start is set to the Unix epoch so every row matches.
 *
 * Exported so unit tests can exercise the helper in isolation.
 */
export function resolveRange(range: AnalyticsRange): DateWindow {
	const end = new Date();
	switch (range) {
		case "7d": {
			const start = new Date(end);
			start.setDate(start.getDate() - 7);
			return { start, end };
		}
		case "30d": {
			const start = new Date(end);
			start.setDate(start.getDate() - 30);
			return { start, end };
		}
		case "90d": {
			const start = new Date(end);
			start.setDate(start.getDate() - 90);
			return { start, end };
		}
		case "mtd": {
			const start = new Date(end.getFullYear(), end.getMonth(), 1);
			return { start, end };
		}
		case "ytd": {
			const start = new Date(end.getFullYear(), 0, 1);
			return { start, end };
		}
		case "all": {
			return { start: new Date(0), end };
		}
	}
}

/**
 * Compute the immediately-preceding window of the same length.
 * Returns `null` for `"all"` (no meaningful previous period).
 */
function resolvePreviousPeriod(
	range: AnalyticsRange,
	{ start, end }: DateWindow,
): DateWindow | null {
	if (range === "all") return null;
	const windowMs = end.getTime() - start.getTime();
	return {
		start: new Date(start.getTime() - windowMs),
		end: new Date(start.getTime()),
	};
}

// ── Gap-fill helpers ──────────────────────────────────────────────────────────

/**
 * Fill zero-count gaps between date rows so charts render a continuous daily
 * timeline. Returns `rows` unchanged when empty (no data → no axis to fill).
 *
 * For the `"all"` range, `window.start` is the Unix epoch — filling from there
 * would generate thousands of rows. Instead we fill from the first data row's
 * date, which is always the true earliest event date.
 *
 * Exported for unit testing.
 */
export function fillDailyGaps(
	rows: Array<{ date: string; count: number }>,
	{ start, end }: DateWindow,
	range: AnalyticsRange,
): Array<{ date: string; count: number }> {
	if (rows.length === 0) return [];

	const existing = new Map(rows.map((r) => [r.date, r.count]));

	const fillStart =
		range === "all"
			? new Date(`${rows[0].date}T00:00:00Z`)
			: new Date(
					Date.UTC(
						start.getUTCFullYear(),
						start.getUTCMonth(),
						start.getUTCDate(),
					),
				);

	const fillEnd = new Date(
		Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
	);

	const result: Array<{ date: string; count: number }> = [];
	const cursor = new Date(fillStart);
	while (cursor <= fillEnd) {
		const dateStr = cursor.toISOString().slice(0, 10);
		result.push({ date: dateStr, count: existing.get(dateStr) ?? 0 });
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}
	return result;
}

/**
 * Fill zero-count date gaps in long-format referrer-by-day data.
 *
 * For missing dates, inserts a sentinel row `{ date, source: "other", count: 0 }`
 * so `pivotReferrerByDay` creates a WideEntry that anchors the date on the
 * chart's X-axis without adding any visible bar (count = 0).
 *
 * Same `"all"` range special-case as `fillDailyGaps` — fill from first row's
 * date, not the epoch.
 *
 * Exported for unit testing.
 */
export function fillReferrerDayGaps(
	rows: Array<{ date: string; source: string; count: number }>,
	{ start, end }: DateWindow,
	range: AnalyticsRange,
): Array<{ date: string; source: string; count: number }> {
	if (rows.length === 0) return [];

	const presentDates = new Set(rows.map((r) => r.date));

	const fillStart =
		range === "all"
			? new Date(`${rows[0].date}T00:00:00Z`)
			: new Date(
					Date.UTC(
						start.getUTCFullYear(),
						start.getUTCMonth(),
						start.getUTCDate(),
					),
				);

	const fillEnd = new Date(
		Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate()),
	);

	const gaps: Array<{ date: string; source: string; count: number }> = [];
	const cursor = new Date(fillStart);
	while (cursor <= fillEnd) {
		const dateStr = cursor.toISOString().slice(0, 10);
		if (!presentDates.has(dateStr)) {
			gaps.push({ date: dateStr, source: "other", count: 0 });
		}
		cursor.setUTCDate(cursor.getUTCDate() + 1);
	}

	return [...rows, ...gaps].sort((a, b) => a.date.localeCompare(b.date));
}

// ── SQL helper ────────────────────────────────────────────────────────────────

/**
 * Produce a SQL expression that truncates `created_at` to a UTC calendar date
 * and formats it as an ISO date string (`"YYYY-MM-DD"`).
 *
 * Using `AT TIME ZONE 'UTC'` ensures consistent behaviour between PGLite
 * (which runs in the local system timezone) and production Postgres (UTC).
 */
function dayBucket() {
	return sql<string>`(${analyticsEvents.createdAt} AT TIME ZONE 'UTC')::date::text`;
}

// ── Condition builder ─────────────────────────────────────────────────────────

function buildConditions(w: DateWindow, postId?: number) {
	return and(
		eq(analyticsEvents.isBot, false),
		gte(analyticsEvents.createdAt, w.start),
		lte(analyticsEvents.createdAt, w.end),
		...(postId !== undefined ? [eq(analyticsEvents.postId, postId)] : []),
	);
}

// ── Main composite function ───────────────────────────────────────────────────

/**
 * Return all data needed by the analytics dashboard in one logical round-trip.
 *
 * Validates `input` with Zod; throws `ZodError` for invalid inputs. Never
 * throws on missing data — returns empty arrays and zero counts instead.
 */
export async function getAnalyticsDashboard(
	input: AnalyticsQueryInput,
): Promise<AnalyticsDashboardData> {
	// 1. Validate
	const { range, postId } = analyticsQueryInputSchema.parse(input);

	// 2. Resolve windows
	const window = resolveRange(range);
	const prevWindow = resolvePreviousPeriod(range, window);
	const conditions = buildConditions(window, postId);
	const prevConditions = prevWindow
		? buildConditions(prevWindow, postId)
		: undefined;

	// 3. Run queries 1–7 in parallel ──────────────────────────────────────────

	const [
		summaryRows,
		topReferrerRows,
		topLangRows,
		prevTotalRows,
		dailyRows,
		referrerDayRows,
		topPostsRows,
	] = await Promise.all([
		// Q1: summary totals + device split (merged to save one query)
		db
			.select({
				totalVisits: count(),
				uniquePosts: countDistinct(analyticsEvents.postId),
				mobile: sql<number>`COALESCE(sum(CASE WHEN ${analyticsEvents.device} = 'mobile' THEN 1 ELSE 0 END), 0)`,
				tablet: sql<number>`COALESCE(sum(CASE WHEN ${analyticsEvents.device} = 'tablet' THEN 1 ELSE 0 END), 0)`,
				desktop: sql<number>`COALESCE(sum(CASE WHEN ${analyticsEvents.device} = 'desktop' THEN 1 ELSE 0 END), 0)`,
			})
			.from(analyticsEvents)
			.where(conditions),

		// Q2: top referrer source
		db
			.select({
				source: analyticsEvents.referrerSource,
				cnt: count(),
			})
			.from(analyticsEvents)
			.where(conditions)
			.groupBy(analyticsEvents.referrerSource)
			.orderBy(desc(count()))
			.limit(1),

		// Q3: top language
		db
			.select({
				lang: analyticsEvents.lang,
				cnt: count(),
			})
			.from(analyticsEvents)
			.where(conditions)
			.groupBy(analyticsEvents.lang)
			.orderBy(desc(count()))
			.limit(1),

		// Q4: previous-period total (Promise.resolve for "all" range)
		prevConditions
			? db
					.select({ total: count() })
					.from(analyticsEvents)
					.where(prevConditions)
			: Promise.resolve([{ total: 0 }] as const),

		// Q5: daily trend (count per UTC calendar day)
		db
			.select({
				date: dayBucket(),
				cnt: count(),
			})
			.from(analyticsEvents)
			.where(conditions)
			.groupBy(dayBucket())
			.orderBy(dayBucket()),

		// Q6: referrer source by day (long format for stacked bar)
		db
			.select({
				date: dayBucket(),
				source: analyticsEvents.referrerSource,
				cnt: count(),
			})
			.from(analyticsEvents)
			.where(conditions)
			.groupBy(dayBucket(), analyticsEvents.referrerSource)
			.orderBy(dayBucket()),

		// Q7: top-10 posts with event counts (join posts for metadata)
		db
			.select({
				postId: analyticsEvents.postId,
				slug: posts.slug,
				title: posts.title,
				lang: posts.lang,
				cnt: count(),
			})
			.from(analyticsEvents)
			.innerJoin(posts, eq(analyticsEvents.postId, posts.id))
			.where(conditions)
			.groupBy(analyticsEvents.postId, posts.slug, posts.title, posts.lang)
			.orderBy(desc(count()))
			.limit(10),
	]);

	// 4. Q8: sparklines for top posts (one query for all top-N post IDs) ────────

	const topPostIds = topPostsRows.map((r) => r.postId);

	const sparklineRows =
		topPostIds.length > 0
			? await db
					.select({
						postId: analyticsEvents.postId,
						date: dayBucket(),
						cnt: count(),
					})
					.from(analyticsEvents)
					.where(
						and(
							eq(analyticsEvents.isBot, false),
							gte(analyticsEvents.createdAt, window.start),
							lte(analyticsEvents.createdAt, window.end),
							inArray(analyticsEvents.postId, topPostIds),
						),
					)
					.groupBy(analyticsEvents.postId, dayBucket())
					.orderBy(analyticsEvents.postId, dayBucket())
			: [];

	// 5. Assemble sparkline map: postId → day-ordered count array ───────────────

	// Collect the union of all dates present in any sparkline row (sorted).
	const allSparkDates = [
		...new Set(sparklineRows.map((r) => r.date as string)),
	].sort();

	const sparklineMap = new Map<number, number[]>();
	for (const pid of topPostIds) {
		const dateCount = new Map<string, number>();
		for (const row of sparklineRows) {
			if (row.postId === pid) {
				dateCount.set(row.date as string, Number(row.cnt));
			}
		}
		sparklineMap.set(
			pid,
			allSparkDates.map((d) => dateCount.get(d) ?? 0),
		);
	}

	// 6. Build and return the payload ────────────────────────────────────────────

	const sr = summaryRows[0] ?? {
		totalVisits: 0,
		uniquePosts: 0,
		mobile: 0,
		tablet: 0,
		desktop: 0,
	};

	return {
		summary: {
			totalVisits: Number(sr.totalVisits),
			uniquePosts: Number(sr.uniquePosts),
			topReferrer:
				topReferrerRows.length > 0
					? {
							source: topReferrerRows[0].source,
							count: Number(topReferrerRows[0].cnt),
						}
					: null,
			topLanguage:
				topLangRows.length > 0
					? {
							lang: topLangRows[0].lang as "en" | "pt-br",
							count: Number(topLangRows[0].cnt),
						}
					: null,
			previousPeriodTotal: Number(
				(prevTotalRows as Array<{ total: number | string }>)[0]?.total ?? 0,
			),
		},
		dailyTrend: fillDailyGaps(
			dailyRows.map((r) => ({ date: r.date as string, count: Number(r.cnt) })),
			window,
			range,
		),
		referrerByDay: fillReferrerDayGaps(
			referrerDayRows.map((r) => ({
				date: r.date as string,
				source: r.source,
				count: Number(r.cnt),
			})),
			window,
			range,
		),
		topPosts: topPostsRows.map((r) => ({
			postId: r.postId,
			slug: r.slug,
			title: r.title,
			lang: r.lang as "en" | "pt-br",
			count: Number(r.cnt),
			sparkline: sparklineMap.get(r.postId) ?? [],
		})),
		deviceSplit: {
			mobile: Number(sr.mobile),
			tablet: Number(sr.tablet),
			desktop: Number(sr.desktop),
		},
	};
}
