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
import type { ReferrerSource } from "#/lib/analytics/referrer-bucketer";
import { formatDayMonth } from "#/lib/date";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type ReferrerByDayEntry = { date: string; source: string; count: number };
// date key is string; all source-count keys are number.
// Union in index signature allows both to coexist.
type WideEntry = { date: string; [source: string]: number | string };

type Props = {
	referrerByDay: ReferrerByDayEntry[];
	locale: Locale;
};

// ── Source ordering ───────────────────────────────────────────────────────────

/**
 * Canonical order for all V1 referrer source buckets.
 * Used to: (a) enforce exhaustiveness of SOURCE_COLOR_MAP via the TS type,
 * (b) produce a stable render order for Bar series across re-renders.
 */
const ALL_SOURCES: ReferrerSource[] = [
	"linkedin",
	"google",
	"github",
	"twitter",
	"reddit",
	"hackernews",
	"dev.to",
	"medium",
	"bluesky",
	"mastodon",
	"direct",
	"other",
];

// ── Color map ─────────────────────────────────────────────────────────────────

/**
 * Stable mapping from every ReferrerSource bucket to a CSS chart color token.
 *
 * TS exhaustiveness guarantee: `Record<ReferrerSource, string>` causes a
 * compile error if a new bucket is added to `ReferrerSource` but not here.
 *
 * Note: There are 12 source buckets but only 10 chart tokens (chart-1 to
 * chart-10). `direct` and `other` reuse chart-1/chart-2 respectively since
 * they are catch-all buckets that rarely appear alongside LinkedIn or Google
 * in a single dataset.
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
	direct: "var(--color-chart-1)",
	other: "var(--color-chart-2)",
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

export function ReferrerSourcesBar({ referrerByDay, locale }: Props) {
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

	return (
		<div
			data-testid="referrer-sources-bar"
			className="rounded-lg border border-border bg-card p-4"
		>
			<h2 className="mb-4 text-sm font-medium text-muted-foreground">
				{t.widgets.referrerSources}
			</h2>
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
		</div>
	);
}
