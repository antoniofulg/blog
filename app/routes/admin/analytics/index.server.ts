import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
	type AnalyticsDashboardData,
	type AnalyticsQueryInput,
	getAnalyticsDashboard,
} from "#/db/analytics-queries";
import { requireSession } from "#/lib/session";

// ── Input schema (mirrors analyticsSearchSchema sans .catch/.default) ─────────

const dashboardInputSchema = z.object({
	range: z.enum(["7d", "30d", "90d", "mtd", "ytd", "all"]),
	postId: z.number().int().positive().optional(),
});

// ── Raw handler functions (testable without createServerFn wrapper) ───────────

/** Pure DB delegation — no auth. Test directly for query shape assertions. */
export async function getAnalyticsDashboardFn(
	input: AnalyticsQueryInput,
): Promise<AnalyticsDashboardData> {
	return getAnalyticsDashboard(input);
}

/**
 * Auth-gated handler combining requireSession + getAnalyticsDashboardFn.
 * Exported for unit tests — mirrors the pattern used in admin/index.server.ts
 * (getAllPostsFn). The createServerFn wrapper below delegates to this.
 */
export async function getAnalyticsDashboardHandler(
	data: AnalyticsQueryInput,
): Promise<AnalyticsDashboardData> {
	await requireSession();
	return getAnalyticsDashboardFn(data);
}

// ── Server fn ─────────────────────────────────────────────────────────────────

export const getAnalyticsDashboardServerFn = createServerFn({ method: "POST" })
	.inputValidator((data: AnalyticsQueryInput) =>
		dashboardInputSchema.parse(data),
	)
	.handler(({ data }) => getAnalyticsDashboardHandler(data));
