import type { Page } from "@playwright/test";
import { describe, expect, it, vi } from "vitest";
import {
	classifyNetworkStatus,
	isHydrationMismatch,
	isMixedContent,
	sweepRoute,
} from "#/lib/app-audit/browser-sweep.server";
import type { RouteEntry } from "#/lib/site-model.server";

const baseRoute: RouteEntry = {
	path: "/test",
	locale: null,
	auth: "public",
	expectedStatus: 200,
	intent: "test",
};

// ──────────────────────────────────────────────────────────────────────────────
// Pure classifier helpers
// ──────────────────────────────────────────────────────────────────────────────

describe("classifyNetworkStatus", () => {
	it("maps 503 → blocker", () => {
		expect(classifyNetworkStatus(503)).toBe("blocker");
	});

	it("maps 500 → blocker", () => {
		expect(classifyNetworkStatus(500)).toBe("blocker");
	});

	it("maps 0 (requestfailed) → blocker", () => {
		expect(classifyNetworkStatus(0)).toBe("blocker");
	});

	it("maps 404 → major", () => {
		expect(classifyNetworkStatus(404)).toBe("major");
	});

	it("maps 400 → major", () => {
		expect(classifyNetworkStatus(400)).toBe("major");
	});

	it("maps 200 → null (no finding)", () => {
		expect(classifyNetworkStatus(200)).toBeNull();
	});

	it("maps 301 → null (no finding)", () => {
		expect(classifyNetworkStatus(301)).toBeNull();
	});
});

describe("isHydrationMismatch", () => {
	it('matches "hydration failed"', () => {
		expect(isHydrationMismatch("hydration failed: foo bar")).toBe(true);
	});

	it('matches "did not match"', () => {
		expect(isHydrationMismatch("Server rendered HTML did not match")).toBe(
			true,
		);
	});

	it('matches "Text content does not match"', () => {
		expect(
			isHydrationMismatch("Text content does not match server-rendered"),
		).toBe(true);
	});

	it("rejects unrelated message", () => {
		expect(isHydrationMismatch("TypeError: cannot read property")).toBe(false);
	});

	it("rejects empty string", () => {
		expect(isHydrationMismatch("")).toBe(false);
	});
});

