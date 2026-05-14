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

// ─── unit: language switcher label ────────────────────────────────────────────

describe("unit: Header language switcher label", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setPathname("/en/blog");
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("renders 'PT' label when locale is 'en'", async () => {
		renderHeader();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Switch language" });
		expect(btn.textContent).toBe("PT");
	});

	it("renders 'EN' label when on /pt-br/blog", async () => {
		mocks.setPathname("/pt-br/blog");
		renderHeader();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Switch language" });
		expect(btn.textContent).toBe("EN");
	});
});

// ─── unit: language switcher navigation ───────────────────────────────────────

describe("unit: Header language switcher navigation", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("on '/en/react-suspense' navigates to '/$lang/$slug' with pt-br and react-suspense", async () => {
		mocks.setPathname("/en/react-suspense");
		renderHeader();
		await act(async () => {});

		const btn = screen.getByRole("button", { name: "Switch language" });
		await act(async () => {
			fireEvent.click(btn);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/$lang/$slug",
			params: { lang: "pt-br", slug: "react-suspense" },
		});
		expect(localStorage.getItem("locale")).toBe("pt-br");
	});

	it("on '/en/blog' navigates to '/$lang/blog' with pt-br", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		const btn = screen.getByRole("button", { name: "Switch language" });
		await act(async () => {
			fireEvent.click(btn);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/$lang/blog",
			params: { lang: "pt-br" },
		});
	});

	it("on non-locale path falls back to '/$lang/blog' with pt-br", async () => {
		mocks.setPathname("/about");
		renderHeader();
		await act(async () => {});

		const btn = screen.getByRole("button", { name: "Switch language" });
		await act(async () => {
			fireEvent.click(btn);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/$lang/blog",
			params: { lang: "pt-br" },
		});
	});
});

// ─── integration: localStorage persistence ────────────────────────────────────

describe("integration: language switcher localStorage", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setPathname("/en/blog");
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("after clicking switcher, localStorage.getItem('locale') returns 'pt-br'", async () => {
		renderHeader();
		await act(async () => {});

		const btn = screen.getByRole("button", { name: "Switch language" });
		await act(async () => {
			fireEvent.click(btn);
		});

		expect(localStorage.getItem("locale")).toBe("pt-br");
	});

	it("switcher button is visible on rendered header on '/en/blog'", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		const btn = screen.getByRole("button", { name: "Switch language" });
		expect(btn).toBeDefined();
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

	it("locale switcher button still renders", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		expect(
			screen.getByRole("button", { name: "Switch language" }),
		).toBeDefined();
	});

	it("theme toggle button still renders", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		const themeBtn = document.querySelectorAll('button[type="button"]');
		const hasToggle = Array.from(themeBtn).some((b) => b.querySelector("svg"));
		expect(hasToggle).toBe(true);
	});
});
