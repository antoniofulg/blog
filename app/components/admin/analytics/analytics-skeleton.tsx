// ── Widget skeleton ───────────────────────────────────────────────────────────

/**
 * SkeletonBox — an animated placeholder matching a widget's approximate
 * dimensions. Used by AnalyticsDashboardSkeleton (pendingComponent).
 */
function SkeletonBox({ className = "" }: { className?: string }) {
	return (
		<div
			className={`animate-pulse rounded-lg border border-border bg-muted ${className}`}
		/>
	);
}

// ── Dashboard skeleton ────────────────────────────────────────────────────────

/**
 * AnalyticsDashboardSkeleton — pendingComponent for the analytics route.
 *
 * Shown while the loader is resolving. Mirrors the dashboard layout with
 * skeleton boxes in place of real widgets, giving users a structural preview
 * without layout shift on data arrival.
 */
export function AnalyticsDashboardSkeleton() {
	return (
		// biome-ignore lint/a11y/useSemanticElements: loading region, not a form output — <output> semantics are incorrect here
		<div
			data-testid="analytics-skeleton"
			className="px-5 py-10 lg:px-10"
			role="status"
			aria-busy="true"
			aria-label="Loading analytics dashboard"
		>
			<div className="mx-auto max-w-6xl">
				{/* Header row: title + range selector placeholders */}
				<div className="flex flex-wrap items-center justify-between gap-4">
					<SkeletonBox className="h-9 w-40" />
					<SkeletonBox className="h-9 w-36" />
				</div>

				{/* Summary cards — 4-column grid */}
				<div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{[0, 1, 2, 3].map((i) => (
						<SkeletonBox key={i} className="h-24" />
					))}
				</div>

				{/* Daily trend chart */}
				<SkeletonBox className="mt-4 h-64" />

				{/* Referrer sources bar */}
				<SkeletonBox className="mt-4 h-64" />

				{/* Bottom row: top posts table + device split donut */}
				<div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
					<SkeletonBox className="h-80" />
					<SkeletonBox className="h-80" />
				</div>
			</div>
		</div>
	);
}
