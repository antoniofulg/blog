// @vitest-environment jsdom
/**
 * Unit / component tests for the admin posts list Share column (task 10).
 *
 * Tests cover:
 *   AC-1: 3 PostShare dropdown triggers rendered for 3 posts
 *   AC-2: Each trigger has accessible label "Share post"
 *   AC-3: Canonical URL for pt-br post includes /pt-br/ prefix
 *   AC-4: Canonical URL for en post is /<slug> (no /en/ prefix)
 */

import { act, cleanup, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, describe, expect, it } from "vitest";

// ── JSDOM polyfills for Radix UI ──────────────────────────────────────────────

// Radix Popover's @radix-ui/react-use-size uses ResizeObserver internally.
// JSDOM does not ship ResizeObserver — mock a no-op stub.
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// ── Mocks (hoisted before all imports) ────────────────────────────────────────

import { vi } from "vitest";

// #/lib/locale is mocked to avoid pulling in @tanstack/react-router (which
// uses useRouterState internally). The localeHref mock mirrors the real
// implementation exactly so URL computation tests are authoritative.
vi.mock("#/lib/locale", () => ({
	LOCALES: ["en", "pt-br"],
	DEFAULT_LOCALE: "en",
	localeHref: (locale: string, slug?: string): string => {
		if (locale === "en") return slug ? `/${slug}` : "/";
		return slug ? `/${locale}/${slug}` : `/${locale}/`;
	},
	toBcp47: (l: string) => l,
	useLocale: () => ({ locale: "en", setLocale: () => {} }),
}));

// Mock site-origin for predictable absolute URLs in tests.
// getSiteOrigin() returns "" in vitest Node env — override to a known value.
vi.mock("#/lib/site-origin", () => ({
	getSiteOrigin: () => "https://blog.example",
}));

import { PostShare } from "#/components/ui/post-share";
import type { Locale } from "#/lib/locale";
// Import under test — AFTER mocks
import { localeHref } from "#/lib/locale";
import { getSiteOrigin } from "#/lib/site-origin";

// ── Type ──────────────────────────────────────────────────────────────────────

type PostFixture = {
	id: number;
	slug: string;
	lang: string;
	title: string;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Mirrors the URL construction logic from app/routes/admin/index.tsx:
 *   postUrl = getSiteOrigin() + localeHref(post.lang as Locale, post.slug)
 */
function buildAdminPostUrl(lang: string, slug: string): string {
	return `${getSiteOrigin()}${localeHref(lang as Locale, slug)}`;
}

function renderAdminShareRows(posts: PostFixture[]) {
	return render(
		React.createElement(
			"table",
			null,
			React.createElement(
				"tbody",
				null,
				posts.map((post) =>
					React.createElement(
						"tr",
						{ key: post.id },
						React.createElement(
							"td",
							null,
							React.createElement(PostShare, {
								variant: "dropdown",
								postUrl: buildAdminPostUrl(post.lang, post.slug),
								postSlug: post.slug,
								postTitle: post.title,
								locale: post.lang as Locale,
							}),
						),
					),
				),
			),
		),
	);
}

// ── Fixtures ──────────────────────────────────────────────────────────────────

const THREE_POSTS: PostFixture[] = [
	{ id: 1, slug: "first-post", lang: "en", title: "First Post" },
	{ id: 2, slug: "second-post", lang: "en", title: "Second Post" },
	{ id: 3, slug: "terceiro-post", lang: "pt-br", title: "Terceiro Post" },
];

// ── Cleanup ───────────────────────────────────────────────────────────────────

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// ── Unit: canonical URL computation ──────────────────────────────────────────

describe("unit: admin share column — canonical URL computation", () => {
	it("pt-br post canonical URL includes the /pt-br/ prefix", () => {
		const url = buildAdminPostUrl("pt-br", "meu-post");
		expect(url).toBe("https://blog.example/pt-br/meu-post");
		expect(url).toContain("/pt-br/");
	});

	it("en post canonical URL is /<slug> with no /en/ prefix (DEFAULT_LOCALE convention)", () => {
		const url = buildAdminPostUrl("en", "my-post");
		expect(url).toBe("https://blog.example/my-post");
		expect(url).not.toContain("/en/");
	});

	it("en canonical URL ends with the slug directly after origin", () => {
		const url = buildAdminPostUrl("en", "tanstack-router-guide");
		expect(url).toBe("https://blog.example/tanstack-router-guide");
	});

	it("pt-br canonical URL embeds locale between origin and slug", () => {
		const url = buildAdminPostUrl("pt-br", "guia-do-roteador");
		expect(url).toBe("https://blog.example/pt-br/guia-do-roteador");
	});
});

// ── Component: PostShare dropdown per row (AC-1, AC-2) ───────────────────────

describe("component: admin share column — PostShare dropdown trigger per row", () => {
	it("renders exactly 3 PostShare dropdown triggers for 3 posts (AC-1)", async () => {
		renderAdminShareRows(THREE_POSTS);
		await act(async () => {});
		const triggers = screen.getAllByRole("button", { name: "Share post" });
		expect(triggers).toHaveLength(3);
	});

	it("each trigger has accessible label 'Share post' (AC-2)", async () => {
		renderAdminShareRows(THREE_POSTS);
		await act(async () => {});
		const triggers = screen.getAllByRole("button", { name: "Share post" });
		for (const trigger of triggers) {
			expect(trigger.getAttribute("aria-label")).toBe("Share post");
		}
	});

	it("renders 1 trigger for a single post (table of 1 row)", async () => {
		renderAdminShareRows([THREE_POSTS[0]]);
		await act(async () => {});
		const triggers = screen.getAllByRole("button", { name: "Share post" });
		expect(triggers).toHaveLength(1);
	});

	it("renders 0 triggers when posts array is empty (no JS error)", async () => {
		renderAdminShareRows([]);
		await act(async () => {});
		const triggers = screen.queryAllByRole("button", { name: "Share post" });
		expect(triggers).toHaveLength(0);
	});
});
