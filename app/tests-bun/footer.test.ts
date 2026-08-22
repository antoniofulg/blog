import "./happydom";
import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { cleanup, render } from "@testing-library/react";
import React from "react";

// ─── Locale holder (allows per-describe locale switching) ─────────────────────

const localeMock = (() => {
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
})();

mock.module("@tanstack/react-router", () => ({
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

mock.module("#/lib/locale", () => ({
	DEFAULT_LOCALE: "en",
	useCurrentLocale: () => localeMock.get(),
}));

const { Footer } = await import("#/components/layout/footer");

function renderFooter() {
	return render(React.createElement(Footer));
}

afterEach(() => {
	cleanup();
	localeMock.reset();
});

// ─── unit: navLinks absent entries ────────────────────────────────────────────

describe("unit: Footer navLinks absent entries", () => {
	test("no link to /tutorials", () => {
		renderFooter();
		expect(document.querySelector('a[href="/tutorials"]')).toBeNull();
	});

	test("no link to /projects", () => {
		renderFooter();
		expect(document.querySelector('a[href="/projects"]')).toBeNull();
	});

	test("no link to /blog (deleted route, listing moved to /)", () => {
		renderFooter();
		expect(document.querySelector('a[href="/blog"]')).toBeNull();
	});
});

// ─── unit: resourceLinks absent entries ───────────────────────────────────────

describe("unit: Footer resourceLinks absent entries", () => {
	test("no link to /feed.xml", () => {
		renderFooter();
		expect(document.querySelector('a[href="/feed.xml"]')).toBeNull();
	});

	test("no link to /sitemap.xml", () => {
		renderFooter();
		expect(document.querySelector('a[href="/sitemap.xml"]')).toBeNull();
	});

	test("no link to /newsletter", () => {
		renderFooter();
		expect(document.querySelector('a[href="/newsletter"]')).toBeNull();
	});

	test("no link to /search", () => {
		renderFooter();
		expect(document.querySelector('a[href="/search"]')).toBeNull();
	});
});

// ─── unit: social links absent ────────────────────────────────────────────────

describe("unit: Footer social links absent", () => {
	test("no placeholder github.com link", () => {
		renderFooter();
		expect(document.querySelector('a[href="https://github.com"]')).toBeNull();
	});

	test("no placeholder linkedin.com link", () => {
		renderFooter();
		expect(document.querySelector('a[href="https://linkedin.com"]')).toBeNull();
	});

	test("no placeholder twitter.com link", () => {
		renderFooter();
		expect(document.querySelector('a[href="https://twitter.com"]')).toBeNull();
	});
});

// ─── unit: valid remaining links ──────────────────────────────────────────────

describe("unit: Footer valid remaining links (locale=en)", () => {
	test("renders link to /", () => {
		renderFooter();
		expect(document.querySelector('a[href="/"]')).not.toBeNull();
	});

	test("renders link to /en/about (locale-aware About)", () => {
		renderFooter();
		expect(document.querySelector('a[href="/en/about"]')).not.toBeNull();
	});

	test("no unprefixed /about link (replaced by /en/about for bilingual parity)", () => {
		renderFooter();
		expect(document.querySelector('a[href="/about"]')).toBeNull();
	});
});

// ─── unit: bilingual copy ─────────────────────────────────────────────────────

describe("unit: Footer copy (locale=en)", () => {
	test("renders English tagline", () => {
		renderFooter();
		expect(
			document.body.textContent?.includes("Daily lessons from shipping"),
		).toBe(true);
	});

	test("renders English rights-reserved string", () => {
		renderFooter();
		expect(document.body.textContent?.includes("All rights reserved")).toBe(
			true,
		);
	});

	test("renders dynamic copyright year", () => {
		renderFooter();
		expect(
			document.body.textContent?.includes(String(new Date().getFullYear())),
		).toBe(true);
	});
});

// ─── unit: Privacy link (locale=en) ──────────────────────────────────────────

describe("unit: Footer Privacy link (locale=en)", () => {
	test("renders a Privacy link pointing at /en/privacy", () => {
		renderFooter();
		expect(document.querySelector('a[href="/en/privacy"]')).not.toBeNull();
	});

	test("Privacy link label is 'Privacy'", () => {
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

	test("renders a Privacy link pointing at /pt-br/privacy", () => {
		renderFooter();
		expect(document.querySelector('a[href="/pt-br/privacy"]')).not.toBeNull();
	});

	test("Privacy link label is 'Privacidade'", () => {
		renderFooter();
		const link = document.querySelector('a[href="/pt-br/privacy"]');
		expect(link?.textContent).toBe("Privacidade");
	});
});
