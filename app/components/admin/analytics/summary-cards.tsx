import { ArrowDown, ArrowUp } from "lucide-react";
import type { AnalyticsDashboardData } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type SummaryData = AnalyticsDashboardData["summary"];

type SummaryCardsProps = {
	summary: SummaryData;
	locale: Locale;
};

// ── Delta helper ──────────────────────────────────────────────────────────────

type DeltaResult =
	| { kind: "up"; pct: number }
	| { kind: "down"; pct: number }
	| { kind: "none" };

function computeDelta(current: number, previous: number): DeltaResult {
	if (previous === 0) return { kind: "none" };
	const pct = Math.round(((current - previous) / previous) * 100);
	return pct >= 0 ? { kind: "up", pct } : { kind: "down", pct: Math.abs(pct) };
}

// ── Sub-components ────────────────────────────────────────────────────────────

type CardProps = {
	label: string;
	value: string;
	delta?: DeltaResult;
};

function SummaryCard({ label, value, delta }: CardProps) {
	return (
		<div className="flex flex-col gap-2 rounded-lg border border-border bg-card p-4">
			<span className="text-sm font-medium text-muted-foreground">{label}</span>
			<div className="flex items-end gap-2">
				<span className="text-2xl font-bold text-foreground">{value}</span>
				{delta && delta.kind !== "none" && (
					<span
						className={
							delta.kind === "up"
								? "flex items-center gap-0.5 text-sm font-medium text-green-600"
								: "flex items-center gap-0.5 text-sm font-medium text-red-600"
						}
					>
						{delta.kind === "up" ? (
							<ArrowUp className="h-3.5 w-3.5" aria-hidden="true" />
						) : (
							<ArrowDown className="h-3.5 w-3.5" aria-hidden="true" />
						)}
						{delta.pct}%
					</span>
				)}
			</div>
		</div>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

export function SummaryCards({ summary, locale }: SummaryCardsProps) {
	const t = strings[locale].admin.analytics.summary;

	const {
		totalVisits,
		uniquePosts,
		topReferrer,
		topLanguage,
		previousPeriodTotal,
	} = summary;

	const visitsDelta = computeDelta(totalVisits, previousPeriodTotal);

	return (
		<div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<SummaryCard
				label={t.totalVisits}
				value={totalVisits.toString()}
				delta={visitsDelta}
			/>
			<SummaryCard label={t.uniquePosts} value={uniquePosts.toString()} />
			<SummaryCard
				label={t.topReferrer}
				value={
					topReferrer !== null
						? `${topReferrer.source} (${topReferrer.count})`
						: "—"
				}
			/>
			<SummaryCard
				label={t.topLanguage}
				value={
					topLanguage !== null
						? `${topLanguage.lang} (${topLanguage.count})`
						: "—"
				}
			/>
		</div>
	);
}