describe("isMixedContent", () => {
	it('matches "Mixed Content:" prefix', () => {
		expect(isMixedContent("Mixed Content: http://example.com blocked")).toBe(
			true,
		);
	});

	it('matches "Mixed Content" anywhere in string', () => {
		expect(isMixedContent("[Violation] Mixed Content warning detected")).toBe(
			true,
		);
	});

	it("rejects plain console error", () => {
		expect(isMixedContent("TypeError: foo is not a function")).toBe(false);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// Mock Page factory
// ──────────────────────────────────────────────────────────────────────────────

type ConsoleMessage = { type: () => string; text: () => string };
type FailedRequest = {
	url: () => string;
	failure: () => { errorText: string } | null;
};
type ResponseLike = { url: () => string; status: () => number };

function createMockLocator(
	opts: {
		textContent?: string | null;
		attrValue?: string | null;
		evaluateAllResult?: string[];
	} = {},
) {
	return {
		textContent: vi.fn(async () => opts.textContent ?? null),
		getAttribute: vi.fn(async () => opts.attrValue ?? null),
		evaluateAll: vi.fn(async () => opts.evaluateAllResult ?? []),
	};
}

interface MockPageConfig {
	gotoThrows?: Error;
	consoleMessages?: ConsoleMessage[];
	failedRequests?: FailedRequest[];
	responses?: ResponseLike[];
	titleText?: string | null;
	metaValues?: Record<string, string | null>;
	brokenImageSrcs?: string[];
	firstPaintMs?: number;
}

function createMockPage(config: MockPageConfig = {}): Page {
	const handlers: Record<string, ((arg: unknown) => void)[]> = {};

	const on = vi.fn((event: string, handler: (arg: unknown) => void) => {
		handlers[event] = handlers[event] ?? [];
		handlers[event].push(handler);
	});

	const goto = vi.fn(async (_url: string) => {
		if (config.gotoThrows) throw config.gotoThrows;
		for (const msg of config.consoleMessages ?? []) {
			handlers.console?.forEach((h) => {
				h(msg);
			});
		}
		for (const req of config.failedRequests ?? []) {
			handlers.requestfailed?.forEach((h) => {
				h(req);
			});
		}
		for (const res of config.responses ?? []) {
			handlers.response?.forEach((h) => {
				h(res);
			});
		}
		return null;
	});

	function metaVal(key: string, fallback: string): string | null {
		const mv = config.metaValues;
		if (mv && Object.hasOwn(mv, key)) return mv[key];
		return fallback;
	}

	const locator = vi.fn((selector: string) => {
		if (selector === "title") {
			return createMockLocator({
				textContent: config.titleText ?? "Test Page",
			});
		}
		if (selector === 'meta[name="description"]') {
			return createMockLocator({ attrValue: metaVal("description", "desc") });
		}
		if (selector === 'meta[property="og:title"]') {
			return createMockLocator({ attrValue: metaVal("og:title", "OG Title") });
		}
		if (selector === 'meta[property="og:image"]') {
			return createMockLocator({
				attrValue: metaVal("og:image", "https://example.com/img.png"),
			});
		}
		if (selector === 'link[rel="canonical"]') {
			return createMockLocator({
				attrValue: metaVal("canonical", "https://example.com/"),
			});
		}
		if (selector === 'meta[name="viewport"]') {
			return createMockLocator({
				attrValue: metaVal("viewport", "width=device-width"),
			});
		}
		if (selector === "img") {
			return createMockLocator({
				evaluateAllResult: config.brokenImageSrcs ?? [],
			});
		}
		return createMockLocator();
	});

	const evaluate = vi.fn(async () => config.firstPaintMs ?? 0);

	return {
		on,
		goto,
		locator,
		evaluate,
		url: vi.fn(() => ""),
	} as unknown as Page;
}

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — try/catch behavior
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: try/catch", () => {
	it("emits sweep-error finding when page.goto() throws; no exception escapes", async () => {
		const page = createMockPage({ gotoThrows: new Error("navigation failed") });
		const findings = await sweepRoute(page, baseRoute);
		expect(findings).toHaveLength(1);
		expect(findings[0]).toMatchObject({
			category: "sweep-error",
			severity: "major",
			filePath: "/test",
			message: "navigation failed",
		});
	});

	it("sweep-error finding includes stack trace in detail", async () => {
		const err = new Error("timeout");
		const page = createMockPage({ gotoThrows: err });
		const findings = await sweepRoute(page, baseRoute);
		expect(findings[0].detail?.stack).toBeTruthy();
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — console-error listener
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: console-error listener", () => {
	it("captures msg.type() === error; ignores info/warning", async () => {
		const page = createMockPage({
			consoleMessages: [
				{ type: () => "error", text: () => "real error" },
				{ type: () => "info", text: () => "info log" },
				{ type: () => "warning", text: () => "warn" },
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		const errors = findings.filter((f) => f.category === "console-error");
		expect(errors).toHaveLength(1);
		expect(errors[0].message).toContain("real error");
	});

	it("console-error finding has blocker severity", async () => {
		const page = createMockPage({
			consoleMessages: [{ type: () => "error", text: () => "boom" }],
		});
		const findings = await sweepRoute(page, baseRoute);
		const err = findings.find((f) => f.category === "console-error");
		expect(err?.severity).toBe("blocker");
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — hydration-mismatch listener
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: hydration-mismatch", () => {
	it("detects hydration-mismatch from console.error with 'hydration failed'", async () => {
		const page = createMockPage({
			consoleMessages: [
				{ type: () => "error", text: () => "hydration failed: expected div" },
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.some((f) => f.category === "hydration-mismatch")).toBe(
			true,
		);
		expect(
			findings.find((f) => f.category === "hydration-mismatch")?.severity,
		).toBe("blocker");
	});

	it("detects hydration-mismatch from 'did not match'", async () => {
		const page = createMockPage({
			consoleMessages: [
				{
					type: () => "error",
					text: () => "Server rendered HTML did not match",
				},
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.some((f) => f.category === "hydration-mismatch")).toBe(
			true,
		);
	});

	it("detects hydration-mismatch from 'Text content does not match'", async () => {
		const page = createMockPage({
			consoleMessages: [
				{
					type: () => "error",
					text: () => "Text content does not match server-rendered HTML",
				},
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.some((f) => f.category === "hydration-mismatch")).toBe(
			true,
		);
	});

	it("hydration-mismatch message is NOT also classified as console-error", async () => {
		const page = createMockPage({
			consoleMessages: [
				{ type: () => "error", text: () => "hydration failed: mismatch" },
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.some((f) => f.category === "console-error")).toBe(false);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — mixed-content
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: mixed-content", () => {
	it("detects mixed-content from console.error containing 'Mixed Content'", async () => {
		const page = createMockPage({
			consoleMessages: [
				{
					type: () => "error",
					text: () => "Mixed Content: The page was loaded over HTTPS",
				},
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.some((f) => f.category === "mixed-content")).toBe(true);
	});

	it("mixed-content is NOT classified as console-error", async () => {
		const page = createMockPage({
			consoleMessages: [
				{ type: () => "error", text: () => "Mixed Content: blocked" },
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.some((f) => f.category === "console-error")).toBe(false);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — network-fail
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: network-fail", () => {
	it("503 response → blocker finding", async () => {
		const page = createMockPage({
			responses: [
				{ url: () => "http://localhost/api/data", status: () => 503 },
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		const netFail = findings.filter((f) => f.category === "network-fail");
		expect(netFail).toHaveLength(1);
		expect(netFail[0].severity).toBe("blocker");
	});

	it("404 response → major finding", async () => {
		const page = createMockPage({
			responses: [{ url: () => "http://localhost/img.png", status: () => 404 }],
		});
		const findings = await sweepRoute(page, baseRoute);
		const netFail = findings.filter((f) => f.category === "network-fail");
		expect(netFail).toHaveLength(1);
		expect(netFail[0].severity).toBe("major");
	});

	it("200 response → no network-fail finding", async () => {
		const page = createMockPage({
			responses: [{ url: () => "http://localhost/", status: () => 200 }],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.filter((f) => f.category === "network-fail")).toHaveLength(
			0,
		);
	});

	it("requestfailed event (no HTTP status) → blocker finding", async () => {
		const page = createMockPage({
			failedRequests: [
				{
					url: () => "http://localhost/resource.js",
					failure: () => ({ errorText: "net::ERR_CONNECTION_REFUSED" }),
				},
			],
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(
			findings.some(
				(f) => f.category === "network-fail" && f.severity === "blocker",
			),
		).toBe(true);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — broken-image
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: broken-image", () => {
	it("returns broken-image finding with src URL when naturalWidth === 0", async () => {
		const page = createMockPage({
			brokenImageSrcs: ["http://localhost/bad.png"],
		});
		const findings = await sweepRoute(page, baseRoute);
		const brokenImg = findings.find((f) => f.category === "broken-image");
		expect(brokenImg).toBeDefined();
		expect(brokenImg?.severity).toBe("major");
		expect(brokenImg?.detail?.src).toBe("http://localhost/bad.png");
	});

	it("no broken-image finding when all images load successfully", async () => {
		const page = createMockPage({ brokenImageSrcs: [] });
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.filter((f) => f.category === "broken-image")).toHaveLength(
			0,
		);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — missing-meta
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: missing-meta", () => {
	it("returns missing-meta finding for absent og:title", async () => {
		const page = createMockPage({
			metaValues: { "og:title": null },
		});
		const findings = await sweepRoute(page, baseRoute);
		const missing = findings.filter((f) => f.category === "missing-meta");
		expect(missing.some((f) => f.detail?.tag === "og:title")).toBe(true);
	});

	it("no missing-meta finding when all tags present", async () => {
		const page = createMockPage();
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.filter((f) => f.category === "missing-meta")).toHaveLength(
			0,
		);
	});

	it("empty string og:image counts as missing", async () => {
		const page = createMockPage({
			metaValues: { "og:image": "" },
		});
		const findings = await sweepRoute(page, baseRoute);
		expect(
			findings.some(
				(f) => f.category === "missing-meta" && f.detail?.tag === "og:image",
			),
		).toBe(true);
	});
});

// ──────────────────────────────────────────────────────────────────────────────
// sweepRoute — slow-response
// ──────────────────────────────────────────────────────────────────────────────

describe("sweepRoute: slow-response", () => {
	it("emits slow-response finding when first-paint > 1500ms", async () => {
		const page = createMockPage({ firstPaintMs: 1600 });
		const findings = await sweepRoute(page, baseRoute);
		const slow = findings.find((f) => f.category === "slow-response");
		expect(slow).toBeDefined();
		expect(slow?.severity).toBe("minor");
		expect(slow?.detail?.firstPaintMs).toBe(1600);
	});

	it("no slow-response finding when first-paint <= 1500ms", async () => {
		const page = createMockPage({ firstPaintMs: 1000 });
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.filter((f) => f.category === "slow-response")).toHaveLength(
			0,
		);
	});

	it("no slow-response finding at exactly 1500ms", async () => {
		const page = createMockPage({ firstPaintMs: 1500 });
		const findings = await sweepRoute(page, baseRoute);
		expect(findings.filter((f) => f.category === "slow-response")).toHaveLength(
			0,
		);
	});
});
