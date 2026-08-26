import { describe, expect, jest, mock, test } from "bun:test";
import type { ReactNode } from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = (() => {
	let currentPathname = "/";
	return {
		setPathname: (p: string) => {
			currentPathname = p;
		},
		getPathname: () => currentPathname,
	};
})();

mock.module("@tanstack/react-devtools", () => ({
	TanStackDevtools: () => null,
}));

mock.module("@tanstack/react-router-devtools", () => ({
	TanStackRouterDevtoolsPanel: () => null,
}));

mock.module("@tanstack/react-start", () => ({
	createServerFn: () => ({ handler: (fn: unknown) => fn }),
}));

mock.module("@tanstack/react-start/server", () => ({
	getRequest: jest.fn(),
}));

mock.module("#/components/layout/footer", () => ({
	Footer: () => null,
}));

mock.module("#/components/layout/header", () => ({
	Header: () => null,
}));

mock.module("#/components/layout/wip-banner", () => ({
	WipBanner: () => null,
}));

mock.module("#/lib/theme", () => ({
	ThemeProvider: ({ children }: { children: ReactNode }) => children,
}));

mock.module("@tanstack/react-router", () => ({
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
	useLocation: jest.fn(() => ({ pathname: mocks.getPathname() })),
	useRouterState: jest.fn(
		({ select }: { select: (state: unknown) => unknown }) =>
			select({ location: { pathname: mocks.getPathname() } }),
	),
}));

const { strings } = await import("#/lib/i18n/strings");
const { NotFoundPage } = await import("#/routes/__root");

// ─── unit: NotFoundPage locale detection ──────────────────────────────────────

describe("unit: NotFoundPage renders en UIStrings for default locale", () => {
	test("renders notFound.title from strings.en when pathname has no locale prefix", () => {
		mocks.setPathname("/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings.en.notFound.title);
	});

	test("renders notFound.body from strings.en when pathname has no locale prefix", () => {
		mocks.setPathname("/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings.en.notFound.body);
	});

	test("renders notFound.homeCta from strings.en when pathname has no locale prefix", () => {
		mocks.setPathname("/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings.en.notFound.homeCta);
	});
});

describe("unit: NotFoundPage renders pt-br UIStrings for /pt-br/ prefix", () => {
	test("renders notFound.title from strings['pt-br'] when pathname starts with /pt-br/", () => {
		mocks.setPathname("/pt-br/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings["pt-br"].notFound.title);
	});

	test("renders notFound.body from strings['pt-br'] when pathname starts with /pt-br/", () => {
		mocks.setPathname("/pt-br/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings["pt-br"].notFound.body);
	});

	test("renders notFound.homeCta from strings['pt-br'] when pathname starts with /pt-br/", () => {
		mocks.setPathname("/pt-br/nonexistent-page");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain(strings["pt-br"].notFound.homeCta);
	});
});

describe("unit: NotFoundPage does not contain old hardcoded strings", () => {
	test("en 404 title is sourced from UIStrings module, not inline literal", () => {
		mocks.setPathname("/nonexistent");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain("Page not found");
		expect(html).not.toContain("doesn't exist or has been moved");
	});

	test("pt-br 404 title is sourced from UIStrings module, not inline literal", () => {
		mocks.setPathname("/pt-br/nonexistent");
		const html = renderToStaticMarkup(createElement(NotFoundPage));
		expect(html).toContain("Página não encontrada");
		expect(html).not.toContain("foi movida para outro endereço");
	});
});
