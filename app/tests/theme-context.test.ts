// @vitest-environment jsdom
/**
 * Unit and integration tests for app/lib/theme.tsx.
 *
 * Acceptance criteria exercised:
 *   AC-1: setTheme('cs16') appends exactly one <link> on first call per page load
 *   AC-2: Second call to setTheme('cs16') is idempotent (no duplicate <link>)
 *   AC-3: setTheme('cs16', 'keyboard') dispatches recordThemeEvent with correct payload
 *   AC-4: setTheme('dark'/'light') does NOT dispatch recordThemeEvent
 *   AC-5: Hydration useEffect triggers ensureCs16Font() for returning cs16 visitors
 *   AC-6: toggle() cycles only light ↔ dark, never invokes cs16 branches
 *   AC-7: Rejected recordThemeEvent does not throw or block the visual theme swap
 */

import { act, cleanup, renderHook } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LocaleProvider } from "#/lib/locale";
import {
	_resetCs16FontFlagForTest,
	ensureCs16Font,
	ThemeProvider,
	useTheme,
} from "#/lib/theme";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────
// Must be declared before any imports so vi.hoisted() runs first.

const mocks = vi.hoisted(() => ({
	recordThemeEvent: vi.fn(() => Promise.resolve({ recorded: true })),
}));

// Replace the analytics server fn module.
// theme.tsx uses a dynamic import for recordThemeEvent (inside setTheme), so
// vi.mock intercepts it correctly without the static import chain issues that
// occur with @tanstack/react-start/server-only in the jsdom environment.
vi.mock("#/lib/analytics/record-theme-event.server", () => ({
	recordThemeEvent: mocks.recordThemeEvent,
}));

// ─── jsdom environment setup ──────────────────────────────────────────────────

// ThemeProvider reads window.matchMedia on mount; stub it to return light preference.
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false, // false → light mode preference (no dark-mode match)
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function resetDom() {
	for (const el of document.head.querySelectorAll("link[data-cs16]")) {
		el.remove();
	}
	document.documentElement.className = "";
}

function makeProviderHook() {
	return renderHook(() => useTheme(), {
		wrapper: ({ children }) =>
			React.createElement(
				LocaleProvider,
				null,
				React.createElement(ThemeProvider, null, children),
			),
	});
}

// ─── Global cleanup ───────────────────────────────────────────────────────────

afterEach(() => {
	cleanup();
	mocks.recordThemeEvent.mockClear();
	localStorage.clear();
	resetDom();
	_resetCs16FontFlagForTest();
});

// ─── unit: ensureCs16Font ─────────────────────────────────────────────────────

describe("unit: ensureCs16Font", () => {
	beforeEach(() => {
		_resetCs16FontFlagForTest();
		resetDom();
	});

	it("AC-1: first call appends exactly one <link> with correct rel, href, data-cs16", () => {
		ensureCs16Font();

		const links = document.head.querySelectorAll("link[data-cs16='true']");
		expect(links).toHaveLength(1);
		const link = links[0] as HTMLLinkElement;
		expect(link.rel).toBe("stylesheet");
		expect(link.getAttribute("href")).toBe(
			"/_fontsource/press-start-2p/latin-400.css",
		);
		expect(link.dataset.cs16).toBe("true");
	});

	it("AC-2: second call is a no-op — module flag prevents duplicate <link>", () => {
		ensureCs16Font();
		ensureCs16Font();

		expect(
			document.head.querySelectorAll("link[data-cs16='true']"),
		).toHaveLength(1);
	});

	it("SSR path: returns early without throwing when document is undefined", () => {
		const savedDocument = globalThis.document;
		// @ts-expect-error — simulate SSR environment (no window/document globals)
		delete globalThis.document;

		try {
			expect(() => ensureCs16Font()).not.toThrow();
		} finally {
			globalThis.document = savedDocument;
		}

		// Confirm no link was injected when document was absent
		expect(document.head.querySelectorAll("link[data-cs16]")).toHaveLength(0);
	});
});

// ─── unit: ThemeProvider setTheme — telemetry dispatch gating ─────────────────

