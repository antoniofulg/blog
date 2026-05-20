import "@tanstack/react-start/server-only";
import type { Page } from "@playwright/test";
import type { Severity } from "#/lib/content-audit/checks.server";
import type { RouteEntry } from "#/lib/site-model.server";

export type AppAuditCategory =
	| "console-error"
	| "hydration-mismatch"
	| "network-fail"
	| "broken-image"
	| "missing-meta"
	| "mixed-content"
	| "slow-response"
	| "a11y-violation"
	| "seo-score-drop"
	| "perf-budget-breach"
	| "best-practices-fail"
	| "sweep-error";

export type AppAuditFinding = {
	category: AppAuditCategory;
	severity: Severity;
	filePath: string;
	message: string;
	detail?: Record<string, string | number>;
};

export type BrowserSweepResult = {
	route: RouteEntry;
	consoleErrors: string[];
	failedRequests: { url: string; status: number; reason: string }[];
	hydrationMismatch: boolean;
	metaPresent: Record<string, boolean>;
	brokenImages: string[];
	mixedContent: boolean;
	firstPaintMs: number;
};

const HYDRATION_PATTERNS = [
	"hydration failed",
	"did not match",
	"Text content does not match",
];

const SLOW_RESPONSE_THRESHOLD_MS = 1500;

export function classifyNetworkStatus(
	status: number,
): "blocker" | "major" | null {
	if (status === 0 || status >= 500) return "blocker";
	if (status >= 400) return "major";
	return null;
}

export function isHydrationMismatch(text: string): boolean {
	return HYDRATION_PATTERNS.some((p) => text.includes(p));
}

export function isMixedContent(text: string): boolean {
	return text.includes("Mixed Content");
}

async function probe(
	page: Page,
	route: RouteEntry,
): Promise<BrowserSweepResult> {
	const consoleErrors: string[] = [];
	const failedRequests: { url: string; status: number; reason: string }[] = [];
	let mixedContent = false;
	let hydrationMismatch = false;

	page.on("console", (msg) => {
		if (msg.type() !== "error") return;
		const text = msg.text();
		if (isMixedContent(text)) {
			mixedContent = true;
		} else if (isHydrationMismatch(text)) {
			hydrationMismatch = true;
		} else {
			consoleErrors.push(text);
		}
	});

	page.on("requestfailed", (request) => {
		const failure = request.failure();
		failedRequests.push({
			url: request.url(),
			status: 0,
			reason: failure?.errorText ?? "network error",
		});
	});

	page.on("response", (response) => {
		const status = response.status();
		if (status >= 400) {
			failedRequests.push({
				url: response.url(),
				status,
				reason: `HTTP ${status}`,
			});
		}
	});

	await page.goto(route.path, { waitUntil: "networkidle" });

	const metaPresent: Record<string, boolean> = {};

	const title = await page
		.locator("title")
		.textContent()
		.catch(() => null);
	metaPresent["title"] = !!(title && title.trim());

	const desc = await page
		.locator('meta[name="description"]')
		.getAttribute("content")
		.catch(() => null);
	metaPresent["description"] = !!(desc && desc.trim());

	const ogTitle = await page
		.locator('meta[property="og:title"]')
		.getAttribute("content")
		.catch(() => null);
	metaPresent["og:title"] = !!(ogTitle && ogTitle.trim());

	const ogImage = await page
		.locator('meta[property="og:image"]')
		.getAttribute("content")
		.catch(() => null);
	metaPresent["og:image"] = !!(ogImage && ogImage.trim());

	const canonical = await page
		.locator('link[rel="canonical"]')
		.getAttribute("href")
		.catch(() => null);
	metaPresent["canonical"] = !!(canonical && canonical.trim());

	const viewport = await page
		.locator('meta[name="viewport"]')
		.getAttribute("content")
		.catch(() => null);
	metaPresent["viewport"] = !!(viewport && viewport.trim());

	const brokenImages = await page
		.locator("img")
		.evaluateAll((imgs) =>
			(imgs as HTMLImageElement[])
				.filter((img) => img.complete && img.naturalWidth === 0)
				.map((img) => img.src),
		);

	const firstPaintMs = await page
		.evaluate(() => {
			const entries = performance.getEntriesByType("paint");
			const fp = entries.find((e) => e.name === "first-paint");
			if (fp) return fp.startTime;
			if (performance.timing) {
				return (
					performance.timing.responseEnd - performance.timing.navigationStart
				);
			}
			return 0;
		})
		.catch(() => 0);

	return {
		route,
		consoleErrors,
		failedRequests,
		hydrationMismatch,
		metaPresent,
		brokenImages,
		mixedContent,
		firstPaintMs,
	};
}

function toFindings(result: BrowserSweepResult): AppAuditFinding[] {
	const findings: AppAuditFinding[] = [];

	for (const msg of result.consoleErrors) {
		findings.push({
			category: "console-error",
			severity: "blocker",
			filePath: result.route.path,
			message: `Console error: ${msg}`,
		});
	}

	if (result.hydrationMismatch) {
		findings.push({
			category: "hydration-mismatch",
			severity: "blocker",
			filePath: result.route.path,
			message: "Hydration mismatch detected",
		});
	}

	for (const req of result.failedRequests) {
		const severity = classifyNetworkStatus(req.status);
		if (!severity) continue;
		findings.push({
			category: "network-fail",
			severity,
			filePath: result.route.path,
			message: `Failed request: ${req.url} (${req.reason})`,
			detail: { url: req.url, status: req.status },
		});
	}

	for (const src of result.brokenImages) {
		findings.push({
			category: "broken-image",
			severity: "major",
			filePath: result.route.path,
			message: `Broken image: ${src}`,
			detail: { src },
		});
	}

	for (const [key, present] of Object.entries(result.metaPresent)) {
		if (!present) {
			findings.push({
				category: "missing-meta",
				severity: "major",
				filePath: result.route.path,
				message: `Missing meta tag: ${key}`,
				detail: { tag: key },
			});
		}
	}

	if (result.mixedContent) {
		findings.push({
			category: "mixed-content",
			severity: "major",
			filePath: result.route.path,
			message: "Mixed content detected (HTTP resources on HTTPS page)",
		});
	}

	if (result.firstPaintMs > SLOW_RESPONSE_THRESHOLD_MS) {
		findings.push({
			category: "slow-response",
			severity: "minor",
			filePath: result.route.path,
			message: `Slow first paint: ${result.firstPaintMs}ms (threshold: ${SLOW_RESPONSE_THRESHOLD_MS}ms)`,
			detail: { firstPaintMs: result.firstPaintMs },
		});
	}

	return findings;
}

export async function sweepRoute(
	page: Page,
	route: RouteEntry,
): Promise<AppAuditFinding[]> {
	try {
		const result = await probe(page, route);
		return toFindings(result);
	} catch (err) {
		return [
			{
				category: "sweep-error",
				severity: "major",
				filePath: route.path,
				message: err instanceof Error ? err.message : String(err),
				detail: {
					stack: err instanceof Error ? (err.stack ?? "") : "",
				},
			},
		];
	}
}
