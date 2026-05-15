// @vitest-environment jsdom

import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	let currentPathname = "/";
	return {
		setPathname: (p: string) => {
			currentPathname = p;
		},
		getPathname: () => currentPathname,
	};
});

vi.mock("@tanstack/react-devtools", () => ({
	TanStackDevtools: () => null,
}));

vi.mock("@tanstack/react-router-devtools", () => ({
	TanStackRouterDevtoolsPanel: () => null,
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

vi.mock("@tanstack/react-start/server", () => ({
	getRequest: vi.fn(),
}));

vi.mock("#/components/layout/footer", () => ({
	Footer: () => null,
}));

vi.mock("#/components/layout/header", () => ({
	Header: () => null,
}));

vi.mock("#/components/layout/wip-banner", () => ({
	WipBanner: () => null,
}));

vi.mock("#/lib/theme", () => ({
	ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

vi.mock("@tanstack/react-router", () => ({
	createRootRouteWithContext: () => (opts: unknown) => opts,
	HeadContent: () => null,
	Link: ({
		children,
		to,
		className,
	}: {
		children: ReactNode;
		to: string;
		className?: string;
	}) => createElement("a", { href: to, className }, children),
	Outlet: () => null,
	Scripts: () => null,
	useLocation: vi.fn(() => ({ pathname: mocks.getPathname() })),
}));

import { strings } from "#/lib/i18n/strings";
import { NotFoundPage } from "#/routes/__root";

// ─── unit: NotFoundPage locale detection ──────────────────────────────────────

describe("unit: NotFoundPage renders en UIStrings for default locale", () => {
	it("renders notFound.title from strings.en when pathname has no locale prefix", () => {
		mocks.setPathname("/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings.en.notFound.title);
	});

	it("renders notFound.body from strings.en when pathname has no locale prefix", () => {
		mocks.setPathname("/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings.en.notFound.body);
	});

	it("renders notFound.homeCta from strings.en when pathname has no locale prefix", () => {
		mocks.setPathname("/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings.en.notFound.homeCta);
	});
});

describe("unit: NotFoundPage renders pt-br UIStrings for /pt-br/ prefix", () => {
	it("renders notFound.title from strings['pt-br'] when pathname starts with /pt-br/", () => {
		mocks.setPathname("/pt-br/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings["pt-br"].notFound.title);
	});

	it("renders notFound.body from strings['pt-br'] when pathname starts with /pt-br/", () => {
		mocks.setPathname("/pt-br/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings["pt-br"].notFound.body);
	});

	it("renders notFound.homeCta from strings['pt-br'] when pathname starts with /pt-br/", () => {
		mocks.setPathname("/pt-br/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings["pt-br"].notFound.homeCta);
	});
});

describe("unit: NotFoundPage does not contain old hardcoded strings", () => {
	it("en 404 title is sourced from UIStrings module, not inline literal", () => {
		mocks.setPathname("/nonexistent");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain("Page not found");
		expect(html).not.toContain("doesn't exist or has been moved");
	});

	it("pt-br 404 title is sourced from UIStrings module, not inline literal", () => {
		mocks.setPathname("/pt-br/nonexistent");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain("Página não encontrada");
		expect(html).not.toContain("foi movida para outro endereço");
	});
});
