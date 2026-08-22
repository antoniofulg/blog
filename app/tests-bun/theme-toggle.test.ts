import "./happydom";

/**
 * Unit and integration tests for app/components/ui/theme-toggle.tsx
 *
 * Acceptance criteria exercised:
 *   AC-1: ArrowDown opens the popover from the focused toggle button.
 *   AC-2: Space does NOT open the popover — uses native button click → toggle().
 *   AC-3: Menu items (Light/Dark/CS 1.6) exist in DOM even when open===false
 *         (Popover.Portal forceMount), with `hidden` on Content toggling AT-visibility.
 *   AC-4: Selecting CS 1.6 after ArrowDown-open calls setTheme with source:'keyboard'.
 *         ArrowDown-open moves focus to first menuitemradio (ARIA menu-button pattern).
 *   AC-5: Selecting CS 1.6 after long-press-open calls setTheme with source:'long-press'.
 *   AC-6: Short-click calls toggle(), popover stays closed.
 *   aria: button has aria-haspopup="menu", aria-expanded, aria-keyshortcuts="ArrowDown".
 *
 * File is .ts (not .tsx) per project convention — React.createElement used throughout.
 */

import {
	afterAll,
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";

const { act, cleanup, createEvent, fireEvent, render, screen } = await import(
	"@testing-library/react"
);

import React from "react";

// ── Hoisted mock state ────────────────────────────────────────────────────────

const mocks = (() => ({
	useThemeSpy: jest.fn(),
	mockToggle: jest.fn(),
	mockSetTheme: jest.fn(),
	recordThemeEvent: jest.fn(() => Promise.resolve({ recorded: true })),
	/**
	 * Captured reference to the real `useTheme` from the actual module.
	 * Set inside the jest.mock factory so integration tests can restore the real
	 * implementation for describe blocks that need actual context reads.
	 * Must live in jest.hoisted so it is initialised before the mock factory runs.
	 */
	realUseTheme: null as
		| (() => {
				theme: "light" | "dark" | "cs16";
				toggle: () => void;
				setTheme: (
					t: "light" | "dark" | "cs16",
					s?: "long-press" | "keyboard",
				) => void;
		  })
		| null,
}))();

// Replace `useTheme` with a spy so unit tests control the returned values.
// All other exports (ThemeProvider, ThemeSource, etc.) stay real.
// Bun uses a complete module factory below so unit and integration paths share
// the same implementation exports.

// Intercept the dispatch-theme-event wrapper used by theme.tsx.
// theme.tsx dynamically imports dispatchThemeEvent from dispatch-theme-event.ts
// (a non-.server. wrapper) to avoid TanStack Start's import-protection plugin.
mock.module("#/lib/analytics/dispatch-theme-event", () => ({
	dispatchThemeEvent: mocks.recordThemeEvent,
}));

// ── Imports (after jest.mock declarations) ─────────────────────────────────────

import { LocaleProvider as RealLocaleProvider } from "#/lib/locale";
import * as realTheme from "#/lib/theme";

const realUseTheme = realTheme.useTheme;

window.happyDOM.settings.disableCSSFileLoading = true;
window.happyDOM.settings.handleDisabledFileLoadingAsSuccess = true;

mock.module("#/lib/theme", () => ({
	...realTheme,
	useTheme: mocks.useThemeSpy,
}));

const { ThemeProvider } = realTheme;
const { ThemeToggle } = await import("#/components/ui/theme-toggle");
mocks.realUseTheme = realUseTheme;

// ── jsdom stubs ───────────────────────────────────────────────────────────────

// ThemeProvider reads window.matchMedia on mount — stub to return light preference.
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: jest.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: jest.fn(),
		removeListener: jest.fn(),
		addEventListener: jest.fn(),
		removeEventListener: jest.fn(),
		dispatchEvent: jest.fn(),
	})),
});

// ── Default mock: unit tests use controlled theme values ─────────────────────

// Set before each test; integration describe overrides with the real useTheme.
function setUnitMock() {
	mocks.useThemeSpy.mockReturnValue({
		theme: "light" as const,
		toggle: mocks.mockToggle,
		setTheme: mocks.mockSetTheme,
	});
}

// Apply default before every test so no test inherits a previous override.
// Individual describe blocks that need the real implementation call
// `mocks.useThemeSpy.mockImplementation(() => _realUseTheme!())` in beforeAll
// and restore here in afterAll.
setUnitMock();

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Render ThemeToggle with the mocked useTheme context (unit-test path). */
function renderToggle(locale: "en" | "pt-br" = "en") {
	return render(React.createElement(ThemeToggle, { locale }));
}

