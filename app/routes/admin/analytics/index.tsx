import { createFileRoute, redirect } from "@tanstack/react-router";
import { z } from "zod";
import { DailyTrendChart } from "#/components/admin/analytics/daily-trend-chart";
import { RangeSelector } from "#/components/admin/analytics/range-selector";
import { SummaryCards } from "#/components/admin/analytics/summary-cards";
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

	component: AnalyticsDashboard,
});

// ── Page component ────────────────────────────────────────────────────────────
// Exported so unit tests can render directly without going through Route.component
// (which the TanStack Start Vite plugin wraps in lazyRouteComponent).
export function AnalyticsDashboard() {
	// Data consumed by widget components in tasks 12-16; call ensures loader re-fires on deps change.
	const data = Route.useLoaderData();
	const { range } = Route.useSearch();
	const navigate = Route.useNavigate();
	const { locale } = useLocale();
	const t = strings[locale].admin.analytics;

	// ADR-006: functional updater preserves postId when changing range.
	const handleRangeSelect = (newRange: AnalyticsRange) => {
		void navigate({ search: (prev) => ({ ...prev, range: newRange }) });
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

				{/* Summary cards — task 12 */}
				<div className="mt-8">
					<SummaryCards summary={data.summary} locale={locale} />
				</div>

				{/* Daily trend chart — task 13 */}
				<div className="mt-4">
					<DailyTrendChart dailyTrend={data.dailyTrend} locale={locale} />
				</div>

				{/* Referrer sources bar — task 14 */}
				<div
					data-testid="referrer-sources-placeholder"
					className="mt-4 h-72 rounded-lg border border-border bg-card"
				/>

				{/* Bottom row: top posts + device split — tasks 15, 16 */}
				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<div
						data-testid="top-posts-placeholder"
						className="h-72 rounded-lg border border-border bg-card"
					/>
					<div
						data-testid="device-split-placeholder"
						className="h-72 rounded-lg border border-border bg-card"
					/>
				</div>
			</div>
		</div>
	);
}
