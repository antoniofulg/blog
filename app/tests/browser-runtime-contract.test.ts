import { describe, expect, test } from "bun:test";
import {
	BROWSER_SMOKE_ROUTE_IDS,
	BROWSER_SMOKE_ROUTES,
	normalizeBrowserSmokeOutcome,
} from "#/lib/browser-bench/contract";

describe("browser smoke contract", () => {
	test("defines the five canonical public outcomes in stable order", () => {
		expect(BROWSER_SMOKE_ROUTES).toHaveLength(5);
		expect(BROWSER_SMOKE_ROUTES.map((route) => route.id)).toEqual([
			...BROWSER_SMOKE_ROUTE_IDS,
		]);
		expect(new Set(BROWSER_SMOKE_ROUTES.map((route) => route.path)).size).toBe(
			5,
		);
		expect(
			BROWSER_SMOKE_ROUTES.filter((route) => route.expectedStatus === 200),
		).toHaveLength(4);
		expect(
			BROWSER_SMOKE_ROUTES.find((route) => route.id === "not-found"),
		).not.toHaveProperty("expectedStatus");
	});

	test("normalizes a complete successful outcome without runner-specific fields", () => {
		const outcome = normalizeBrowserSmokeOutcome({
			routes: BROWSER_SMOKE_ROUTE_IDS.map((id) => ({
				id,
				passed: true,
				status: 200,
			})),
		});

		expect(outcome).toEqual({
			routes: BROWSER_SMOKE_ROUTE_IDS.map((id) => ({
				id,
				passed: true,
				status: 200,
			})),
			passed: true,
		});
	});

	test("rejects missing, reordered, or malformed route outcomes", () => {
		expect(normalizeBrowserSmokeOutcome({ routes: [] })).toBeNull();
		expect(
			normalizeBrowserSmokeOutcome({
				routes: BROWSER_SMOKE_ROUTE_IDS.map((id) => ({
					id,
					passed: true,
				})).reverse(),
			}),
		).toBeNull();
		expect(
			normalizeBrowserSmokeOutcome({
				routes: BROWSER_SMOKE_ROUTE_IDS.map((id) => ({ id, passed: "yes" })),
			}),
		).toBeNull();
	});
});