describe("unit: ThemeProvider — setTheme telemetry dispatch gating", () => {
	it("AC-3: setTheme('cs16', 'keyboard') dispatches recordThemeEvent once with correct payload", async () => {
		const { result } = makeProviderHook();

		await act(async () => {
			result.current.setTheme("cs16", "keyboard");
		});

		expect(mocks.recordThemeEvent).toHaveBeenCalledOnce();
		expect(mocks.recordThemeEvent).toHaveBeenCalledWith({
			data: { theme: "cs16", source: "keyboard", lang: "en" },
		});
	});

	it("setTheme('cs16') with no source argument defaults to 'long-press'", async () => {
		const { result } = makeProviderHook();

		await act(async () => {
			result.current.setTheme("cs16");
		});

		expect(mocks.recordThemeEvent).toHaveBeenCalledWith({
			data: { theme: "cs16", source: "long-press", lang: "en" },
		});
	});

	it("AC-4: setTheme('dark') does NOT dispatch recordThemeEvent", async () => {
		const { result } = makeProviderHook();

		await act(async () => {
			result.current.setTheme("dark");
		});

		expect(mocks.recordThemeEvent).not.toHaveBeenCalled();
	});

	it("AC-4: setTheme('light') does NOT dispatch recordThemeEvent", async () => {
		const { result } = makeProviderHook();

		await act(async () => {
			result.current.setTheme("light");
		});

		expect(mocks.recordThemeEvent).not.toHaveBeenCalled();
	});

	it("AC-7: rejected recordThemeEvent does not throw and theme swap still completes", async () => {
		mocks.recordThemeEvent.mockRejectedValueOnce(new Error("Network error"));

		const { result } = makeProviderHook();

		await expect(
			act(async () => {
				result.current.setTheme("cs16", "long-press");
			}),
		).resolves.not.toThrow();

		// Theme swap must have completed despite analytics failure
		expect(result.current.theme).toBe("cs16");
	});
});

// ─── unit: ThemeProvider toggle() semantics ───────────────────────────────────

describe("unit: ThemeProvider — toggle() stays in light/dark cycle", () => {
	it("AC-6: toggle() cycles light → dark → light without calling recordThemeEvent", async () => {
		const { result } = makeProviderHook();
		// Wait for hydration useEffect to settle: matchMedia returns false → light
		await act(async () => {});
		expect(result.current.theme).toBe("light");

		act(() => {
			result.current.toggle();
		});
		expect(result.current.theme).toBe("dark");

		act(() => {
			result.current.toggle();
		});
		expect(result.current.theme).toBe("light");

		expect(mocks.recordThemeEvent).not.toHaveBeenCalled();
	});

	it("AC-6 regression: toggle() from cs16 never produces cs16 as the next theme", async () => {
		const { result } = makeProviderHook();

		await act(async () => {
			result.current.setTheme("cs16");
		});
		expect(result.current.theme).toBe("cs16");
		mocks.recordThemeEvent.mockClear();

		act(() => {
			result.current.toggle();
		});
		// toggle() uses `prev === "dark" ? "light" : "dark"
		// cs16 !== "dark" → next = "dark"; cs16 branch is never reached.
		expect(result.current.theme).not.toBe("cs16");
		// toggle() must not fire telemetry
		expect(mocks.recordThemeEvent).not.toHaveBeenCalled();
	});
});

// ─── integration: ThemeProvider — cs16 activation path ───────────────────────

describe("integration: ThemeProvider — cs16 activation path", () => {
	it("integration: setTheme('cs16') flips documentElement.classList to cs16 AND appends font <link>", async () => {
		const { result } = makeProviderHook();

		await act(async () => {
			result.current.setTheme("cs16", "keyboard");
		});

		expect(document.documentElement.classList.contains("cs16")).toBe(true);
		const links = document.head.querySelectorAll("link[data-cs16='true']");
		expect(links).toHaveLength(1);
	});

	it("AC-5: hydration useEffect calls ensureCs16Font for returning cs16 visitor (no user click)", async () => {
		// Pre-seed localStorage to simulate a returning cs16 visitor
		localStorage.setItem("theme", "cs16");

		const { result } = makeProviderHook();

		// Hydration effect runs inside renderHook's act wrapper;
		// additional flush ensures effects are fully settled.
		await act(async () => {});

		expect(result.current.theme).toBe("cs16");
		// Font link must be injected by the hydration path, not user interaction
		const links = document.head.querySelectorAll("link[data-cs16='true']");
		expect(links).toHaveLength(1);
	});
});
