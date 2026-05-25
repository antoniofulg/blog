// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	let pathname = "/admin";
	let locale: "en" | "pt-br" = "en";
	const setLocaleSpy = vi.fn();
	return {
		setPathname: (p: string) => {
			pathname = p;
		},
		getPathname: () => pathname,
		setLocale: (l: "en" | "pt-br") => {
			locale = l;
		},
		getLocale: () => locale,
		setLocaleSpy,
	};
});

vi.mock("@tanstack/react-router", () => ({
	useLocation: () => ({ pathname: mocks.getPathname() }),
	// Link renders as <a href={to}> so existing test selectors (getByRole("link"),
	// .closest("a"), getAttribute("href")) continue to work unchanged.
	Link: ({
		to,
		children,
		className,
		"aria-current": ariaCurrent,
	}: {
		to: string;
		children: React.ReactNode;
		className?: string;
		"aria-current"?: string;
	}) =>
		React.createElement(
			"a",
			{ href: to, className, "aria-current": ariaCurrent },
			children,
		),
}));

// Provide LOCALES so that strings.ts module-level validation loop works.
// setLocaleSpy is the spy injected into the component via useLocale().
vi.mock("#/lib/locale", () => ({
	useLocale: () => ({
		locale: mocks.getLocale(),
		setLocale: mocks.setLocaleSpy,
	}),
	LOCALES: ["en", "pt-br"],
}));

import { AdminSidebar } from "#/components/admin/sidebar";
import { strings } from "#/lib/i18n/strings";

// ─── Unit: render ─────────────────────────────────────────────────────────────

describe("unit: AdminSidebar renders nav items", () => {
	beforeEach(() => {
		mocks.setPathname("/admin");
		mocks.setLocale("en");
	});
	afterEach(cleanup);

	it("renders the admin navigation landmark", () => {
		render(React.createElement(AdminSidebar));
		expect(screen.getByRole("navigation")).toBeDefined();
	});

	it("renders Posts nav item with en label from strings", () => {
		render(React.createElement(AdminSidebar));
		expect(screen.getByText(strings.en.admin.sidebar.posts)).toBeDefined();
	});

	it("renders Analytics nav item with en label from strings", () => {
		render(React.createElement(AdminSidebar));
		expect(screen.getByText(strings.en.admin.sidebar.analytics)).toBeDefined();
	});

	it("renders exactly two nav items", () => {
		render(React.createElement(AdminSidebar));
		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(2);
	});
});

// ─── Unit: active state (Posts) ───────────────────────────────────────────────

describe("unit: AdminSidebar active state — Posts", () => {
	beforeEach(() => {
		mocks.setLocale("en");
	});
	afterEach(cleanup);

	it("Posts item has aria-current=page when pathname is /admin", () => {
		mocks.setPathname("/admin");
		render(React.createElement(AdminSidebar));
		const link = screen.getByText(strings.en.admin.sidebar.posts).closest("a");
		expect(link?.getAttribute("aria-current")).toBe("page");
	});

	it("Posts item has aria-current=page when pathname is /admin/", () => {
		mocks.setPathname("/admin/");
		render(React.createElement(AdminSidebar));
		const link = screen.getByText(strings.en.admin.sidebar.posts).closest("a");
		expect(link?.getAttribute("aria-current")).toBe("page");
	});

	it("Posts item does NOT have aria-current when pathname is /admin/analytics", () => {
		mocks.setPathname("/admin/analytics");
		render(React.createElement(AdminSidebar));
		const link = screen.getByText(strings.en.admin.sidebar.posts).closest("a");
		expect(link?.getAttribute("aria-current")).toBeNull();
	});
});

// ─── Unit: active state (Analytics) ──────────────────────────────────────────

