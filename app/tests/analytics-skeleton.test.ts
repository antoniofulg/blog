// @vitest-environment jsdom
/**
 * Unit tests for AnalyticsDashboardSkeleton component.
 *
 * Tests verify: loading skeleton renders while the loader is pending
 * (pendingComponent for the analytics route). Skeleton must be visible
 * and carry aria-busy for accessibility.
 *
 * All component tests use React.createElement (no JSX) and .ts extension
 * to match the project's vitest include pattern (`app/tests/**\/*.test.ts`).
 */
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

// ── SUT import ────────────────────────────────────────────────────────────────

import { AnalyticsDashboardSkeleton } from "#/components/admin/analytics/analytics-skeleton";

// ── Cleanup ───────────────────────────────────────────────────────────────────

afterEach(cleanup);

// ── Skeleton rendering ────────────────────────────────────────────────────────

describe("AnalyticsDashboardSkeleton — loading state", () => {
	it("renders wrapper with data-testid='analytics-skeleton'", () => {
		render(React.createElement(AnalyticsDashboardSkeleton));
		expect(screen.getByTestId("analytics-skeleton")).toBeDefined();
	});

	it("skeleton wrapper carries aria-busy='true'", () => {
		render(React.createElement(AnalyticsDashboardSkeleton));
		const skeleton = screen.getByTestId("analytics-skeleton");
		expect(skeleton.getAttribute("aria-busy")).toBe("true");
	});

	it("skeleton wrapper has an accessible label for screen readers", () => {
		render(React.createElement(AnalyticsDashboardSkeleton));
		const skeleton = screen.getByTestId("analytics-skeleton");
		expect(skeleton.getAttribute("aria-label")).toBeTruthy();
	});

	it("renders skeleton boxes (animate-pulse elements)", () => {
		const { container } = render(
			React.createElement(AnalyticsDashboardSkeleton),
		);
		// animate-pulse class identifies skeleton boxes
		const skeletonBoxes = container.querySelectorAll(".animate-pulse");
		// At minimum: 2 header + 4 summary cards + 1 daily trend + 1 referrer bar + 2 bottom row = 10
		expect(skeletonBoxes.length).toBeGreaterThanOrEqual(10);
	});

	it("renders 4 summary card skeletons", () => {
		const { container } = render(
			React.createElement(AnalyticsDashboardSkeleton),
		);
		// Summary card grid has 4 children — cards are h-24
		const cards = container.querySelectorAll(".h-24");
		expect(cards).toHaveLength(4);
	});
});
