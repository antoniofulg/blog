// @vitest-environment jsdom
/**
 * Unit tests for app/components/ui/post-share.tsx
 *
 * Tests cover:
 *   AC-1: SSR default chip row (7 chips, no native Share button)
 *   AC-2: UTM-tagged URLs in chip href values
 *   AC-3: Copy Link clipboard call + "Copied!" aria-live toast
 *   AC-4: Native-share branch (navigator.share present) renders single button
 *   AC-5: AbortError from navigator.share is silent; other errors log
 */

import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
} from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ── Mocks (hoisted before all imports) ────────────────────────────────────────

// #/lib/locale is mocked so we don't pull in @tanstack/react-router.
// strings.ts only needs LOCALES from this module.
vi.mock("#/lib/locale", () => ({
	LOCALES: ["en", "pt-br"],
	DEFAULT_LOCALE: "en",
	localeHref: (locale: string, slug: string) =>
		locale === "en" ? `/${slug}` : `/${locale}/${slug}`,
	toBcp47: (l: string) => l,
	useLocale: () => ({ locale: "en", setLocale: () => {} }),
}));

// Import under test — AFTER mocks
import { buildShareUrl, PostShare } from "#/components/ui/post-share";

// ── Constants ─────────────────────────────────────────────────────────────────

const POST_URL = "https://blog.example/post";
const POST_TITLE = "Hello World";
// UTM-tagged URL that the component should produce for an absolute postUrl
const UTM_URL = "https://blog.example/post?utm_source=blog&utm_medium=share";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderShare(locale: "en" | "pt-br" = "en") {
	return render(
		React.createElement(PostShare, {
			postUrl: POST_URL,
			postTitle: POST_TITLE,
			locale,
		}),
	);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// ── Unit: buildShareUrl (pure function) ───────────────────────────────────────

describe("unit: buildShareUrl", () => {
	it("appends utm_source=blog and utm_medium=share to absolute URL", () => {
		expect(buildShareUrl("https://blog.example/post")).toBe(
			"https://blog.example/post?utm_source=blog&utm_medium=share",
		);
	});

	it("appends UTM params to URL that already has query params (separate with &)", () => {
		const result = buildShareUrl("https://blog.example/post?foo=bar");
		expect(result).toContain("utm_source=blog");
		expect(result).toContain("utm_medium=share");
	});

	it("fallback: appends UTM params to relative URL without throwing", () => {
		const result = buildShareUrl("/my-slug");
		expect(result).toBe("/my-slug?utm_source=blog&utm_medium=share");
	});

	it("does NOT double-add utm_source if already present (URL constructor deduplicates)", () => {
		const result = buildShareUrl(
			"https://blog.example/post?utm_source=other&utm_medium=share",
		);
		// URL.searchParams.set overwrites existing utm_source
		expect(result).toContain("utm_source=blog");
		// only one utm_source param
		const count = (result.match(/utm_source/g) ?? []).length;
		expect(count).toBe(1);
	});
});

// ── Unit: SSR default chip row ────────────────────────────────────────────────

describe("unit: SSR default — 7 chips visible, no native Share button (AC-1)", () => {
	beforeEach(() => {
		// Ensure navigator.share is not defined (SSR default)
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
	});

	it("renders 6 platform link chips (X, LinkedIn, Bluesky, HN, Reddit, Email)", async () => {
		renderShare();
		await act(async () => {});
		const links = screen.getAllByRole("link");
		expect(links.length).toBe(6);
	});

	it("renders the Copy Link button (7th chip)", async () => {
		renderShare();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		expect(btn).toBeDefined();
	});

	it("does NOT render a native Share button (no navigator.share)", async () => {
		renderShare();
		await act(async () => {});
		// The native Share button has aria-label="Share" (standalone button)
		// The Copy Link button has aria-label="Copy link" (excluded by name filter)
		const shareBtn = screen.queryByRole("button", { name: "Share" });
		expect(shareBtn).toBeNull();
	});

	it("all platform chips open in a new tab (target=_blank)", async () => {
		renderShare();
		await act(async () => {});
		const links = screen.getAllByRole("link");
		for (const link of links) {
			expect(link.getAttribute("target")).toBe("_blank");
			expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		}
	});
});

// ── Unit: chip href UTM params (AC-2) ─────────────────────────────────────────

describe("unit: chip hrefs contain UTM-tagged postUrl (AC-2)", () => {
	beforeEach(async () => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
		renderShare();
		await act(async () => {});
	});

	it("LinkedIn chip href matches share-offsite URL with UTM-encoded params", () => {
		const link = screen.getByRole("link", { name: "Share on LinkedIn" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(
			/^https:\/\/www\.linkedin\.com\/sharing\/share-offsite\/\?url=/,
		);
		// UTM params are encoded inside the `url` query param
		expect(href).toContain(encodeURIComponent("utm_source=blog"));
		expect(href).toContain(encodeURIComponent("utm_medium=share"));
	});

	it("X chip href matches twitter.com tweet intent with UTM-encoded URL", () => {
		const link = screen.getByRole("link", { name: "Share on X" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/^https:\/\/twitter\.com\/intent\/tweet\?/);
		expect(href).toContain(encodeURIComponent("utm_source=blog"));
		expect(href).toContain(encodeURIComponent("utm_medium=share"));
	});

	it("Bluesky chip href matches bsky.app compose intent", () => {
		const link = screen.getByRole("link", { name: "Share on Bluesky" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/^https:\/\/bsky\.app\/intent\/compose\?/);
		expect(href).toContain(encodeURIComponent("utm_source=blog"));
	});

	it("HN chip href matches news.ycombinator.com/submitlink", () => {
		const link = screen.getByRole("link", { name: "Share on Hacker News" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/news\.ycombinator\.com\/submitlink/);
		expect(href).toContain(encodeURIComponent("utm_source=blog"));
	});

	it("Reddit chip href matches reddit.com/submit", () => {
		const link = screen.getByRole("link", { name: "Share on Reddit" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/reddit\.com\/submit/);
		expect(href).toContain(encodeURIComponent("utm_source=blog"));
	});

	it("Email chip href starts with mailto: and contains title + UTM URL", () => {
		const link = screen.getByRole("link", { name: "Share on Email" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/^mailto:\?subject=/);
		expect(href).toContain(encodeURIComponent(POST_TITLE));
		expect(href).toContain(encodeURIComponent("utm_source=blog"));
	});
});

// ── Unit: Copy Link chip (AC-3) ───────────────────────────────────────────────

describe("unit: Copy Link chip (AC-3)", () => {
	let clipboardSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
		clipboardSpy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: clipboardSpy },
			writable: true,
			configurable: true,
		});
	});

	it("clicking Copy Link calls navigator.clipboard.writeText with UTM-tagged URL", async () => {
		renderShare();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		await act(async () => {
			fireEvent.click(btn);
		});
		expect(clipboardSpy).toHaveBeenCalledWith(UTM_URL);
	});

	it("aria-live region renders 'Copied!' after clicking Copy Link", async () => {
		renderShare();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		await act(async () => {
			fireEvent.click(btn);
		});
		const status = screen.getByRole("status");
		expect(status.textContent).toBe("Copied!");
	});

	it("aria-live region is empty before clicking Copy Link", async () => {
		renderShare();
		await act(async () => {});
		const status = screen.getByRole("status");
		expect(status.textContent).toBe("");
	});

	it("Copy Link shows 'Copiado!' in pt-br locale", async () => {
		cleanup();
		render(
			React.createElement(PostShare, {
				postUrl: POST_URL,
				postTitle: POST_TITLE,
				locale: "pt-br",
			}),
		);
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copiar link" });
		await act(async () => {
			fireEvent.click(btn);
		});
		const status = screen.getByRole("status");
		expect(status.textContent).toBe("Copiado!");
	});
});

// ── Unit: native share branch (AC-4) ─────────────────────────────────────────

describe("unit: native share branch — navigator.share available (AC-4)", () => {
	let shareSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		shareSpy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "share", {
			value: shareSpy,
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
	});

	it("renders a single Share button instead of chip row after mount", async () => {
		renderShare();
		await act(async () => {});
		const shareBtn = screen.getByRole("button", { name: "Share" });
		expect(shareBtn).toBeDefined();
		// No platform link chips visible
		expect(screen.queryAllByRole("link").length).toBe(0);
	});

	it("renders Share button with Share2 icon (via aria-hidden child)", async () => {
		renderShare();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Share" });
		// Button contains an SVG (lucide Share2 icon)
		expect(btn.querySelector("svg")).not.toBeNull();
	});

	it("Share button click calls navigator.share with UTM url, title, and text", async () => {
		renderShare();
		await act(async () => {});
		const shareBtn = screen.getByRole("button", { name: "Share" });
		await act(async () => {
			fireEvent.click(shareBtn);
		});
		expect(shareSpy).toHaveBeenCalledWith({
			url: UTM_URL,
			title: POST_TITLE,
			text: POST_TITLE,
		});
	});

	it("Share button text reads 'Compartilhar' in pt-br locale", async () => {
		cleanup();
		render(
			React.createElement(PostShare, {
				postUrl: POST_URL,
				postTitle: POST_TITLE,
				locale: "pt-br",
			}),
		);
		await act(async () => {});
		expect(screen.getByRole("button", { name: "Compartilhar" })).toBeDefined();
	});
});

// ── Unit: AbortError handling (AC-5) ──────────────────────────────────────────

describe("unit: AbortError from navigator.share is silent (AC-5)", () => {
	let shareSpy: ReturnType<typeof vi.fn>;

	beforeEach(() => {
		shareSpy = vi.fn();
		Object.defineProperty(navigator, "share", {
			value: shareSpy,
			writable: true,
			configurable: true,
		});
	});

	afterEach(() => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
	});

	it("AbortError rejection does NOT call console.error (user dismissed sheet)", async () => {
		const abortError = new DOMException("Share cancelled", "AbortError");
		shareSpy.mockRejectedValueOnce(abortError);
		const consoleSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		renderShare();
		await act(async () => {});
		const shareBtn = screen.getByRole("button", { name: "Share" });
		await act(async () => {
			fireEvent.click(shareBtn);
		});

		expect(consoleSpy).not.toHaveBeenCalled();
	});

	it("non-AbortError rejection calls console.error once", async () => {
		shareSpy.mockRejectedValueOnce(new Error("Network error"));
		const consoleSpy = vi
			.spyOn(console, "error")
			.mockImplementation(() => undefined);

		renderShare();
		await act(async () => {});
		const shareBtn = screen.getByRole("button", { name: "Share" });
		await act(async () => {
			fireEvent.click(shareBtn);
		});

		expect(consoleSpy).toHaveBeenCalledTimes(1);
	});
});
