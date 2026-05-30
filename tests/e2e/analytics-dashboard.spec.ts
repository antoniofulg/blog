/**
 * E2E spec: analytics dashboard filter-cascade user journey (task_20).
 *
 * Covers four scenarios:
 *   1. Default load — page heading, 4 summary cards, and 4 chart widgets visible.
 *   2. Range switch — selecting "Last 90 days" updates URL to ?range=90d.
 *   3. Row click — clicking a top-N posts row sets ?postId=<id> and shows filter chip.
 *   4. Chip clear — clicking the chip X removes postId while preserving range=90d.
 *
 * Tagged @admin @smoke — runs in the CI E2E gate.
 * Axe-core a11y checks are covered by analytics-a11y.spec.ts (task_19).
 *
 * Fixture data: global-setup.ts seeds 15 analytics events for 2 posts across
 * 14 days via seedAnalyticsEvents() so every scenario has data to display.
 */
import { readFile } from "node:fs/promises";
import { expect, test } from "./fixtures/auth";
import { E2E_STATE_FILE } from "./global-setup";
import type { E2EState } from "./global-setup";

// ── State helper (same pattern as admin-write.spec.ts) ────────────────────────

let cachedState: E2EState | undefined;

async function getState(): Promise<E2EState> {
	if (!cachedState) {
		const raw = await readFile(E2E_STATE_FILE, "utf-8");
		cachedState = JSON.parse(raw) as E2EState;
	}
	return cachedState;
}

// ── Spec ──────────────────────────────────────────────────────────────────────

test.describe("analytics dashboard", { tag: ["@admin", "@smoke"] }, () => {
	// ── Scenario 1: Default load ─────────────────────────────────────────────

	test(
		"default load: page heading, 4 summary cards, and 4 chart widgets visible",
		async ({ authedPage }) => {
			await authedPage.goto("/admin/analytics");
			await authedPage.waitForLoadState("load");

			// Page heading (AC-2)
			await expect(
				authedPage.getByRole("heading", { name: "Analytics" }),
			).toBeVisible();

			// 4 summary card labels — each card renders its label in a <span>
			await expect(authedPage.getByText("Total Visits")).toBeVisible();
			await expect(authedPage.getByText("Unique Posts")).toBeVisible();
			await expect(authedPage.getByText("Top Referrer")).toBeVisible();
			await expect(authedPage.getByText("Top Language")).toBeVisible();

			// 4 chart widgets — each is <section aria-label="…"> → role="region"
			// (AC-2: 5 widgets = SummaryCards area + 4 chart regions)
			await expect(
				authedPage.getByRole("region", { name: "Daily Trend" }),
			).toBeVisible();
			await expect(
				authedPage.getByRole("region", { name: "Referrer Sources" }),
			).toBeVisible();
			await expect(
				authedPage.getByRole("region", { name: "Top Posts" }),
			).toBeVisible();
			await expect(
				authedPage.getByRole("region", { name: "Device Split" }),
			).toBeVisible();
			await expect(
				authedPage.getByRole("region", { name: "Language Split" }),
			).toBeVisible();

			// Default URL has no postId (no active filter)
			const url = new URL(authedPage.url());
			expect(url.searchParams.has("postId")).toBe(false);
		},
	);

	// ── Scenario 2: Range switch ─────────────────────────────────────────────

	test(
		"range switch: selecting Last 90 days updates URL to ?range=90d",
		async ({ authedPage }) => {
			await authedPage.goto("/admin/analytics");
			await authedPage.waitForLoadState("load");

			// Range selector trigger shows the current selection ("Last 30 days").
			// aria-hidden="true" on the chevron span excludes it from accessible name.
			await authedPage.getByRole("button", { name: "Last 30 days" }).click();

			// Dropdown listbox must appear
			await expect(authedPage.getByRole("listbox")).toBeVisible();

			// Click the "Last 90 days" option (AC-3)
			await authedPage.getByRole("option", { name: "Last 90 days" }).click();

			// URL must update to include range=90d (AC-3)
			await authedPage.waitForURL(
				(url) => url.searchParams.get("range") === "90d",
			);

			expect(new URL(authedPage.url()).searchParams.get("range")).toBe("90d");
		},
	);

	// ── Scenario 3: Row click ────────────────────────────────────────────────

	test(
		"row click: clicking a top-N posts row sets postId in URL and shows filter chip",
		async ({ authedPage }) => {
			const state = await getState();

			// Start at 90d range directly — each test is independent (AC-4)
			await authedPage.goto("/admin/analytics?range=90d");
			await authedPage.waitForLoadState("load");

			// Wait for the Top Posts widget to be visible
			const topPostsRegion = authedPage.getByRole("region", {
				name: "Top Posts",
			});
			await expect(topPostsRegion).toBeVisible();

			// The fixture post has seeded events and must appear as a clickable row.
			// TopPostsTable renders <tr role="button"> — accessible name includes title text.
			const postRow = topPostsRegion.getByRole("button", {
				name: new RegExp(state.fixturePostTitle, "i"),
			});
			await expect(postRow).toBeVisible();
			await postRow.click();

			// URL must include postId=<fixturePostId> (AC-4)
			await authedPage.waitForURL(
				(url) =>
					url.searchParams.get("postId") === String(state.fixturePostId),
			);

			const url = new URL(authedPage.url());
			expect(url.searchParams.get("range")).toBe("90d");
			expect(url.searchParams.get("postId")).toBe(String(state.fixturePostId));

			// Filter chip must be visible — its X button has aria-label="Clear filter"
			await expect(
				authedPage.getByRole("button", { name: "Clear filter" }),
			).toBeVisible();
		},
	);

	// ── Scenario 4: Chip clear ───────────────────────────────────────────────

	test(
		"chip clear: clicking X removes postId from URL while preserving range=90d",
		async ({ authedPage }) => {
			const state = await getState();

			// Pre-navigate with both params so the filter chip is rendered immediately
			await authedPage.goto(
				`/admin/analytics?range=90d&postId=${state.fixturePostId}`,
			);
			await authedPage.waitForLoadState("load");

			// Filter chip X button must be visible before clearing (AC-5)
			const clearBtn = authedPage.getByRole("button", { name: "Clear filter" });
			await expect(clearBtn).toBeVisible();

			// Click the X (AC-5)
			await clearBtn.click();

			// URL must drop postId while keeping range=90d (AC-5)
			await authedPage.waitForURL(
				(url) =>
					!url.searchParams.has("postId") &&
					url.searchParams.get("range") === "90d",
			);

			// Filter chip must be gone from the DOM
			await expect(
				authedPage.getByRole("button", { name: "Clear filter" }),
			).not.toBeVisible();
		},
	);
});