function getToggleBtn() {
	return screen.getByRole("button", { name: "Toggle theme" });
}

// ── Global cleanup ────────────────────────────────────────────────────────────

afterEach(() => {
	cleanup();
	mocks.mockToggle.mockClear();
	mocks.mockSetTheme.mockClear();
	mocks.recordThemeEvent.mockClear();
	localStorage.clear();
	document.documentElement.className = "";
	for (const el of document.head.querySelectorAll("link[data-cs16]")) {
		el.remove();
	}
	// Restore unit mock after each test
	setUnitMock();
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit: keyboard handler — ArrowDown opens the popover; Space uses native click
// ═════════════════════════════════════════════════════════════════════════════

describe("unit: handleKeyDown — ArrowDown opens the popover", () => {
	test("AC-1: ArrowDown opens the popover (aria-expanded goes false→true)", () => {
		renderToggle();
		const btn = getToggleBtn();

		expect(btn.getAttribute("aria-expanded")).toBe("false");
		fireEvent.keyDown(btn, { key: "ArrowDown" });
		expect(btn.getAttribute("aria-expanded")).toBe("true");
	});

	test("AC-2: Space does NOT open the popover via handleKeyDown (uses native click → toggle)", () => {
		renderToggle();
		const btn = getToggleBtn();

		expect(btn.getAttribute("aria-expanded")).toBe("false");
		fireEvent.keyDown(btn, { key: " " });
		// Space is not intercepted by handleKeyDown; popover stays closed.
		// Native click event fires separately (via browser Space-on-button) calling toggle().
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});

	test("ArrowDown calls preventDefault to suppress native scroll", () => {
		renderToggle();
		const btn = getToggleBtn();

		const event = createEvent.keyDown(btn, { key: "ArrowDown" });
		const preventSpy = jest.spyOn(event, "preventDefault");
		fireEvent(btn, event);

		expect(preventSpy).toHaveBeenCalledOnce();
	});

	test("Space does NOT call preventDefault — uses native button activation", () => {
		renderToggle();
		const btn = getToggleBtn();

		const event = createEvent.keyDown(btn, { key: " " });
		const preventSpy = jest.spyOn(event, "preventDefault");
		fireEvent(btn, event);

		expect(preventSpy).not.toHaveBeenCalled();
	});

	test("Tab key does NOT open the popover", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "Tab" });
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});

	test("Enter key does NOT open the popover from the button", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "Enter" });
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});

	test("Escape key does NOT open the popover from the button-level handler", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "Escape" });
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});

	test("arbitrary character key 'a' does NOT open the popover", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "a" });
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit: ARIA attributes
// ═════════════════════════════════════════════════════════════════════════════

