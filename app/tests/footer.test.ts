// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Footer } from "#/components/layout/footer";

// ─── Locale holder (allows per-describe locale switching) ─────────────────────

const localeMock = vi.hoisted(() => {
	let _locale = "en";
	return {
		get: () => _locale,
		set: (l: string) => {
			_locale = l;
		},
		reset: () => {
			_locale = "en";
		},
	};
});

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
	return { ...actual, useCurrentLocale: () => localeMock.get() };
});

function renderFooter() {
	return render(React.createElement(Footer));
}

afterEach(() => {
	cleanup();
	localeMock.reset();
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

// ─── unit: Privacy link (locale=en) ──────────────────────────────────────────

describe("unit: Footer Privacy link (locale=en)", () => {
	it("renders a Privacy link pointing at /en/privacy", () => {
		renderFooter();
		expect(document.querySelector('a[href="/en/privacy"]')).not.toBeNull();
	});

	it("Privacy link label is 'Privacy'", () => {
		renderFooter();
		const link = document.querySelector('a[href="/en/privacy"]');
		expect(link?.textContent).toBe("Privacy");
	});
});

// ─── unit: Privacy link (locale=pt-br) ───────────────────────────────────────

describe("unit: Footer Privacy link (locale=pt-br)", () => {
	beforeEach(() => {
		localeMock.set("pt-br");
	});

	it("renders a Privacy link pointing at /pt-br/privacy", () => {
		renderFooter();
		expect(document.querySelector('a[href="/pt-br/privacy"]')).not.toBeNull();
	});

	it("Privacy link label is 'Privacidade'", () => {
		renderFooter();
		const link = document.querySelector('a[href="/pt-br/privacy"]');
		expect(link?.textContent).toBe("Privacidade");
	});
});
