// @vitest-environment jsdom
import {
	cleanup,
	createEvent,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LanguageMenu } from "#/components/ui/language-menu";

afterEach(() => {
	cleanup();
});

// LanguageMenu's `dropdown` variant hides items behind a trigger button.
// Use the `list` variant so items render immediately for unit assertions.

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
			name: "Português (BR) (not available)",
		});
		expect(item.getAttribute("aria-label")).toBe(
			"Português (BR) (not available)",
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
			name: "English (indisponível)",
		});
		expect(item.getAttribute("aria-label")).toBe("English (indisponível)");
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
		expect(screen.getByText("(not available)")).toBeDefined();
	});
});

// ─── unit: keyboard handler — issue 003 ─────────────────────────────────────

describe("unit: onKeyDown preventDefault (issue 003 — Space scrolls page)", () => {
	it("Space key fires onClick", () => {
		const onClick = vi.fn();
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{ locale: "pt-br", label: "Português", available: true, onClick },
				],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", { name: "Português" });
		fireEvent.keyDown(item, { key: " ", code: "Space" });

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("Space key event is defaultPrevented", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português", available: true }],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", { name: "Português" });
		const event = createEvent.keyDown(item, { key: " ", code: "Space" });
		fireEvent(item, event);

		expect(event.defaultPrevented).toBe(true);
	});

	it("Enter key fires onClick", () => {
		const onClick = vi.fn();
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{ locale: "pt-br", label: "Português", available: true, onClick },
				],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", { name: "Português" });
		fireEvent.keyDown(item, { key: "Enter", code: "Enter" });

		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("Enter key event is defaultPrevented", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português", available: true }],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", { name: "Português" });
		const event = createEvent.keyDown(item, { key: "Enter", code: "Enter" });
		fireEvent(item, event);

		expect(event.defaultPrevented).toBe(true);
	});

	it("other keys do not fire onClick", () => {
		const onClick = vi.fn();
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{ locale: "pt-br", label: "Português", available: true, onClick },
				],
				currentLocale: "en",
			}),
		);

		const item = screen.getByRole("button", { name: "Português" });
		fireEvent.keyDown(item, { key: "Tab", code: "Tab" });
		fireEvent.keyDown(item, { key: "Escape", code: "Escape" });

		expect(onClick).not.toHaveBeenCalled();
	});
});
