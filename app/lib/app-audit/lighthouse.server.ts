import "@tanstack/react-start/server-only";
import { createRequire } from "node:module";
import { chromium } from "@playwright/test";
import type { AppAuditFinding } from "#/lib/app-audit/browser-sweep.server";

const _require = createRequire(import.meta.url);

export type LighthouseScores = {
	performance: number;
	accessibility: number;
	bestPractices: number;
	seo: number;
};

type LHRCategory = { score: number | null };
type LHR = {
	categories: {
		performance?: LHRCategory;
		accessibility?: LHRCategory;
		"best-practices"?: LHRCategory;
		seo?: LHRCategory;
	};
};

const DEFAULT_LIGHTHOUSE_TIMEOUT_MS = 30_000;

function getLighthouseTimeoutMs(): number {
	const raw = process.env.APP_AUDIT_LIGHTHOUSE_TIMEOUT_MS;
	if (!raw) return DEFAULT_LIGHTHOUSE_TIMEOUT_MS;
	const parsed = parseInt(raw, 10);
	return Number.isFinite(parsed) && parsed > 0
		? parsed
		: DEFAULT_LIGHTHOUSE_TIMEOUT_MS;
}

function lighthouseTimeout(ms: number): Promise<never> {
	return new Promise((_, reject) =>
		setTimeout(
			() => reject(new Error(`Lighthouse timed out after ${ms}ms`)),
			ms,
		),
	);
}

function getScore(cat: LHRCategory | undefined): number {
	return cat?.score ?? 0;
}

type LighthouseRunner = {
	run(
		url: string,
		options: { chromePath?: string; settings?: { chromeFlags?: string } },
	): Promise<string>;
};

export function createLighthouseRunner(): LighthouseRunner {
	// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access
	return new (
		_require("@lhci/cli/src/collect/node-runner.js")
			.LighthouseRunner as new () => LighthouseRunner
	)();
}

export async function runLighthouse(
	url: string,
	runnerOverride?: LighthouseRunner,
): Promise<LighthouseScores> {
	const chromePath = chromium.executablePath();
	const runner = runnerOverride ?? createLighthouseRunner();
	const timeoutMs = getLighthouseTimeoutMs();
	const lhrJson = await Promise.race([
		runner.run(url, {
			chromePath,
			settings: { chromeFlags: "--headless=new --no-sandbox" },
		}),
		lighthouseTimeout(timeoutMs),
	]);
	const lhr = JSON.parse(lhrJson) as LHR;
	return {
		performance: getScore(lhr.categories.performance),
		accessibility: getScore(lhr.categories.accessibility),
		bestPractices: getScore(lhr.categories["best-practices"]),
		seo: getScore(lhr.categories.seo),
	};
}

export function lighthouseToFindings(
	scores: LighthouseScores,
	url: string,
): AppAuditFinding[] {
	const findings: AppAuditFinding[] = [];

	if (scores.performance < 0.8) {
		findings.push({
			category: "perf-budget-breach",
			severity: "minor",
			filePath: url,
			message: `Performance score ${Math.round(scores.performance * 100)} below threshold (80)`,
			detail: { score: scores.performance },
		});
	}

	if (scores.seo < 0.9) {
		findings.push({
			category: "seo-score-drop",
			severity: "minor",
			filePath: url,
			message: `SEO score ${Math.round(scores.seo * 100)} below threshold (90)`,
			detail: { score: scores.seo },
		});
	}

	if (scores.bestPractices < 0.9) {
		findings.push({
			category: "best-practices-fail",
			severity: "minor",
			filePath: url,
			message: `Best practices score ${Math.round(scores.bestPractices * 100)} below threshold (90)`,
			detail: { score: scores.bestPractices },
		});
	}

	return findings;
}
