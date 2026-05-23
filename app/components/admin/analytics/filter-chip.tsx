import type { AnalyticsDashboardData } from "#/db/analytics-queries";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

type TopPost = AnalyticsDashboardData["topPosts"][number];

type Props = {
	postId: number | undefined;
	topPosts: TopPost[];
	locale: Locale;
	onClear: () => void;
};

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * Filter chip for the analytics dashboard.
 *
 * Displays the active post filter as a pill with an X button to clear it.
 * Returns null when `postId` is undefined (no active filter).
 *
 * Pure-presentational: `postId` and `onClear` come from the parent route
 * which reads them via `Route.useSearch()` and `Route.navigate()` (ADR-006).
 *
 * Keyboard: X button is Tab-reachable; Enter and Space trigger `onClear`.
 */
export function FilterChip({ postId, topPosts, locale, onClear }: Props) {
	if (postId === undefined) return null;

	const t = strings[locale].admin.analytics.filter;
	const activePost = topPosts.find((p) => p.postId === postId);
	const title = activePost ? activePost.title : `Post #${postId}`;

	const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			onClear();
		}
	};

	return (
		<div
			data-testid="filter-chip"
			className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1.5 text-sm text-accent"
		>
			<span>
				{t.activeChip} {title}
			</span>
			<button
				type="button"
				aria-label={t.clearAll}
				tabIndex={0}
				onClick={onClear}
				onKeyDown={handleKeyDown}
				className="flex items-center justify-center rounded-full p-0.5 text-accent hover:bg-accent/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
			>
				<span aria-hidden="true">×</span>
			</button>
		</div>
	);
}
