/**
 * A11y integration tests for the analytics dashboard (task_19).
 *
 * Uses @axe-core/playwright to run axe-core against the /admin/analytics route.
 * AC-7: zero serious or critical violations at both desktop and 360 × 640 viewports.
 *
 * Tagged @admin @smoke — runs in the main CI E2E gate.
 * Requires the authedPage fixture (storageState: tests/e2e/.auth/admin.json).
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures/auth";

test.describe(
	"analytics dashboard a11y",
	{ tag: ["@admin", "@smoke"] },
	() => {
		test(
			"desktop viewport (1280 × 800): zero serious/critical axe violations",
			async ({ authedPage }) => {
				await authedPage.setViewportSize({ width: 1280, height: 800 });
				await authedPage.goto("/admin/analytics");
				await authedPage.waitForLoadState("load");

				const results = await new AxeBuilder({ page: authedPage })
					.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
					.analyze();

				const seriousOrCritical = results.violations.filter(
					(v) => v.impact === "serious" || v.impact === "critical",
				);

				if (seriousOrCritical.length > 0) {
					const summary = seriousOrCritical.map((v) =>
						[
							`[${v.impact}] ${v.id}: ${v.description}`,
							...v.nodes.slice(0, 3).map((n) => `  → ${n.html}`),
						].join("\n"),
					);
					throw new Error(
						`Found ${seriousOrCritical.length} serious/critical a11y violation(s):\n\n${summary.join("\n\n")}`,
					);
				}

				expect(seriousOrCritical).toHaveLength(0);
			},
		);

		test(
			"mobile viewport (360 × 640): zero serious/critical axe violations",
			async ({ authedPage }) => {
				await authedPage.setViewportSize({ width: 360, height: 640 });
				await authedPage.goto("/admin/analytics");
				await authedPage.waitForLoadState("load");

				const results = await new AxeBuilder({ page: authedPage })
					.withTags(["wcag2a", "wcag2aa", "wcag22aa"])
					.analyze();

				const seriousOrCritical = results.violations.filter(
					(v) => v.impact === "serious" || v.impact === "critical",
				);

				if (seriousOrCritical.length > 0) {
					const summary = seriousOrCritical.map((v) =>
						[
							`[${v.impact}] ${v.id}: ${v.description}`,
							...v.nodes.slice(0, 3).map((n) => `  → ${n.html}`),
						].join("\n"),
					);
					throw new Error(
						`Found ${seriousOrCritical.length} serious/critical a11y violation(s) at 360×640:\n\n${summary.join("\n\n")}`,
					);
				}

				expect(seriousOrCritical).toHaveLength(0);
			},
		);

		test(
			"mobile viewport (360 × 640): no horizontal page scroll (AC-1)",
			async ({ authedPage }) => {
				await authedPage.setViewportSize({ width: 360, height: 640 });
				await authedPage.goto("/admin/analytics");
				await authedPage.waitForLoadState("load");

				// scrollWidth > clientWidth on document.documentElement indicates page-level overflow.
				const hasHorizontalScroll = await authedPage.evaluate(
					() =>
						document.documentElement.scrollWidth >
						document.documentElement.clientWidth,
				);

				expect(hasHorizontalScroll).toBe(false);
			},
		);
	},
);
