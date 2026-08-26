import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";
import {
	createLighthouseRunner,
	lighthouseToFindings,
	runLighthouse,
} from "#/lib/app-audit/lighthouse.server";

// ──────────────────────────────────────────────────────────────────────────────
// Mock @playwright/test to control chromium.executablePath() return value
// ──────────────────────────────────────────────────────────────────────────────

mock.module("@playwright/test", () => ({
	chromium: {
		executablePath: jest.fn(() => "/mocked/chromium"),
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
	const run = jest.fn(
		async (
			_url: string,
			_opts: { chromePath?: string; settings?: { chromeFlags?: string } },
		) => lhrJson,
	);
	return { run };
}

// ──────────────────────────────────────────────────────────────────────────────
// createLighthouseRunner — import sanity (issue 001)
// ──────────────────────────────────────────────────────────────────────────────

describe("createLighthouseRunner", () => {
	test("returns object with run method (module.exports is class, not {LighthouseRunner})", () => {
		const runner = createLighthouseRunner();
		expect(runner).toBeDefined();
		expect(typeof runner.run).toBe("function");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// lighthouseToFindings — pure classifier (no mocks needed)
// ──────────────────────────────────────────────────────────────────────────────

describe("lighthouseToFindings", () => {
	test("perf=0.75 → perf-budget-breach minor finding", () => {
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

	test("perf=0.85 → no perf-budget-breach finding", () => {
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

	test("perf exactly at threshold 0.8 → no finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.8, accessibility: 0.95, bestPractices: 0.95, seo: 0.95 },
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "perf-budget-breach"),
		).toHaveLength(0);
	});

	test("seo=0.85 → seo-score-drop minor finding", () => {
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

	test("seo=0.9 → no seo-score-drop finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.9, accessibility: 0.95, bestPractices: 0.95, seo: 0.9 },
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "seo-score-drop"),
		).toHaveLength(0);
	});

	test("bestPractices=0.85 → best-practices-fail minor finding", () => {
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

	test("bestPractices=0.9 → no best-practices-fail finding", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.9, accessibility: 0.95, bestPractices: 0.9, seo: 0.95 },
			"http://localhost:4173/",
		);
		expect(
			findings.filter((f) => f.category === "best-practices-fail"),
		).toHaveLength(0);
	});

	test("all scores below threshold → three findings", () => {
		const findings = lighthouseToFindings(
			{ performance: 0.7, accessibility: 0.8, bestPractices: 0.7, seo: 0.8 },
			"http://localhost:4173/",
		);
		expect(findings).toHaveLength(3);
	});

	test("all scores above threshold → no findings", () => {
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

	test("finding detail includes numeric score", () => {
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

	test("finding filePath is the url argument", () => {
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
	test("passes chromePath from chromium.executablePath() to the runner", async () => {
		const { chromium } = await import("@playwright/test");
		const runner = mockRunner(makeLHR({}));

		await runLighthouse("http://localhost:4173/", runner);

		expect(chromium.executablePath).toHaveBeenCalled();
		expect(runner.run).toHaveBeenCalledWith(
			"http://localhost:4173/",
			expect.objectContaining({ chromePath: "/mocked/chromium" }),
		);
	});

	test("returns LighthouseScores with all 4 fields in [0, 1] range", async () => {
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

	test("maps LHR categories correctly including best-practices hyphen key", async () => {
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

	test("returns 0 for missing LHR category score", async () => {
		const runner = mockRunner(
			JSON.stringify({ lighthouseVersion: "11.0.0", categories: {} }),
		);
		const scores = await runLighthouse("http://localhost:4173/", runner);

		expect(scores.performance).toBe(0);
		expect(scores.seo).toBe(0);
	});

	test("chromePath argument equals chromium.executablePath() output", async () => {
		const runner = mockRunner(makeLHR({}));
		await runLighthouse("http://localhost:4173/", runner);
		const [, opts] = runner.run.mock.calls[0];
		expect(opts?.chromePath).toBe("/mocked/chromium");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// runLighthouse — timeout (issue 006)
// ──────────────────────────────────────────────────────────────────────────────

describe("runLighthouse — timeout", () => {
	beforeEach(() => {
		jest.useFakeTimers();
	});

	afterEach(() => {
		jest.useRealTimers();
		delete process.env.APP_AUDIT_LIGHTHOUSE_TIMEOUT_MS;
	});

	test("rejects with timeout error when runner hangs longer than default 30s", async () => {
		const hangingRunner = {
			run: jest.fn(() => new Promise<string>(() => {})),
		};

		const promise = runLighthouse("http://localhost:4173/", hangingRunner);
		jest.advanceTimersByTime(30_001);

		await expect(promise).rejects.toThrow(/timed out after 30000ms/);
	});

	test("respects APP_AUDIT_LIGHTHOUSE_TIMEOUT_MS env var", async () => {
		process.env.APP_AUDIT_LIGHTHOUSE_TIMEOUT_MS = "5000";

		const hangingRunner = {
			run: jest.fn(() => new Promise<string>(() => {})),
		};

		const promise = runLighthouse("http://localhost:4173/", hangingRunner);
		jest.advanceTimersByTime(5_001);

		await expect(promise).rejects.toThrow(/timed out after 5000ms/);
	});

	test("resolves normally when runner completes before timeout", async () => {
		const fastRunner = mockRunner(makeLHR({ performance: 0.9, seo: 0.95 }));

		const promise = runLighthouse("http://localhost:4173/", fastRunner);
		// Advance time less than 30s — runner already resolved synchronously via mock
		jest.advanceTimersByTime(100);

		const scores = await promise;
		expect(scores.performance).toBe(0.9);
	});
});
