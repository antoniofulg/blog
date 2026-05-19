import { describe, expect, it, vi } from "vitest";
import {
	lighthouseToFindings,
	runLighthouse,
} from "#/lib/app-audit/lighthouse.server";

// ──────────────────────────────────────────────────────────────────────────────
// Mock @playwright/test to control chromium.executablePath() return value
// ──────────────────────────────────────────────────────────────────────────────

vi.mock("@playwright/test", () => ({
	chromium: {
		executablePath: vi.fn(() => "/mocked/chromium"),
	},
}));

// ──────────────────────────────────────────────────────────────────────────────
// LHR builder
// ──────────────────────────────────────────────────────────────────────────────

function makeLHR(scores: {
	performance?: number;
	accessibility?: number;
	bestPractices?: number;
	seo?: number;
}): string {
	return JSON.stringify({
		lighthouseVersion: "11.0.0",
		categories: {
			performance: { score: scores.performance ?? 0.9 },
			accessibility: { score: scores.accessibility ?? 0.9 },
			"best-practices": { score: scores.bestPractices ?? 0.95 },
			seo: { score: scores.seo ?? 0.95 },
		},
	});
}

function mockRunner(lhrJson: string) {
	const run = vi.fn(
		async (
			_url: string,
			_opts: { chromePath?: string; settings?: { chromeFlags?: string } },
		) => lhrJson,
	);
	return { run };
}

// ──────────────────────────────────────────────────────────────────────────────
// lighthouseToFindings — pure classifier (no mocks needed)
// ──────────────────────────────────────────────────────────────────────────────

describe("lighthouseToFindings", () => {
	it("perf=0.75 → perf-budget-breach minor finding", () => {
		const findings = lighthouseToFindings(
			{
				performance: 0.75,
				accessibility: 0.95,
				bestPractices: 0.95,
				seo: 0.95,
			},
			"http://localhost:4173/",
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "perf-budget-breach",
			severity: "minor",
		});
	});

	it("perf=0.85 → no perf-budget-breach finding", () => {
		const findings = lighthouseToFindings(
			{
				performance: 0.85,
				accessibility: 0.95,
				bestPractices: 0.95,
				seo: 0.95,
			},
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "perf-budget-breach"),
		).toHaveLength(0);
	});

	it("perf exactly at threshold 0.8 → no finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.8, accessibility: 0.95, bestPractices: 0.95, seo: 0.95 },
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "perf-budget-breach"),
		).toHaveLength(0);
	});

	it("seo=0.85 → seo-score-drop minor finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.9, accessibility: 0.95, bestPractices: 0.95, seo: 0.85 },
			"http://localhost:4173/",
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "seo-score-drop",
			severity: "minor",
		});
	});

	it("seo=0.9 → no seo-score-drop finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.9, accessibility: 0.95, bestPractices: 0.95, seo: 0.9 },
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "seo-score-drop"),
		).toHaveLength(0);
	});

	it("bestPractices=0.85 → best-practices-fail minor finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.9, accessibility: 0.95, bestPractices: 0.85, seo: 0.95 },
			"http://localhost:4173/",
		);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "best-practices-fail",
			severity: "minor",
		});
	});

	it("bestPractices=0.9 → no best-practices-fail finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.9, accessibility: 0.95, bestPractices: 0.9, seo: 0.95 },
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "best-practices-fail"),
		).toHaveLength(0);
	});

	it("all scores below threshold → three findings", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.7, accessibility: 0.8, bestPractices: 0.7, seo: 0.8 },
			"http://localhost:4173/",
		);
		expect(findings).toHaveLength(3);
	});

	it("all scores above threshold → no findings", () => {
		const findings = lighthouseToFindings(
			{
				performance: 0.95,
				accessibility: 0.99,
				bestPractices: 0.98,
				seo: 0.98,
			},
			"http://localhost:4173/",
		);
		expect(findings).toHaveLength(0);
	});

	it("finding detail includes numeric score", () => {
		const findings = lighthouseToFindings(
			{
				performance: 0.75,
				accessibility: 0.95,
				bestPractices: 0.95,
				seo: 0.95,
			},
			"http://localhost:4173/",
		);
		expect(findings[0].detail?.score).toBe(0.75);
	});

	it("finding filePath is the url argument", () => {
		const url = "http://localhost:4173/about";
		const findings = lighthouseToFindings(
			{
				performance: 0.75,
				accessibility: 0.95,
				bestPractices: 0.95,
				seo: 0.95,
			},
			url,
		);
		expect(findings[0].filePath).toBe(url);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// runLighthouse — uses Playwright chromium.executablePath()
// ──────────────────────────────────────────────────────────────────────────────

describe("runLighthouse", () => {
	it("passes chromePath from chromium.executablePath() to the runner", async () => {
		const { chromium } = await import("@playwright/test");
		const runner = mockRunner(makeLHR({}));

		await runLighthouse("http://localhost:4173/", runner);

		expect(chromium.executablePath).toHaveBeenCalled();
		expect(runner.run).toHaveBeenCalledWith(
			"http://localhost:4173/",
			expect.objectContaining({ chromePath: "/mocked/chromium" }),
		);
	});

	it("returns LighthouseScores with all 4 fields in [0, 1] range", async () => {
		const runner = mockRunner(
			makeLHR({
				performance: 0.82,
				accessibility: 0.91,
				bestPractices: 0.95,
				seo: 0.93,
			}),
		);
		const scores = await runLighthouse("http://localhost:4173/", runner);

		expect(scores.performance).toBeGreaterThanOrEqual(0);
		expect(scores.performance).toBeLessThanOrEqual(1);
		expect(scores.accessibility).toBeGreaterThanOrEqual(0);
		expect(scores.accessibility).toBeLessThanOrEqual(1);
		expect(scores.bestPractices).toBeGreaterThanOrEqual(0);
		expect(scores.bestPractices).toBeLessThanOrEqual(1);
		expect(scores.seo).toBeGreaterThanOrEqual(0);
		expect(scores.seo).toBeLessThanOrEqual(1);
	});

	it("maps LHR categories correctly including best-practices hyphen key", async () => {
		const runner = mockRunner(
			makeLHR({
				performance: 0.82,
				accessibility: 0.91,
				bestPractices: 0.88,
				seo: 0.93,
			}),
		);
		const scores = await runLighthouse("http://localhost:4173/", runner);

		expect(scores.performance).toBe(0.82);
		expect(scores.accessibility).toBe(0.91);
		expect(scores.bestPractices).toBe(0.88);
		expect(scores.seo).toBe(0.93);
	});

	it("returns 0 for missing LHR category score", async () => {
		const runner = mockRunner(
			JSON.stringify({ lighthouseVersion: "11.0.0", categories: {} }),
		);
		const scores = await runLighthouse("http://localhost:4173/", runner);

		expect(scores.performance).toBe(0);
		expect(scores.seo).toBe(0);
	});

	it("chromePath argument equals chromium.executablePath() output", async () => {
		const runner = mockRunner(makeLHR({}));
		await runLighthouse("http://localhost:4173/", runner);
		const [, opts] = runner.run.mock.calls[0];
		expect(opts?.chromePath).toBe("/mocked/chromium");
	});
});
