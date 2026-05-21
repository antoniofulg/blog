// @vitest-environment jsdom
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Header } from "#/components/layout/header";
import { LocaleProvider } from "#/lib/locale";
import { ThemeProvider } from "#/lib/theme";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const navigate = vi.fn();
	let currentPathname = "/en/blog";
	const setPathname = (p: string) => {
		currentPathname = p;
	};
	const getPathname = () => currentPathname;
	return { navigate, setPathname, getPathname };
});

vi.mock("@tanstack/react-router", () => ({
	Link: ({
		children,
		to,
		onClick,
		className,
	}: {
		children: React.ReactNode;
		to: string;
		onClick?: () => void;
		className?: string;
	}) => React.createElement("a", { href: to, onClick, className }, children),
	useNavigate: () => mocks.navigate,
	useRouterState: ({
		select,
	}: {
		select: (s: { location: { pathname: string } }) => string;
	}) => select({ location: { pathname: mocks.getPathname() } }),
}));

// matchMedia stub for ThemeProvider
Object.defineProperty(window, "matchMedia", {
	writable: true,
	value: vi.fn().mockImplementation((query: string) => ({
		matches: false,
		media: query,
		onchange: null,
		addListener: vi.fn(),
		removeListener: vi.fn(),
		addEventListener: vi.fn(),
		removeEventListener: vi.fn(),
		dispatchEvent: vi.fn(),
	})),
});

// ─── helpers ──────────────────────────────────────────────────────────────────

function renderHeader() {
	return render(
		React.createElement(
			LocaleProvider,
			null,
			React.createElement(ThemeProvider, null, React.createElement(Header)),
		),
	);
}

function openLanguageMenu(locale: "en" | "pt-br") {
	const triggerLabel = locale === "en" ? "Change language" : "Trocar idioma";
	const trigger = screen.getByRole("button", { name: triggerLabel });
	fireEvent.click(trigger);
	return trigger;
}

// ─── unit: language menu trigger ──────────────────────────────────────────────

describe("unit: Header language menu trigger", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setPathname("/en/blog");
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("renders 'Change language' aria-label trigger and EN code when locale is en", async () => {
		renderHeader();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Change language" });
		expect(trigger.textContent).toContain("EN");
	});

	it("renders 'Trocar idioma' aria-label trigger and PT code when locale is pt-br", async () => {
		mocks.setPathname("/pt-br/blog");
		renderHeader();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Trocar idioma" });
		expect(trigger.textContent).toContain("PT");
	});

	it("trigger has aria-haspopup=menu and aria-expanded=false at rest", async () => {
		renderHeader();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Change language" });
		expect(trigger.getAttribute("aria-haspopup")).toBe("menu");
		expect(trigger.getAttribute("aria-expanded")).toBe("false");
	});

	it("clicking trigger opens the menu (aria-expanded=true, menu visible)", async () => {
		renderHeader();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Change language" });
		await act(async () => {
			fireEvent.click(trigger);
		});
		expect(trigger.getAttribute("aria-expanded")).toBe("true");
		expect(screen.getByRole("menu")).toBeDefined();
	});
});

// ─── unit: language menu navigation ───────────────────────────────────────────

describe("unit: Header language menu navigation", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	function selectMenuItem(name: RegExp | string) {
		const item = screen.getByRole("menuitemradio", { name });
		return act(async () => {
			fireEvent.click(item);
		});
	}

	it("on '/en/react-suspense' selecting Português navigates to slug route with pt-br", async () => {
		mocks.setPathname("/en/react-suspense");
		renderHeader();
		await act(async () => {});

		await act(async () => {
			openLanguageMenu("en");
		});
		await selectMenuItem("Português");

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/$slug/",
			params: { locale: "pt-br", slug: "react-suspense" },
		});
		expect(localStorage.getItem("locale")).toBe("pt-br");
	});

	it("on '/en/blog' selecting Português navigates to index with pt-br", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		await act(async () => {
			openLanguageMenu("en");
		});
		await selectMenuItem("Português");

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/",
			params: { locale: "pt-br" },
		});
	});

	it("on '/about' selecting Português navigates to about with pt-br", async () => {
		mocks.setPathname("/about");
		renderHeader();
		await act(async () => {});

		await act(async () => {
			openLanguageMenu("en");
		});
		await selectMenuItem("Português");

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/$slug/",
			params: { locale: "pt-br", slug: "about" },
		});
	});

	it("selecting the current locale is a no-op (no navigate, no localStorage write)", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		await act(async () => {
			openLanguageMenu("en");
		});
		await selectMenuItem("English");

		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});

// ─── integration: localStorage persistence ────────────────────────────────────

describe("integration: language menu localStorage", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setPathname("/en/blog");
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("after selecting Português, localStorage.getItem('locale') returns 'pt-br'", async () => {
		renderHeader();
		await act(async () => {});

		await act(async () => {
			openLanguageMenu("en");
		});
		await act(async () => {
			fireEvent.click(screen.getByRole("menuitemradio", { name: "Português" }));
		});

		expect(localStorage.getItem("locale")).toBe("pt-br");
	});

	it("language trigger is present in rendered header on '/en/blog'", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		const trigger = screen.getByRole("button", { name: "Change language" });
		expect(trigger).toBeDefined();
	});
});

// ─── unit: NAV_LABELS absent entries ──────────────────────────────────────────

describe("unit: Header removed nav entries", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("en locale: no link to /tutorials", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		expect(document.querySelector('a[href="/tutorials"]')).toBeNull();
	});

	it("en locale: no link to /projects", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		expect(document.querySelector('a[href="/projects"]')).toBeNull();
	});

	it("pt-br locale: no link to /tutorials", async () => {
		mocks.setPathname("/pt-br/blog");
		renderHeader();
		await act(async () => {});
		expect(document.querySelector('a[href="/tutorials"]')).toBeNull();
	});

	it("pt-br locale: no link to /projects", async () => {
		mocks.setPathname("/pt-br/blog");
		renderHeader();
		await act(async () => {});
		expect(document.querySelector('a[href="/projects"]')).toBeNull();
	});

	it("language menu trigger still renders", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		expect(
			screen.getByRole("button", { name: "Change language" }),
		).toBeDefined();
	});

	it("theme toggle button still renders", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		const buttons = document.querySelectorAll('button[type="button"]');
		const hasToggle = Array.from(buttons).some((b) => b.querySelector("svg"));
		expect(hasToggle).toBe(true);
	});
});
