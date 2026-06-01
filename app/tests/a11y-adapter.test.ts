import type { Page } from "@playwright/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyzeA11y } from "#/lib/app-audit/a11y-adapter.server";

// ──────────────────────────────────────────────────────────────────────────────
// AxeBuilder mock
// ──────────────────────────────────────────────────────────────────────────────

vi.mock("@axe-core/playwright", () => {
	class AxeBuilder {
		withTags(_tags: string[]) {
			return this;
		}

		async analyze() {
			if (axeError) throw axeError;
			return axeResults;
		}
	}
	return { AxeBuilder };
});

let axeError: Error | null = null;

let axeResults = {
	violations: [] as Array<{
		id: string;
		impact: string | null;
		description: string;
		helpUrl: string;
		nodes: unknown[];
		tags: string[];
	}>,
};

function makeViolation(
	id: string,
	tags: string[],
	impact: string | null = "serious",
) {
	return {
		id,
		impact,
		description: `Violation: ${id}`,
		helpUrl: `https://dequeuniversity.com/rules/axe/4.0/${id}`,
		nodes: [{}],
		tags,
	};
}

function createMockPage(): Page {
	return { url: vi.fn(() => "http://localhost:4173/") } as unknown as Page;
}

// ──────────────────────────────────────────────────────────────────────────────
// Tests
// ──────────────────────────────────────────────────────────────────────────────

describe("analyzeA11y", () => {
	beforeEach(() => {
		axeError = null;
	});

	it("returns empty array when no violations", async () => {
		axeResults = { violations: [] };
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings).toHaveLength(0);
	});

	it("maps violation to a11y-violation finding with major severity", async () => {
		axeResults = {
			violations: [makeViolation("image-alt", ["wcag2a", "wcag2aa"])],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "a11y-violation",
			severity: "major",
		});
	});

	it("violation with WCAG2AA tag returns finding", async () => {
		axeResults = {
			violations: [makeViolation("color-contrast", ["wcag2aa"])],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings).toHaveLength(1);
		expect(findings[0].category).toBe("a11y-violation");
	});

	it("uses page.url() as filePath", async () => {
		axeResults = {
			violations: [makeViolation("label", ["wcag2a"])],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings[0].filePath).toBe("http://localhost:4173/");
	});

	it("finding message includes violation id and description", async () => {
		axeResults = {
			violations: [makeViolation("image-alt", ["wcag2a"])],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings[0].message).toContain("image-alt");
		expect(findings[0].message).toContain("Violation: image-alt");
	});

	it("detail includes impact, helpUrl, and nodes count", async () => {
		const violation = makeViolation(
			"aria-required-attr",
			["wcag2a", "wcag22aa"],
			"critical",
		);
		violation.nodes = [{}, {}];
		axeResults = { violations: [violation] };
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings[0].detail).toMatchObject({
			impact: "critical",
			helpUrl: expect.stringContaining("dequeuniversity"),
			nodes: 2,
		});
	});

	it("null impact is represented as 'unknown'", async () => {
		axeResults = {
			violations: [makeViolation("some-rule", ["wcag2a"], null)],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings[0].detail?.impact).toBe("unknown");
	});

	it("multiple violations produce one finding each", async () => {
		axeResults = {
			violations: [
				makeViolation("image-alt", ["wcag2a"]),
				makeViolation("color-contrast", ["wcag2aa"]),
				makeViolation("label", ["wcag2a", "wcag22aa"]),
			],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings).toHaveLength(3);
		expect(findings.every((f) => f.category === "a11y-violation")).toBe(true);
	});

	it("all findings have major severity regardless of axe impact level", async () => {
		axeResults = {
			violations: [
				makeViolation("rule-critical", ["wcag2a"], "critical"),
				makeViolation("rule-serious", ["wcag2aa"], "serious"),
				makeViolation("rule-moderate", ["wcag22aa"], "moderate"),
			],
		};
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings.every((f) => f.severity === "major")).toBe(true);
	});

	// ─── error containment (issue 002) ────────────────────────────────────────

	it("analyze() throw → single sweep-error finding returned instead of throw", async () => {
		axeError = new Error("page crashed mid-analysis");
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "sweep-error",
			severity: "major",
		});
		expect(findings[0].message).toContain("page crashed mid-analysis");
	});

	it("analyze() throw → filePath is page.url()", async () => {
		axeError = new Error("axe injection failed");
		const page = createMockPage();
		const findings = await analyzeA11y(page);
		expect(findings[0].filePath).toBe("http://localhost:4173/");
	});

	it("analyze() throw does not propagate; caller gets array not rejection", async () => {
		axeError = new Error("devtools protocol error");
		const page = createMockPage();
		await expect(analyzeA11y(page)).resolves.toHaveLength(1);
	});

	it("page.url() throws (page closed) AND analyze() throws → sweep-error with filePath 'unknown'", async () => {
		axeError = new Error("Target closed");
		const closedPage = {
			url: vi.fn(() => {
				throw new Error("Target closed");
			}),
		} as unknown as Page;
		const findings = await analyzeA11y(closedPage);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "sweep-error",
			severity: "major",
			filePath: "unknown",
		});
	});

	it("page.url() throws before analyze succeeds → violations use filePath 'unknown'", async () => {
		axeError = null;
		axeResults = {
			violations: [makeViolation("image-alt", ["wcag2a"])],
		};
		const closedPage = {
			url: vi.fn(() => {
				throw new Error("Target closed");
			}),
		} as unknown as Page;
		const findings = await analyzeA11y(closedPage);
		expect(findings).toHaveLength(1);
		expect(findings[0].filePath).toBe("unknown");
	});
});
