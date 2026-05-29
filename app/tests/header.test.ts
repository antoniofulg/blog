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
import { LanguageMenu } from "#/components/ui/language-menu";
import { LocaleProvider } from "#/lib/locale";
import { ThemeProvider } from "#/lib/theme";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────────

type MockMatch = {
	routeId: string;
	params: Record<string, string | undefined>;
	loaderData?: unknown;
};

const mocks = vi.hoisted(() => {
	const navigate = vi.fn();
	let currentPathname = "/en/blog";
	let currentMatches: MockMatch[] = [];
	const setPathname = (p: string) => {
		currentPathname = p;
	};
	const getPathname = () => currentPathname;
	const setMatches = (m: MockMatch[]) => {
		currentMatches = m;
	};
	const getMatches = () => currentMatches;
	return { navigate, setPathname, getPathname, setMatches, getMatches };
});

// theme.tsx calls recordThemeEvent via dynamic import inside setTheme.
// Mock the module so test renders don't hit the server-only guard.
vi.mock("#/lib/analytics/record-theme-event.server", () => ({
	recordThemeEvent: vi.fn(() => Promise.resolve({ recorded: true })),
}));

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
		select: (s: {
			location: { pathname: string };
			matches: MockMatch[];
		}) => unknown;
	}) =>
		select({
			location: { pathname: mocks.getPathname() },
			matches: mocks.getMatches(),
		}),
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

function slugMatch(
	slug: string,
	locale: string | undefined,
	loaderData: unknown,
): MockMatch {
	return {
		routeId: "/{-$locale}/$slug",
		params: { slug, locale },
		loaderData,
	};
}

// ─── unit: LanguageMenu per-item available state ─────────────────────────────

describe("unit: LanguageMenu available item", () => {
	afterEach(cleanup);

	it("renders label without hint when available defaults (true)", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)" }],
				currentLocale: "en",
			}),
		);
		expect(screen.getByText("Português (BR)")).toBeDefined();
		expect(screen.queryByText("no translation")).toBeNull();
		expect(screen.queryByText("sem tradução")).toBeNull();
	});

	it("renders label without hint when available={true}", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)", available: true }],
				currentLocale: "en",
			}),
		);
		expect(screen.queryByText("no translation")).toBeNull();
	});

	it("renders hint text when available={false} (en locale) (AC-4)", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)", available: false }],
				currentLocale: "en",
			}),
		);
		expect(screen.getByText("no translation")).toBeDefined();
	});

	it("renders localized hint text in pt-br when available={false}", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "en", label: "English", available: false }],
				currentLocale: "pt-br",
			}),
		);
		expect(screen.getByText("sem tradução")).toBeDefined();
	});

	it("aria-label includes 'no translation' hint when available={false} (AC-4)", () => {
		// aria-disabled was removed (button stays operable — opens missing-twin dialog).
		// The hint suffix in aria-label is the AT signal for the unavailable state.
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)", available: false }],
				currentLocale: "en",
			}),
		);
		const item = screen.getByRole("button", { name: /Português \(BR\)/ });
		expect(item.getAttribute("aria-label")).toContain("no translation");
		expect(item.getAttribute("aria-disabled")).toBeNull();
	});

	it("aria-label is plain label when available={true}", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [{ locale: "pt-br", label: "Português (BR)", available: true }],
				currentLocale: "en",
			}),
		);
		const item = screen.getByRole("button", { name: "Português (BR)" });
		expect(item.getAttribute("aria-label")).toBe("Português (BR)");
		expect(item.getAttribute("aria-disabled")).toBeNull();
	});

	it("onClick fires when available={false} (AC-4 — modal seam preserved)", () => {
		const onClick = vi.fn();
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{
						locale: "pt-br",
						label: "Português (BR)",
						available: false,
						onClick,
					},
				],
				currentLocale: "en",
			}),
		);
		const item = screen.getByRole("button", { name: /Português \(BR\)/ });
		fireEvent.click(item);
		expect(onClick).toHaveBeenCalledTimes(1);
	});

	it("onClick fires when available={true}", () => {
		const onClick = vi.fn();
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{
						locale: "pt-br",
						label: "Português (BR)",
						available: true,
						onClick,
					},
				],
				currentLocale: "en",
			}),
		);
		const item = screen.getByRole("button", { name: "Português (BR)" });
		fireEvent.click(item);
		expect(onClick).toHaveBeenCalledTimes(1);
	});
});

