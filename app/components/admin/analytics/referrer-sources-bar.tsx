import { Activity } from "lucide-react";
import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { EmptyState } from "#/components/ui/empty-state";
import {
	ALL_SOURCES,
	type ReferrerSource,
} from "#/lib/analytics/referrer-bucketer";
import { formatDayMonth } from "#/lib/date";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import { WidgetHeader } from "./widget-header";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReferrerByDayEntry = { date: string; source: string; count: number };
// date key is string; all source-count keys are number.
// Union in index signature allows both to coexist.
type WideEntry = { date: string; [source: string]: number | string };

type Props = {
	referrerByDay: ReferrerByDayEntry[];
	locale: Locale;
	/** When set, distinguishes "filter returned no rows" from "no events ever". */
	postId?: number;
};

// ── Color map ─────────────────────────────────────────────────────────────────

/**
 * Stable mapping from every ReferrerSource bucket to a CSS color token.
 *
 * TS exhaustiveness guarantee: `Record<ReferrerSource, string>` causes a
 * compile error if a new bucket is added to `ReferrerSource` but not here.
 *
 * The 10 named sources use chart-1 → chart-10. The two catch-all buckets
 * (`direct`, `other`) use semantic muted tokens so they are visually distinct
 * from named sources in a stacked bar — `direct` traffic coexists with
 * LinkedIn/Google in almost every indie-blog dataset.
 */
export const SOURCE_COLOR_MAP: Record<ReferrerSource, string> = {
	linkedin: "var(--color-chart-1)",
	google: "var(--color-chart-2)",
	github: "var(--color-chart-3)",
	twitter: "var(--color-chart-4)",
	reddit: "var(--color-chart-5)",
	hackernews: "var(--color-chart-6)",
	"dev.to": "var(--color-chart-7)",
	medium: "var(--color-chart-8)",
	bluesky: "var(--color-chart-9)",
	mastodon: "var(--color-chart-10)",
	direct: "var(--color-foreground-muted)",
	other: "var(--color-border-strong)",
	share: "var(--color-accent)",
};

// ── Pivot helper ──────────────────────────────────────────────────────────────

/**
 * Pivots long-format referrer-by-day data into wide-format suitable for
 * Recharts stacked BarChart.
 *
 * Input:  [{ date, source, count }, ...]  (multiple rows per date)
 * Output: [{ date, linkedin: N, google: M, ... }, ...]  (one row per date)
 *
 * - Missing sources for a given date are absent from the wide entry; Recharts
 *   renders them as 0 in stacked mode.
 * - Multiple input rows for the same (date, source) pair are summed.
 *
 * Exported for direct unit testing.
 */
export function pivotReferrerByDay(data: ReferrerByDayEntry[]): WideEntry[] {
	const dateMap = new Map<string, WideEntry>();

	for (const { date, source, count } of data) {
		let entry = dateMap.get(date);
		if (entry === undefined) {
			entry = { date };
			dateMap.set(date, entry);
		}
		entry[source] = ((entry[source] as number | undefined) ?? 0) + count;
	}

	return Array.from(dateMap.values());
}

// ── Main component ────────────────────────────────────────────────────────────

export function ReferrerSourcesBar({ referrerByDay, locale, postId }: Props) {
	const t = strings[locale].admin.analytics;

	const chartData = useMemo(
		() => pivotReferrerByDay(referrerByDay),
		[referrerByDay],
	);

	// Only render Bar series for sources that appear in the active dataset.
	// This keeps the legend clean and matches AC-3.
	const activeSources = useMemo(() => {
		const present = new Set(referrerByDay.map((r) => r.source));
		return ALL_SOURCES.filter((s) => present.has(s));
	}, [referrerByDay]);

	const formatTick = (dateStr: string) =>
		formatDayMonth(new Date(dateStr), locale);

	const isEmpty = referrerByDay.length === 0;

	return (
		<section
			data-testid="referrer-sources-bar"
			aria-label={t.widgets.referrerSources}
			className="rounded-lg border border-border bg-card p-4"
		>
			<WidgetHeader>{t.widgets.referrerSources}</WidgetHeader>

			{isEmpty ? (
				<EmptyState
					icon={Activity}
					title={
						postId !== undefined ? t.empty.noDataForPost : t.empty.awaitingData
					}
					description={
						postId !== undefined
							? t.empty.noDataForPostDescription
							: t.empty.awaitingDataDescription
					}
				/>
			) : (
				<>
					<ResponsiveContainer width="100%" height={220}>
						<BarChart
							data={chartData}
							margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
						>
							<CartesianGrid
								strokeDasharray="3 3"
								stroke="var(--color-border)"
								vertical={false}
							/>
							<XAxis
								dataKey="date"
								tickFormatter={formatTick}
								tick={{ fontSize: 12, fill: "var(--color-foreground-muted)" }}
								axisLine={false}
								tickLine={false}
							/>
							<YAxis
								allowDecimals={false}
								tick={{ fontSize: 12, fill: "var(--color-foreground-muted)" }}
								axisLine={false}
								tickLine={false}
								width={32}
							/>
							<Tooltip />
							<Legend />
							{activeSources.map((source) => (
								<Bar
									key={source}
									dataKey={source}
									stackId="referrers"
									fill={SOURCE_COLOR_MAP[source]}
								/>
							))}
						</BarChart>
					</ResponsiveContainer>

					{/* Screen-reader fallback: raw referrer-by-day rows */}
					<table className="sr-only" aria-label={t.widgets.referrerSources}>
						<thead>
							<tr>
								<th scope="col">{t.a11y.columnDate}</th>
								<th scope="col">{t.a11y.columnSource}</th>
								<th scope="col">{t.topPostsTable.columnVisits}</th>
							</tr>
						</thead>
						<tbody>
							{referrerByDay.map((row, i) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: sr-only table rows have no stable id; index is safe here
								<tr key={i}>
									<td>{row.date}</td>
									<td>{row.source}</td>
									<td>{row.count}</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</section>
	);
}
