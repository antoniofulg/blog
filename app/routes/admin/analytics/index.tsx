// Accessibility notes (task_19):
// - Each chart widget is a <section aria-label="..."> landmark (implicit role="region" with accessible name).
// - Chart widgets include a visually-hidden sr-only <table> so screen-reader users can navigate the raw data.
// - The top-posts table has a sticky first column (sticky left-0 bg-card z-10) for horizontal-scroll usability.
// - DeviceSplitDonut shows a donut at ≥480 px and a horizontal stacked bar below 480 px (Tailwind responsive classes).
// - All interactive elements (RangeSelector trigger, FilterChip X, TopPostsTable rows) have focus-visible styles.
// - Tab order: RangeSelector trigger → (if visible) FilterChip X → TopPostsTable rows.
import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { AnalyticsDashboardSkeleton } from "#/components/admin/analytics/analytics-skeleton";
import { DailyTrendChart } from "#/components/admin/analytics/daily-trend-chart";
import { DeviceSplitDonut } from "#/components/admin/analytics/device-split-donut";
import { FilterChip } from "#/components/admin/analytics/filter-chip";
import { RangeSelector } from "#/components/admin/analytics/range-selector";
import { ReferrerSourcesBar } from "#/components/admin/analytics/referrer-sources-bar";
import { SummaryCards } from "#/components/admin/analytics/summary-cards";
import { TopPostsTable } from "#/components/admin/analytics/top-posts-table";
import type { AnalyticsRange } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";
import { useLocale } from "#/lib/locale";
import { getAnalyticsDashboardServerFn } from "./index.server";

// ── Search-param schema (ADR-006) ─────────────────────────────────────────────

export const analyticsSearchSchema = z.object({
	range: z
		.enum(["7d", "30d", "90d", "mtd", "ytd", "all"])
		.default("30d")
		.catch("30d"),
	postId: z.coerce.number().int().positive().optional().catch(undefined),
});

export type AnalyticsSearch = z.infer<typeof analyticsSearchSchema>;

// ── Route ─────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/admin/analytics/")({
	validateSearch: (s: Record<string, unknown>): AnalyticsSearch =>
		analyticsSearchSchema.parse(s),

	beforeLoad: ({ context, location }) => {
		if (!context.auth.user)
			throw redirect({ to: "/login/", search: { redirect: location.href } });
	},

	// loaderDeps maps validated search params into deps so the loader
	// re-fires when range or postId change (TanStack Router v1 pattern).
	loaderDeps: ({ search: { range, postId } }) => ({ range, postId }),

	loader: ({ deps }) => getAnalyticsDashboardServerFn({ data: deps }),

	pendingComponent: AnalyticsDashboardSkeleton,

	component: AnalyticsDashboard,
});

// ── Page component ────────────────────────────────────────────────────────────
// Exported so unit tests can render directly without going through Route.component
// (which the TanStack Start Vite plugin wraps in lazyRouteComponent).
export function AnalyticsDashboard() {
	// Data consumed by widget components in tasks 12-16; call ensures loader re-fires on deps change.
	const data = Route.useLoaderData();
	const { range, postId } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { locale } = useLocale();
	const t = strings[locale].admin.analytics;

	// ADR-006: functional updater preserves postId when changing range.
	const handleRangeSelect = (newRange: AnalyticsRange) => {
		void navigate({ search: (prev) => ({ ...prev, range: newRange }) });
	};

	// ADR-006: functional updater preserves range when setting postId filter.
	const handleRowClick = (postId: number) => {
		void navigate({ search: (prev) => ({ ...prev, postId }) });
	};

	// ADR-006: functional updater preserves range and removes only postId.
	const handleClearFilter = () => {
		void navigate({ search: (prev) => ({ ...prev, postId: undefined }) });
	};

	return (
		<div className="px-5 py-10 lg:px-10">
			<div className="mx-auto max-w-6xl">
				{/* Header row: title + range selector (top-right, ADR-006 / task 13) */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<h1 className="font-heading text-3xl font-bold text-foreground">
						{t.pageTitle}
					</h1>
					<RangeSelector
						value={range}
						locale={locale}
						onSelect={handleRangeSelect}
					/>
				</div>

				{/* Filter chip — task 17: visible when postId is in URL */}
				{postId !== undefined && (
					<div className="mt-4">
						<FilterChip
							postId={postId}
							topPosts={data.topPosts}
							locale={locale}
							onClear={handleClearFilter}
						/>
					</div>
				)}

				{/* Summary cards — task 12 */}
				<div className="mt-8">
					<SummaryCards summary={data.summary} locale={locale} />
				</div>

				{/* Daily trend chart — task 13 */}
				<div className="mt-4">
					<DailyTrendChart
						dailyTrend={data.dailyTrend}
						locale={locale}
						postId={postId}
					/>
				</div>

				{/* Referrer sources bar — task 14 */}
				<div className="mt-4">
					<ReferrerSourcesBar
						referrerByDay={data.referrerByDay}
						locale={locale}
						postId={postId}
					/>
				</div>

				{/* Bottom row: top posts + device split — tasks 15, 16 */}
				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<TopPostsTable
						topPosts={data.topPosts}
						locale={locale}
						onRowClick={handleRowClick}
						postId={postId}
					/>
					<DeviceSplitDonut
						deviceSplit={data.deviceSplit}
						locale={locale}
						postId={postId}
					/>
				</div>
			</div>
		</div>
	);
}