// ─── integration: LanguageMenu mixed-availability items ───────────────────────

describe("integration: LanguageMenu mixed availability", () => {
	afterEach(cleanup);

	it("renders available item without hint, unavailable item with hint", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{ locale: "en", label: "English", available: true },
					{ locale: "pt-br", label: "Português (BR)", available: false },
				],
				currentLocale: "en",
			}),
		);
		const availableItem = screen.getByRole("button", { name: "English" });
		const unavailableItem = screen.getByRole("button", {
			name: /Português \(BR\)/,
		});
		// aria-disabled removed per audit P2 fix — state lives in aria-label hint.
		expect(availableItem.getAttribute("aria-label")).toBe("English");
		expect(unavailableItem.getAttribute("aria-label")).toContain(
			"no translation",
		);
		expect(screen.queryByText("no translation")).toBeDefined();
		expect(screen.queryByText("sem tradução")).toBeNull();
	});

	it("both items render their labels regardless of availability", () => {
		render(
			React.createElement(LanguageMenu, {
				variant: "list",
				items: [
					{ locale: "en", label: "English", available: true },
					{ locale: "pt-br", label: "Português (BR)", available: false },
				],
				currentLocale: "en",
			}),
		);
		expect(screen.getByText("English")).toBeDefined();
		expect(screen.getByText("Português (BR)")).toBeDefined();
	});
});

// ─── unit: language switcher trigger label ────────────────────────────────────

describe("unit: Header language switcher trigger label", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setMatches([]);
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("renders locale code 'EN' as the current chip when locale is 'en'", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		// Active chip carries aria-current="true" and aria-label = locale full name.
		const chip = screen.getByRole("button", { name: "English" });
		expect(chip.getAttribute("aria-current")).toBe("true");
		expect(chip.textContent?.trim()).toBe("EN");
	});

	it("renders locale code 'PT' as the current chip when on /pt-br/blog", async () => {
		mocks.setPathname("/pt-br/blog");
		renderHeader();
		await act(async () => {});
		const chip = screen.getByRole("button", { name: "Português" });
		expect(chip.getAttribute("aria-current")).toBe("true");
		expect(chip.textContent?.trim()).toBe("PT");
	});
});

// ─── unit: language switcher rendered on admin routes (post-move) ─────────────
//
// The switcher used to be hidden on admin and pinned to the AdminSidebar
// instead. It now lives in the Header for admin too so the locale-toggle
// affordance is consistent with reader pages. The admin branch in
// useLangSwitcher short-circuits the URL navigate (setLocale only) since
// admin routes are not locale-prefixed.

describe("unit: Header language switcher on admin routes", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setMatches([]);
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("switcher IS rendered on /admin (admin gets the same affordance as reader pages)", async () => {
		mocks.setPathname("/admin");
		renderHeader();
		await act(async () => {});
		// LanguagePair marks the active locale with aria-current="true".
		// On a default-en admin context, the EN chip carries this attribute.
		expect(
			document.querySelector('button[aria-current="true"]'),
		).not.toBeNull();
	});

	it("switcher is rendered on /en/blog", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		expect(
			document.querySelector('button[aria-current="true"]'),
		).not.toBeNull();
	});
});

// ─── unit: language switcher navigation via dropdown ─────────────────────────

