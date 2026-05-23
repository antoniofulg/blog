import { Activity } from "lucide-react";
import { useMemo } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ReferenceDot,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { EmptyState } from "#/components/ui/empty-state";
import type { AnalyticsDashboardData } from "#/db/analytics-queries";
import { formatDayMonth } from "#/lib/date";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type DailyTrendPoint = AnalyticsDashboardData["dailyTrend"][number];
type DailyTrendData = AnalyticsDashboardData["dailyTrend"];

type Props = {
	dailyTrend: DailyTrendData;
	locale: Locale;
	/** When set, distinguishes "filter returned no rows" from "no events ever". */
	postId?: number;
};

// ── Peak detection ────────────────────────────────────────────────────────────

/**
 * Returns the top-N entries by `count`, preserving their original array order.
 * If `data.length <= n`, returns a shallow copy of the entire array.
 * Exported for direct unit testing.
 */
export function detectPeaks(data: DailyTrendData, n = 3): DailyTrendPoint[] {
	if (data.length <= n) return [...data];

	// Determine the minimum count that qualifies as a "peak".
	const sortedDesc = [...data].sort((a, b) => b.count - a.count);
	const peakThreshold = sortedDesc[n - 1].count;

	// Collect the first n points that meet the threshold (preserves order).
	const result: DailyTrendPoint[] = [];
	for (const point of data) {
		if (result.length >= n) break;
		if (point.count >= peakThreshold) result.push(point);
	}
	return result;
}

// ── Custom tooltip ────────────────────────────────────────────────────────────

type TooltipProps = {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
	locale: Locale;
};

function ChartTooltip({ active, payload, label, locale }: TooltipProps) {
	if (!active || !payload?.length || label === undefined) return null;
	const d = new Date(label);
	return (
		<div className="rounded-md border border-border bg-card px-3 py-2 text-sm shadow-sm">
			<p className="text-foreground-muted">{formatDayMonth(d, locale)}</p>
			<p className="font-semibold text-foreground">{payload[0].value}</p>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function DailyTrendChart({ dailyTrend, locale, postId }: Props) {
	const t = strings[locale].admin.analytics;

	const peaks = useMemo(() => detectPeaks(dailyTrend), [dailyTrend]);

	const formatTick = (dateStr: string) =>
		formatDayMonth(new Date(dateStr), locale);

	const isEmpty = dailyTrend.length === 0;

	return (
		<section
			data-testid="daily-trend-chart"
			aria-label={t.widgets.dailyTrend}
			className="rounded-lg border border-border bg-card p-4"
		>
			<h2 className="mb-4 text-sm font-medium text-foreground-muted">
				{t.widgets.dailyTrend}
			</h2>

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
						<LineChart
							data={dailyTrend}
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
							<Tooltip content={<ChartTooltip locale={locale} />} />
							<Line
								type="monotone"
								dataKey="count"
								stroke="var(--color-chart-1)"
								strokeWidth={2}
								dot={false}
								activeDot={{ r: 4, fill: "var(--color-chart-1)" }}
							/>
							{peaks.map((peak) => (
								<ReferenceDot
									key={peak.date}
									x={peak.date}
									y={peak.count}
									r={5}
									fill="var(--color-chart-4)"
									stroke="none"
								/>
							))}
						</LineChart>
					</ResponsiveContainer>

					{/* Screen-reader fallback: same data as the visual chart */}
					<table className="sr-only" aria-label={t.widgets.dailyTrend}>
						<thead>
							<tr>
								<th scope="col">{t.a11y.columnDate}</th>
								<th scope="col">{t.topPostsTable.columnVisits}</th>
							</tr>
						</thead>
						<tbody>
							{dailyTrend.map((point) => (
								<tr key={point.date}>
									<td>{point.date}</td>
									<td>{point.count}</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</section>
	);
}