describe("unit: aria attributes on the toggle button", () => {
	test("has aria-haspopup='menu'", () => {
		renderToggle();
		expect(getToggleBtn().getAttribute("aria-haspopup")).toBe("menu");
	});

	test("has aria-expanded='false' when popover is closed", () => {
		renderToggle();
		expect(getToggleBtn().getAttribute("aria-expanded")).toBe("false");
	});

	test("has aria-expanded='true' after ArrowDown opens the popover", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "ArrowDown" });
		expect(btn.getAttribute("aria-expanded")).toBe("true");
	});

	test("has aria-keyshortcuts='ArrowDown' (Space uses native button activation, not disclosed)", () => {
		renderToggle();
		expect(getToggleBtn().getAttribute("aria-keyshortcuts")).toBe("ArrowDown");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit: Popover.Portal forceMount — items always in DOM
// ═════════════════════════════════════════════════════════════════════════════

describe("unit: forceMount — menu items exist in DOM regardless of open state", () => {
	test("AC-3: three menuitemradio buttons exist in DOM when popover is closed", () => {
		renderToggle();
		// { hidden: true } includes elements hidden from the AT tree
		// (Popover.Content has `hidden` attr when open===false)
		const items = screen.getAllByRole("menuitemradio", { hidden: true });
		expect(items).toHaveLength(3);
	});

	test("AC-3: three menuitemradio buttons exist in DOM when popover is open", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "ArrowDown" });

		const items = screen.getAllByRole("menuitemradio");
		expect(items).toHaveLength(3);
	});

	test("popover content has 'hidden' attribute when open===false", () => {
		renderToggle();
		// role="menu" is set explicitly on Popover.Content
		const menu = screen.getByRole("menu", { hidden: true });
		expect(menu.hasAttribute("hidden")).toBe(true);
	});

	test("popover content does NOT have 'hidden' attribute when open===true", () => {
		renderToggle();
		const btn = getToggleBtn();
		fireEvent.keyDown(btn, { key: "ArrowDown" });

		const menu = screen.getByRole("menu");
		expect(menu.hasAttribute("hidden")).toBe(false);
	});

	test("Light, Dark, and CS 1.6 options exist in DOM even when popover is closed", () => {
		renderToggle();
		const labels = screen
			.getAllByRole("menuitemradio", { hidden: true })
			.map((el) => el.textContent?.trim());
		expect(labels).toContain("Light");
		expect(labels).toContain("Dark");
		expect(labels).toContain("CS 1.6");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit: focus management — ARIA menu-button focus-to-first-item on ArrowDown
// ═════════════════════════════════════════════════════════════════════════════

describe("unit: focus management — ArrowDown moves focus to first menuitemradio", () => {
	test("ArrowDown opens popover and moves focus to the first menu item", async () => {
		// Focus-to-first-item is provided by:
		//   1. Radix Popover's built-in FocusTrap (on open state transitions),
		//   2. the useEffect belt-and-suspenders ensuring the correct element in
		//      browsers where the hidden-attribute toggle may suppress Radix's trap.
		renderToggle();
		const btn = getToggleBtn();

		await act(async () => {
			fireEvent.keyDown(btn, { key: "ArrowDown" });
		});

		const items = screen.getAllByRole("menuitemradio");
		expect(document.activeElement).toBe(items[0]);
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit: source attribution — keyboard vs long-press (mocked setTheme)
// ═════════════════════════════════════════════════════════════════════════════

describe("unit: source attribution — keyboard path sets source='keyboard'", () => {
	test("AC-4: ArrowDown then pick CS 1.6 calls setTheme with source:'keyboard'", () => {
		renderToggle();
		const btn = getToggleBtn();

		// Open via keyboard
		fireEvent.keyDown(btn, { key: "ArrowDown" });

		// Pick the third menu item (CS 1.6) from the now-visible menu
		const cs16Btn = screen.getAllByRole("menuitemradio")[2];
		fireEvent.click(cs16Btn);

		// Third arg is the route locale (default "en" render) so theme_events.lang
		// follows the page, not the persisted preference.
		expect(mocks.mockSetTheme).toHaveBeenCalledWith("cs16", "keyboard", "en");
	});

	test("forwards the route locale prop as the third setTheme arg (pt-br route)", () => {
		renderToggle("pt-br");
		// pt-br render localizes the aria-label, so query by the pt-br name.
		const btn = screen.getByRole("button", { name: "Alternar tema" });

		fireEvent.keyDown(btn, { key: "ArrowDown" });
		const cs16Btn = screen.getAllByRole("menuitemradio")[2];
		fireEvent.click(cs16Btn);

		// Proves the P2 fix: activating cs16 on a /pt-br/ route records lang "pt-br"
		// regardless of the persisted locale preference.
		expect(mocks.mockSetTheme).toHaveBeenCalledWith(
			"cs16",
			"keyboard",
			"pt-br",
		);
	});

	test("Space does NOT open popover — toggle() is called via native click instead", () => {
		// Space keydown no longer intercepted; native button fires click → toggle().
		// This test verifies the popover source attribution path is not triggered by Space.
		renderToggle();
		const btn = getToggleBtn();

		fireEvent.keyDown(btn, { key: " " });
		// Popover remains closed — no menu item to click.
		expect(btn.getAttribute("aria-expanded")).toBe("false");
		expect(mocks.mockSetTheme).not.toHaveBeenCalled();
	});
});

describe("unit: source attribution — long-press path sets source='long-press'", () => {
	beforeAll(() => {
		jest.useFakeTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	test("AC-5: long-press then pick CS 1.6 calls setTheme with source:'long-press'", async () => {
		renderToggle();
		const btn = getToggleBtn();

		// Simulate pointer long-press: pointerDown → advance 500ms timer → open
		fireEvent.pointerDown(btn);
		await act(async () => {
			jest.advanceTimersByTime(500);
		});

		// Popover should now be open
		expect(btn.getAttribute("aria-expanded")).toBe("true");

		const cs16Btn = screen.getAllByRole("menuitemradio")[2];
		fireEvent.click(cs16Btn);

		expect(mocks.mockSetTheme).toHaveBeenCalledWith("cs16", "long-press", "en");
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Unit: AC-6 — short-click still calls toggle(), no popover
// ═════════════════════════════════════════════════════════════════════════════

describe("unit: AC-6 — short-click calls toggle(), popover stays closed", () => {
	beforeAll(() => {
		jest.useFakeTimers();
	});

	afterAll(() => {
		jest.useRealTimers();
	});

	test("click without long-press calls toggle() and leaves popover closed", async () => {
		renderToggle();
		const btn = getToggleBtn();

		// Simulate short press: pointerDown → pointerUp before 500ms → click
		fireEvent.pointerDown(btn);
		fireEvent.pointerUp(btn);
		fireEvent.click(btn);

		expect(mocks.mockToggle).toHaveBeenCalledOnce();
		expect(btn.getAttribute("aria-expanded")).toBe("false");
	});

	test("short-click does NOT call setTheme", async () => {
		renderToggle();
		const btn = getToggleBtn();

		fireEvent.pointerDown(btn);
		fireEvent.pointerUp(btn);
		fireEvent.click(btn);

		expect(mocks.mockSetTheme).not.toHaveBeenCalled();
	});
});

// ═════════════════════════════════════════════════════════════════════════════
// Integration: ThemeProvider + ThemeToggle — ArrowDown → CS 1.6 activation
// ═════════════════════════════════════════════════════════════════════════════

describe("integration: ThemeProvider + ThemeToggle — keyboard CS 1.6 activation", () => {
	/**
	 * This describe block uses the REAL `useTheme` by restoring the original
	 * implementation from the captured `_realUseTheme` reference. ThemeToggle
	 * calls `useTheme()` → spy → real useTheme → useContext(ThemeContext) which
	 * is satisfied by the real ThemeProvider wrapping the tree.
	 *
	 * recordThemeEvent is still mocked so we can assert the call args.
	 */
	// beforeEach (inner describe) runs AFTER global afterEach, so the real
	// useTheme is re-applied before each integration test even though global
	// afterEach resets the spy to the unit mock between tests.
	// Lifecycle order: test → describe afterEach → global afterEach
	//                  → global beforeEach → describe beforeEach → next test
	const restoreReal = () => {
		if (mocks.realUseTheme) {
			mocks.useThemeSpy.mockImplementation(() => mocks.realUseTheme?.());
		}
	};

	// beforeAll: initial setup before first integration test
	// beforeEach: re-apply before EACH test because the global afterEach calls
	//   setUnitMock() which resets the spy between tests.
	// Vitest hook order: test → describe afterEach → global afterEach
	//                    → global beforeEach → describe beforeEach → next test
	beforeAll(restoreReal);
	beforeEach(restoreReal);

	function renderIntegration() {
		return render(
			React.createElement(
				RealLocaleProvider,
				null,
				React.createElement(
					ThemeProvider,
					null,
					React.createElement(ThemeToggle, { locale: "en" }),
				),
			),
		);
	}

	test("ArrowDown + click CS 1.6 sets documentElement class to 'cs16'", async () => {
		renderIntegration();
		await act(async () => {}); // settle hydration effect

		const btn = screen.getByRole("button", { name: "Toggle theme" });
		fireEvent.keyDown(btn, { key: "ArrowDown" });

		const cs16Btn = screen.getAllByRole("menuitemradio")[2];
		await act(async () => {
			fireEvent.click(cs16Btn);
		});

		expect(document.documentElement.classList.contains("cs16")).toBe(true);
	});

	test("ArrowDown + click CS 1.6 calls recordThemeEvent with source:'keyboard'", async () => {
		renderIntegration();
		await act(async () => {});

		const btn = screen.getByRole("button", { name: "Toggle theme" });
		fireEvent.keyDown(btn, { key: "ArrowDown" });

		const cs16Btn = screen.getAllByRole("menuitemradio")[2];
		await act(async () => {
			fireEvent.click(cs16Btn);
		});

		// Flush the dynamic import inside setTheme (fire-and-forget promise)
		await act(async () => {});

		expect(mocks.recordThemeEvent).toHaveBeenCalledWith({
			data: { theme: "cs16", source: "keyboard", lang: "en" },
		});
	});
});
