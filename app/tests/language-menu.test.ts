// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";
import { LanguageMenu } from "#/components/ui/language-menu";

afterEach(() => {
	cleanup();
});

// LanguageMenu's default `pair` variant uses `hidden lg:inline-flex`, so the
// chips are display:none at jsdom's default viewport. Use the `list` variant
// so items render immediately for unit assertions.

// ─── unit: aria-label — issue 002 ────────────────────────────────────────────

describe("unit: aria-label on menu items (issue 002 — screen reader accessibility)", () => {
	it("available item aria-label is just the locale label", () => {
		// Non-active locale so the item config (label/available) is consumed.
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português", available: true }],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", { name: "Português" });
		expect(item.getAttribute("aria-label")).toBe("Português");
	});

	it("unavailable item aria-label includes the hint text (en currentLocale)", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)", available: false }],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", {
			name: "Português (BR), no translation",
		});
		expect(item.getAttribute("aria-label")).toBe(
			"Português (BR), no translation",
		);
	});

	it("unavailable item aria-label uses pt-br hint when currentLocale is pt-br", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "en", label: "English", available: false }],
				currentLocale: "pt-br",
			}),
		);

		const item = screen.getByRole("button", {
			name: "English, sem tradução",
		});
		expect(item.getAttribute("aria-label")).toBe("English, sem tradução");
	});

	it("unavailable item still renders visible hint span for sighted users", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)", available: false }],
				currentLocale: "en",
			}),
		);

		// aria-hidden span with hint text must still be in DOM for sighted users
		expect(screen.getByText("no translation")).toBeDefined();
	});
});

// ─── unit: keyboard activation (native <button>) ────────────────────────────
//
// Manual onKeyDown handler removed in the audit pass — native <button>
// already activates on Space/Enter via the browser's synthetic click event
// without scrolling the page. The previous tests asserted properties of the
// custom handler; with the handler gone, those assertions tested framework
// behavior, not application behavior. Native activation is covered
// implicitly by every test that uses fireEvent.click on the chip.

describe("unit: tabIndex and aria-current on active chip", () => {
	it("active chip carries aria-current and tabIndex=-1", () => {
		// The active locale's chip is rendered but should not be a tab stop —
		// pressing Enter/Space on it would be a no-op (handler is undefined).
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português" }],
				currentLocale: "en",
			}),
		);
		const active = screen.getByRole("button", { name: "English" });
		expect(active.getAttribute("aria-current")).toBe("true");
		expect(active.tabIndex).toBe(-1);
	});

	it("alternate chip is in the tab order", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português", available: true }],
				currentLocale: "en",
			}),
		);
		const alt = screen.getByRole("button", { name: "Português" });
		expect(alt.getAttribute("aria-current")).toBeNull();
		expect(alt.tabIndex).toBe(0);
	});
});
