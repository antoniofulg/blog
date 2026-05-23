// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Footer } from "#/components/layout/footer";

vi.mock("@tanstack/react-router", () => ({
	useRouterState: ({
		select,
	}: {
		select: (s: { location: { pathname: string } }) => string;
	}) => select({ location: { pathname: "/en/" } }),
	Link: ({
		children,
		to,
		params,
		className,
	}: {
		children: React.ReactNode;
		to: string;
		params?: { locale?: string };
		className?: string;
	}) => {
		let href = String(to ?? "");
		const localeVal = params?.locale;
		if (localeVal === undefined || localeVal === null) {
			href = href.replace("/{-$locale}/", "/");
		} else {
			href = href.replace("/{-$locale}/", `/${localeVal}/`);
		}
		return React.createElement("a", { href, className }, children);
	},
}));

vi.mock("#/lib/locale", async () => {
	const actual =
		await vi.importActual<typeof import("#/lib/locale")>("#/lib/locale");
	return { ...actual, useCurrentLocale: () => "en" };
});

function renderFooter() {
	return render(React.createElement(Footer));
}

afterEach(() => {
	cleanup();
});

// ─── unit: navLinks absent entries ────────────────────────────────────────────

describe("unit: Footer navLinks absent entries", () => {
	it("no link to /tutorials", () => {
		renderFooter();
		expect(document.querySelector('a[href="/tutorials"]')).toBeNull();
	});

	it("no link to /projects", () => {
		renderFooter();
		expect(document.querySelector('a[href="/projects"]')).toBeNull();
	});

	it("no link to /blog (deleted route, listing moved to /)", () => {
		renderFooter();
		expect(document.querySelector('a[href="/blog"]')).toBeNull();
	});
});

// ─── unit: resourceLinks absent entries ───────────────────────────────────────

describe("unit: Footer resourceLinks absent entries", () => {
	it("no link to /feed.xml", () => {
		renderFooter();
		expect(document.querySelector('a[href="/feed.xml"]')).toBeNull();
	});

	it("no link to /sitemap.xml", () => {
		renderFooter();
		expect(document.querySelector('a[href="/sitemap.xml"]')).toBeNull();
	});

	it("no link to /newsletter", () => {
		renderFooter();
		expect(document.querySelector('a[href="/newsletter"]')).toBeNull();
	});

	it("no link to /search", () => {
		renderFooter();
		expect(document.querySelector('a[href="/search"]')).toBeNull();
	});
});

// ─── unit: social links absent ────────────────────────────────────────────────

describe("unit: Footer social links absent", () => {
	it("no placeholder github.com link", () => {
		renderFooter();
		expect(document.querySelector('a[href="https://github.com"]')).toBeNull();
	});

	it("no placeholder linkedin.com link", () => {
		renderFooter();
		expect(document.querySelector('a[href="https://linkedin.com"]')).toBeNull();
	});

	it("no placeholder twitter.com link", () => {
		renderFooter();
		expect(document.querySelector('a[href="https://twitter.com"]')).toBeNull();
	});
});

// ─── unit: valid remaining links ──────────────────────────────────────────────

describe("unit: Footer valid remaining links (locale=en)", () => {
	it("renders link to /", () => {
		renderFooter();
		expect(document.querySelector('a[href="/"]')).not.toBeNull();
	});

	it("renders link to /en/about (locale-aware About)", () => {
		renderFooter();
		expect(document.querySelector('a[href="/en/about"]')).not.toBeNull();
	});

	it("no unprefixed /about link (replaced by /en/about for bilingual parity)", () => {
		renderFooter();
		expect(document.querySelector('a[href="/about"]')).toBeNull();
	});
});

// ─── unit: bilingual copy ─────────────────────────────────────────────────────

describe("unit: Footer copy (locale=en)", () => {
	it("renders English tagline", () => {
		renderFooter();
		expect(
			document.body.textContent?.includes("Daily lessons from shipping"),
		).toBe(true);
	});

	it("renders English rights-reserved string", () => {
		renderFooter();
		expect(document.body.textContent?.includes("All rights reserved")).toBe(
			true,
		);
	});

	it("renders dynamic copyright year", () => {
		renderFooter();
		expect(
			document.body.textContent?.includes(String(new Date().getFullYear())),
		).toBe(true);
	});
});
