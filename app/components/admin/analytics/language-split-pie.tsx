import { Activity } from "lucide-react";
import { useMemo } from "react";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { EmptyState } from "#/components/ui/empty-state";
import { resolveLanguageLabel } from "#/lib/analytics/source-label";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import { LOCALES } from "#/lib/locale";
import { WidgetHeader } from "./widget-header";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
	languageSplit: { en: number; "pt-br": number };
	locale: Locale;
	/** When set, distinguishes "filter returned no rows" from "no events ever". */
	postId?: number;
};

// ── Constants ─────────────────────────────────────────────────────────────────

/**
 * Stable mapping from each content locale to a chart color token. Reuses the
 * shared chart palette so the language pie sits visually alongside the device
 * donut and referrer bars rather than introducing new hues.
 */
export const LANGUAGE_COLORS: Record<Locale, string> = {
	en: "var(--color-chart-2)",
	"pt-br": "var(--color-chart-4)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Integer percent share of a value within a total. Returns 0 when the total is
 * 0 (avoids NaN on zero-sum data). Exported for direct unit testing.
 */
export function computePercent(value: number, total: number): number {
	if (total === 0) return 0;
	return Math.round((value / total) * 100);
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * LanguageSplitPie — pure-presentational.
 *
 * Renders a Recharts pie of pageviews per content locale (en / pt-br). Slice
 * labels are localized via `resolveLanguageLabel`, so the same data reads as
 * "English / Portuguese" in the EN admin and "Inglês / Português" in pt-br.
 *
 * Zero-sum: renders EmptyState instead of the chart (matches DeviceSplitDonut).
 */
export function LanguageSplitPie({ languageSplit, locale, postId }: Props) {
	const t = strings[locale].admin.analytics;

	const total = languageSplit.en + languageSplit["pt-br"];
	const isEmpty = total === 0;

	// One slice per content locale; label resolved to the UI language.
	const pieData = useMemo(
		() =>
			LOCALES.map((lang) => ({
				lang,
				name: resolveLanguageLabel(lang, locale),
				value: languageSplit[lang],
			})),
		[languageSplit, locale],
	);

	return (
		<section
			data-testid="language-split-pie"
			aria-label={t.widgets.languageSplit}
			className="rounded-lg border border-border bg-card p-4"
		>
			<WidgetHeader>{t.widgets.languageSplit}</WidgetHeader>

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
						<PieChart>
							<Pie
								data={pieData}
								dataKey="value"
								nameKey="name"
								outerRadius={80}
							>
								{pieData.map((entry) => (
									<Cell key={entry.lang} fill={LANGUAGE_COLORS[entry.lang]} />
								))}
							</Pie>
							<Legend />
							<Tooltip
								formatter={(value: number, name: string) => [
									`${value} (${computePercent(value, total)}%)`,
									name,
								]}
							/>
						</PieChart>
					</ResponsiveContainer>

					{/* Screen-reader fallback: same data as the visual chart */}
					<table className="sr-only" aria-label={t.widgets.languageSplit}>
						<thead>
							<tr>
								<th scope="col">{t.topPostsTable.columnLanguage}</th>
								<th scope="col">{t.topPostsTable.columnVisits}</th>
							</tr>
						</thead>
						<tbody>
							{pieData.map((entry) => (
								<tr key={entry.lang}>
									<td>{entry.name}</td>
									<td>{entry.value}</td>
								</tr>
							))}
						</tbody>
					</table>
				</>
			)}
		</section>
	);
}
