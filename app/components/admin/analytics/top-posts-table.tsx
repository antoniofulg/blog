import { Activity } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { EmptyState } from "#/components/ui/empty-state";
import type { AnalyticsDashboardData } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import { WidgetHeader } from "./widget-header";

// ── Types ─────────────────────────────────────────────────────────────────────

type TopPost = AnalyticsDashboardData["topPosts"][number];

type Props = {
	topPosts: TopPost[];
	locale: Locale;
	onRowClick: (postId: number) => void;
	/** When set, distinguishes "filter returned no rows" from "no events ever". */
	postId?: number;
};

// ── Language badge ────────────────────────────────────────────────────────────

function LangBadge({ lang }: { lang: "en" | "pt-br" }) {
	return (
		<span className="inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 font-code text-[10px] font-medium uppercase text-foreground-muted">
			{lang === "pt-br" ? "PT-BR" : "EN"}
		</span>
	);
}

// ── Sparkline ─────────────────────────────────────────────────────────────────

type SparklinePoint = { i: number; v: number };

function Sparkline({ data }: { data: number[] }) {
	const points: SparklinePoint[] = data.map((v, i) => ({ i, v }));
	return (
		<ResponsiveContainer width={60} height={24}>
			<LineChart
				data={points}
				margin={{ top: 2, right: 2, bottom: 2, left: 2 }}
			>
				<Line
					type="monotone"
					dataKey="v"
					stroke="var(--color-chart-1)"
					strokeWidth={1.5}
					dot={false}
				/>
			</LineChart>
		</ResponsiveContainer>
	);
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * Top-10 posts table widget.
 *
 * Pure-presentational: no route or DB imports.
 * Navigation is handled by the parent via the `onRowClick` callback.
 * Shows an EmptyState when topPosts is empty (task_18).
 * Distinguishes "no events ever" from "filter returned no rows" via postId.
 */
export function TopPostsTable({ topPosts, locale, onRowClick, postId }: Props) {
	const t = strings[locale].admin.analytics;

	return (
		<section
			data-testid="top-posts-table"
			aria-label={t.widgets.topPosts}
			className="rounded-lg border border-border bg-card p-4"
		>
			<WidgetHeader>{t.widgets.topPosts}</WidgetHeader>

			{topPosts.length === 0 ? (
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
				<div className="overflow-x-auto">
					<table className="w-full">
						<thead>
							<tr className="border-b border-border">
								<th className="sticky left-0 z-10 bg-card pb-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.topPostsTable.columnTitle}
								</th>
								<th className="pb-2 text-left text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.topPostsTable.columnLanguage}
								</th>
								<th className="pb-2 text-right text-xs font-semibold uppercase tracking-wider text-foreground-muted">
									{t.topPostsTable.columnVisits}
								</th>
								<th className="pb-2">
									{/* Sparkline column — no visible header */}
								</th>
							</tr>
						</thead>
						<tbody>
							{topPosts.map((post) => (
								// biome-ignore lint/a11y/useSemanticElements: <tr> must stay inside <table>; role="button" is intentional for filter-cascade (ADR-006)
								<tr
									key={post.postId}
									role="button"
									tabIndex={0}
									onClick={() => onRowClick(post.postId)}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											e.preventDefault();
											onRowClick(post.postId);
										}
									}}
									className="cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted focus:outline-none focus-visible:bg-muted"
								>
									<td className="sticky left-0 z-10 bg-card py-2 pr-3 text-sm font-medium text-foreground">
										<span className="line-clamp-1">{post.title}</span>
									</td>
									<td className="py-2 pr-3">
										<LangBadge lang={post.lang} />
									</td>
									<td className="py-2 pr-3 text-right text-sm tabular-nums text-foreground-secondary">
										{post.count.toLocaleString()}
									</td>
									<td className="py-2">
										<Sparkline data={post.sparkline} />
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</section>
	);
}
