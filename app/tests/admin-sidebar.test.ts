// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
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

// ─── Unit: lang switcher ──────────────────────────────────────────────────────

describe("unit: AdminSidebar lang switcher", () => {
	beforeEach(() => {
		mocks.setPathname("/admin");
		mocks.setLocale("en");
		mocks.setLocaleSpy.mockClear();
	});
	afterEach(cleanup);

	it("renders both locale buttons (EN and PT) from LanguageMenu pair variant", () => {
		render(React.createElement(AdminSidebar));
		// LanguagePair renders localeCode values: "EN" for en, "PT" for pt-br
		expect(screen.getByText("EN")).toBeDefined();
		expect(screen.getByText("PT")).toBeDefined();
	});

	it("renders exactly 2 locale buttons in LanguageMenu", () => {
		render(React.createElement(AdminSidebar));
		const buttons = screen
			.getAllByRole("button")
			.filter((b) => b.textContent === "EN" || b.textContent === "PT");
		expect(buttons).toHaveLength(2);
	});

	it("each locale button has an associated onClick function in items", () => {
		render(React.createElement(AdminSidebar));
		// The inactive locale button (PT when locale=en) must have an onClick handler.
		// Active locale (EN) has onClick=undefined per LanguagePair design.
		const ptButton = screen.getByText("PT");
		// Clicking the inactive locale should invoke setLocale — proves onClick exists
		fireEvent.click(ptButton);
		expect(mocks.setLocaleSpy).toHaveBeenCalledTimes(1);
	});

	it("clicking the inactive locale fires setLocale with the correct target", () => {
		mocks.setLocale("en"); // current locale is en
		render(React.createElement(AdminSidebar));
		const ptButton = screen.getByText("PT");
		fireEvent.click(ptButton);
		expect(mocks.setLocaleSpy).toHaveBeenCalledTimes(1);
		expect(mocks.setLocaleSpy).toHaveBeenCalledWith("pt-br");
	});

	it("clicking the active locale does NOT fire setLocale", () => {
		mocks.setLocale("en"); // current locale is en, EN button is active
		render(React.createElement(AdminSidebar));
		const enButton = screen.getByText("EN");
		fireEvent.click(enButton);
		expect(mocks.setLocaleSpy).not.toHaveBeenCalled();
	});

	it("nav items coexist with lang switcher — no regression", () => {
		render(React.createElement(AdminSidebar));
		expect(screen.getByText(strings.en.admin.sidebar.posts)).toBeDefined();
		expect(screen.getByText(strings.en.admin.sidebar.analytics)).toBeDefined();
		expect(screen.getByText("EN")).toBeDefined();
	});

	it("when pt-br locale is active, clicking EN fires setLocale with 'en'", () => {
		mocks.setLocale("pt-br");
		render(React.createElement(AdminSidebar));
		const enButton = screen.getByText("EN");
		fireEvent.click(enButton);
		expect(mocks.setLocaleSpy).toHaveBeenCalledTimes(1);
		expect(mocks.setLocaleSpy).toHaveBeenCalledWith("en");
	});
});
