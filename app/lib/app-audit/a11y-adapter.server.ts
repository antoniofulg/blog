import "@tanstack/react-start/server-only";
import { AxeBuilder } from "@axe-core/playwright";
import type { Page } from "@playwright/test";
import type { AppAuditFinding } from "#/lib/app-audit/browser-sweep.server";

const A11Y_TAGS = ["wcag2a", "wcag2aa", "wcag22aa"] as const;

async function safePageUrl(page: Page): Promise<string> {
	try {
		return page.url();
	} catch {
		return "unknown";
	}
}

export async function analyzeA11y(page: Page): Promise<AppAuditFinding[]> {
	const filePath = await safePageUrl(page);
	try {
		const results = await new AxeBuilder({ page })
			.withTags([...A11Y_TAGS])
			.analyze();

		return results.violations.map((violation) => ({
			category: "a11y-violation" as const,
			severity: "major" as const,
			filePath,
			message: `${violation.id}: ${violation.description}`,
			detail: {
				impact: violation.impact ?? "unknown",
				helpUrl: violation.helpUrl,
				nodes: violation.nodes.length,
			},
		}));
	} catch (err) {
		return [
			{
				category: "sweep-error" as const,
				severity: "major" as const,
				filePath,
				message: `Axe analysis failed: ${err instanceof Error ? err.message : String(err)}`,
			},
		];
	}
}