describe("unit: AdminSidebar active state — Analytics", () => {
	beforeEach(() => {
		mocks.setLocale("en");
	});
	afterEach(cleanup);

	it("Analytics item does NOT have aria-current when pathname is /admin", () => {
		mocks.setPathname("/admin");
		render(React.createElement(AdminSidebar));
		const link = screen
			.getByText(strings.en.admin.sidebar.analytics)
			.closest("a");
		expect(link?.getAttribute("aria-current")).toBeNull();
	});

	it("Analytics item has aria-current=page when pathname is /admin/analytics", () => {
		mocks.setPathname("/admin/analytics");
		render(React.createElement(AdminSidebar));
		const link = screen
			.getByText(strings.en.admin.sidebar.analytics)
			.closest("a");
		expect(link?.getAttribute("aria-current")).toBe("page");
	});

	it("Analytics item has aria-current=page when pathname starts with /admin/analytics", () => {
		mocks.setPathname("/admin/analytics/overview");
		render(React.createElement(AdminSidebar));
		const link = screen
			.getByText(strings.en.admin.sidebar.analytics)
			.closest("a");
		expect(link?.getAttribute("aria-current")).toBe("page");
	});

	it("Analytics item does NOT have aria-current when pathname is /admin/", () => {
		mocks.setPathname("/admin/");
		render(React.createElement(AdminSidebar));
		const link = screen
			.getByText(strings.en.admin.sidebar.analytics)
			.closest("a");
		expect(link?.getAttribute("aria-current")).toBeNull();
	});
});

// ─── Unit: link hrefs ─────────────────────────────────────────────────────────

describe("unit: AdminSidebar link hrefs", () => {
	beforeEach(() => {
		mocks.setPathname("/admin");
		mocks.setLocale("en");
	});
	afterEach(cleanup);

	it("Posts link href is /admin", () => {
		render(React.createElement(AdminSidebar));
		const link = screen.getByText(strings.en.admin.sidebar.posts).closest("a");
		expect(link?.getAttribute("href")).toBe("/admin");
	});

	it("Analytics link href is /admin/analytics", () => {
		render(React.createElement(AdminSidebar));
		const link = screen
			.getByText(strings.en.admin.sidebar.analytics)
			.closest("a");
		expect(link?.getAttribute("href")).toBe("/admin/analytics");
	});
});

// ─── Unit: pt-br locale ───────────────────────────────────────────────────────

describe("unit: AdminSidebar pt-br locale", () => {
	beforeEach(() => {
		mocks.setPathname("/admin");
		mocks.setLocale("pt-br");
	});
	afterEach(cleanup);

	it("renders Posts nav item with pt-br label from strings", () => {
		render(React.createElement(AdminSidebar));
		expect(
			screen.getByText(strings["pt-br"].admin.sidebar.posts),
		).toBeDefined();
	});

	it("renders Analytics nav item with pt-br label from strings", () => {
		render(React.createElement(AdminSidebar));
		expect(
			screen.getByText(strings["pt-br"].admin.sidebar.analytics),
		).toBeDefined();
	});
});

// ─── Unit: sidebar no longer hosts the lang switcher ─────────────────────────
//
// The language switcher moved from the sidebar to the public Header so admin
// gets the same locale-toggle affordance as reader pages. Switcher behavior
// is now exercised by app/tests/header.test.ts (admin branch) and the
// tests/e2e/ux-polish.spec.ts admin lang-switcher scenario.

describe("unit: AdminSidebar — switcher removed", () => {
	beforeEach(() => {
		mocks.setPathname("/admin");
		mocks.setLocale("en");
	});
	afterEach(cleanup);

	it("does NOT render the language switcher (moved to Header)", () => {
		render(React.createElement(AdminSidebar));
		// LanguagePair renders localeCode values "EN" / "PT" as button text.
		// Neither must appear inside the sidebar after the move.
		expect(screen.queryByText("EN")).toBeNull();
		expect(screen.queryByText("PT")).toBeNull();
	});

	it("renders only the two nav-item links — no extra buttons", () => {
		render(React.createElement(AdminSidebar));
		// Only nav items remain; no <button> elements from a LanguageMenu.
		expect(screen.queryAllByRole("button")).toHaveLength(0);
		expect(screen.getAllByRole("link")).toHaveLength(2);
	});
});