describe("unit: Header language switcher navigation", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("on post route '/en/react-suspense', clicking Português navigates to /{-$locale}/$slug/ with pt-br", async () => {
		mocks.setPathname("/en/react-suspense");
		mocks.setMatches([
			slugMatch("react-suspense", "en", {
				kind: "post",
				post: { slug: "react-suspense" },
				alternateLang: "pt-br",
			}),
		]);
		renderHeader();
		await act(async () => {});

		// Click pt-br chip directly (no dropdown anymore — typographic pair)
		const ptBrItem = screen.getByRole("button", { name: /Português/ });
		await act(async () => {
			fireEvent.click(ptBrItem);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/$slug/",
			params: { locale: "pt-br", slug: "react-suspense" },
		});
		expect(localStorage.getItem("locale")).toBe("pt-br");
	});

	it("on structural route '/en/blog', clicking Português navigates to /{-$locale}/ with pt-br", async () => {
		mocks.setPathname("/en/blog");
		mocks.setMatches([]);
		renderHeader();
		await act(async () => {});

		// Typographic pair: no dropdown to open.
		const ptBrItem = screen.getByRole("button", { name: /Português/ });
		await act(async () => {
			fireEvent.click(ptBrItem);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/",
			params: { locale: "pt-br" },
		});
	});

	it("on page route '/about' with twin, clicking Português navigates to /{-$locale}/$slug/ with about", async () => {
		mocks.setPathname("/about");
		mocks.setMatches([
			slugMatch("about", undefined, {
				kind: "page",
				entry: { slug: "about" },
				hasTwin: true,
			}),
		]);
		renderHeader();
		await act(async () => {});

		// Typographic pair: no dropdown to open.
		const ptBrItem = screen.getByRole("button", { name: /Português/ });
		await act(async () => {
			fireEvent.click(ptBrItem);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/$slug/",
			params: { locale: "pt-br", slug: "about" },
		});
	});

	it("on post route with no twin (hasTwin=false), clicking Português opens dialog (no navigate)", async () => {
		mocks.setPathname("/en/en-only-post");
		mocks.setMatches([
			slugMatch("en-only-post", "en", {
				kind: "post",
				post: { slug: "en-only-post" },
				alternateLang: null,
			}),
		]);
		renderHeader();
		await act(async () => {});

		// Typographic pair: no dropdown to open.
		// Unavailable chip signals state via aria-label hint (aria-disabled was
		// removed per audit fix — the button stays operable so the dialog can open).
		const ptBrItem = screen.getByRole("button", { name: /Português/ });
		expect(ptBrItem.getAttribute("aria-label")).toContain("no translation");

		// Click unavailable item → dialog should open, navigate NOT called
		await act(async () => {
			fireEvent.click(ptBrItem);
		});

		expect(mocks.navigate).not.toHaveBeenCalled();
	});
});

// ─── unit: dialog state management ────────────────────────────────────────────

describe("unit: Header dialog state on unavailable locale", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("clicking pt-br chip on /en/blog triggers navigate (no menu state to close)", async () => {
		mocks.setPathname("/en/blog");
		mocks.setMatches([]);
		renderHeader();
		await act(async () => {});

		// Typographic pair has no menu — clicking the chip fires the action directly.
		expect(screen.queryByRole("menu")).toBeNull();

		const ptBrItem = screen.getByRole("button", { name: /Português/ });
		await act(async () => {
			fireEvent.click(ptBrItem);
		});

		expect(mocks.navigate).toHaveBeenCalledWith({
			to: "/{-$locale}/",
			params: { locale: "pt-br" },
		});
	});
});

// ─── integration: localStorage persistence ────────────────────────────────────

describe("integration: language switcher localStorage", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setMatches([]);
	});
	afterEach(() => {
		localStorage.clear();
		cleanup();
	});

	it("after switching locale, localStorage.getItem('locale') returns 'pt-br'", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		// Typographic pair: no dropdown to open.
		const ptBrItem = screen.getByRole("button", { name: /Português/ });
		await act(async () => {
			fireEvent.click(ptBrItem);
		});

		expect(localStorage.getItem("locale")).toBe("pt-br");
	});

	it("switcher button is visible on rendered header on '/en/blog'", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});

		const chip = document.querySelector('button[aria-current="true"]');
		expect(chip).not.toBeNull();
	});
});

// ─── unit: NAV_LABELS absent entries ──────────────────────────────────────────

describe("unit: Header removed nav entries", () => {
	beforeEach(() => {
		localStorage.clear();
		mocks.navigate.mockClear();
		mocks.setMatches([]);
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

	it("locale switcher button still renders on non-admin routes", async () => {
		mocks.setPathname("/en/blog");
		renderHeader();
		await act(async () => {});
		expect(
			document.querySelector('button[aria-current="true"]'),
		).not.toBeNull();
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
