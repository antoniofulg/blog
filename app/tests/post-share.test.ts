// @vitest-environment jsdom
/**
 * Unit tests for app/components/ui/post-share.tsx
 *
 * Tests cover:
 *   AC-1: Inline variant renders 6 chips with correct labels (en + pt-br)
 *   AC-2: Per-platform UTM-tagged URLs in chip href attributes
 *   AC-3: Copy chip writes canonical URL (no UTM) + "Copied!" aria-live toast
 *   AC-4: Native share swap applies only to inline variant
 *   AC-5: Dropdown variant ignores navigator.share — always renders all 6 chips
 *   AC-6: Dropdown variant trigger button + popover with role="menu"/"menuitem"
 *   AC-7: Timer cleanup on unmount (no orphaned timers)
 *   AC-8: AbortError from navigator.share is silent; other errors log
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

// ── JSDOM polyfills for Radix UI ──────────────────────────────────────────────

// Radix Popover's @radix-ui/react-use-size uses ResizeObserver internally.
// JSDOM does not ship ResizeObserver — mock a no-op stub.
global.ResizeObserver = class ResizeObserver {
	observe() {}
	unobserve() {}
	disconnect() {}
};

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
import { buildTaggedUrl, PostShare } from "#/components/ui/post-share";

// ── Constants ─────────────────────────────────────────────────────────────────

const POST_URL = "https://blog.example/post";
const POST_SLUG = "post";
const POST_TITLE = "Hello World";

// ── Helpers ───────────────────────────────────────────────────────────────────

function renderInline(locale: "en" | "pt-br" = "en") {
	return render(
		React.createElement(PostShare, {
			postUrl: POST_URL,
			postSlug: POST_SLUG,
			postTitle: POST_TITLE,
			locale,
			variant: "inline",
		}),
	);
}

function renderDropdown(locale: "en" | "pt-br" = "en") {
	return render(
		React.createElement(PostShare, {
			postUrl: POST_URL,
			postSlug: POST_SLUG,
			postTitle: POST_TITLE,
			locale,
			variant: "dropdown",
		}),
	);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
});

// ── Unit: buildTaggedUrl (pure function) ──────────────────────────────────────

describe("unit: buildTaggedUrl", () => {
	it("adds per-platform UTM params to absolute URL", () => {
		expect(
			buildTaggedUrl("https://blog.example/post", "linkedin", "post"),
		).toBe(
			"https://blog.example/post?utm_source=linkedin&utm_medium=social&utm_campaign=post",
		);
	});

	it("adds utm_source=twitter for twitter platform", () => {
		const result = buildTaggedUrl(
			"https://blog.example/post",
			"twitter",
			"post",
		);
		expect(result).toContain("utm_source=twitter");
		expect(result).toContain("utm_medium=social");
		expect(result).toContain("utm_campaign=post");
	});

	it("returns canonical URL unchanged for 'copy' platform (no UTM tagging)", () => {
		expect(buildTaggedUrl("https://blog.example/post", "copy", "post")).toBe(
			"https://blog.example/post",
		);
	});

	it("fallback: appends UTM params to relative URL without throwing", () => {
		const result = buildTaggedUrl("/my-slug", "reddit", "my-slug");
		expect(result).toContain("utm_source=reddit");
		expect(result).toContain("utm_medium=social");
		expect(result).toContain("utm_campaign=my-slug");
	});

	it("does NOT double-add utm_source if already present (URL constructor deduplicates)", () => {
		const result = buildTaggedUrl(
			"https://blog.example/post?utm_source=other",
			"linkedin",
			"post",
		);
		expect(result).toContain("utm_source=linkedin");
		const count = (result.match(/utm_source/g) ?? []).length;
		expect(count).toBe(1);
	});
});

// ── Unit: inline variant — 6 chips (AC-1) ────────────────────────────────────

describe("unit: inline variant — 6 chips rendered when navigator.share undefined (AC-1)", () => {
	beforeEach(() => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
	});

	it("renders 5 platform link chips (X, LinkedIn, Reddit, WhatsApp, Email) as <a>", async () => {
		renderInline();
		await act(async () => {});
		const links = screen.getAllByRole("link");
		expect(links.length).toBe(5);
	});

	it("renders the Copy link button (6th chip)", async () => {
		renderInline();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		expect(btn).toBeDefined();
	});

	it("renders all 6 chips with English labels", async () => {
		renderInline("en");
		await act(async () => {});
		expect(screen.getByRole("link", { name: "Share on X" })).toBeDefined();
		expect(
			screen.getByRole("link", { name: "Share on LinkedIn" }),
		).toBeDefined();
		expect(screen.getByRole("link", { name: "Share on Reddit" })).toBeDefined();
		expect(
			screen.getByRole("link", { name: "Share on WhatsApp" }),
		).toBeDefined();
		expect(screen.getByRole("link", { name: "Share on Email" })).toBeDefined();
		expect(screen.getByRole("button", { name: "Copy link" })).toBeDefined();
	});

	it("renders all 6 chips with pt-br labels", async () => {
		renderInline("pt-br");
		await act(async () => {});
		expect(
			screen.getByRole("link", { name: "Compartilhar no X" }),
		).toBeDefined();
		expect(
			screen.getByRole("link", { name: "Compartilhar no LinkedIn" }),
		).toBeDefined();
		expect(
			screen.getByRole("link", { name: "Compartilhar no Reddit" }),
		).toBeDefined();
		expect(
			screen.getByRole("link", { name: "Compartilhar no WhatsApp" }),
		).toBeDefined();
		expect(
			screen.getByRole("link", { name: "Compartilhar no E-mail" }),
		).toBeDefined();
		expect(screen.getByRole("button", { name: "Copiar link" })).toBeDefined();
	});

	it("does NOT render a native Share button", async () => {
		renderInline();
		await act(async () => {});
		const shareBtn = screen.queryByRole("button", { name: "Share" });
		expect(shareBtn).toBeNull();
	});

	it("all platform link chips open in a new tab (target=_blank)", async () => {
		renderInline();
		await act(async () => {});
		const links = screen.getAllByRole("link");
		for (const link of links) {
			expect(link.getAttribute("target")).toBe("_blank");
			expect(link.getAttribute("rel")).toBe("noopener noreferrer");
		}
	});
});

// ── Unit: inline variant — per-platform UTM URLs (AC-2) ──────────────────────

describe("unit: inline variant — chip hrefs contain per-platform UTM params (AC-2)", () => {
	beforeEach(async () => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
		renderInline();
		await act(async () => {});
	});

	it("LinkedIn chip href has utm_source=linkedin", () => {
		const link = screen.getByRole("link", { name: "Share on LinkedIn" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/linkedin\.com\/sharing\/share-offsite\//);
		expect(href).toContain(encodeURIComponent("utm_source=linkedin"));
		expect(href).toContain(encodeURIComponent("utm_medium=social"));
		expect(href).toContain(encodeURIComponent(`utm_campaign=${POST_SLUG}`));
	});

	it("X chip href has utm_source=twitter", () => {
		const link = screen.getByRole("link", { name: "Share on X" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/twitter\.com\/intent\/tweet/);
		expect(href).toContain(encodeURIComponent("utm_source=twitter"));
		expect(href).toContain(encodeURIComponent("utm_medium=social"));
	});

	it("Reddit chip href has utm_source=reddit", () => {
		const link = screen.getByRole("link", { name: "Share on Reddit" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/reddit\.com\/submit/);
		expect(href).toContain(encodeURIComponent("utm_source=reddit"));
	});

	it("WhatsApp chip href has utm_source=whatsapp", () => {
		const link = screen.getByRole("link", { name: "Share on WhatsApp" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/wa\.me/);
		expect(href).toContain(encodeURIComponent("utm_source=whatsapp"));
	});

	it("Email chip href starts with mailto: and has utm_source=email", () => {
		const link = screen.getByRole("link", { name: "Share on Email" });
		const href = link.getAttribute("href") ?? "";
		expect(href).toMatch(/^mailto:\?/);
		expect(href).toContain(encodeURIComponent(POST_TITLE));
		expect(href).toContain(encodeURIComponent("utm_source=email"));
	});
});

// ── Unit: Copy chip (AC-3) ────────────────────────────────────────────────────

describe("unit: Copy chip writes canonical URL (no UTM) and shows confirmation (AC-3)", () => {
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

	it("clicking Copy link in inline variant calls clipboard.writeText with canonical URL (no UTM)", async () => {
		renderInline();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		await act(async () => {
			fireEvent.click(btn);
		});
		// buildTaggedUrl for "copy" returns canonicalUrl unchanged
		expect(clipboardSpy).toHaveBeenCalledWith(POST_URL);
	});

	it("aria-live region shows 'Copied!' after clicking Copy link (inline)", async () => {
		renderInline();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		await act(async () => {
			fireEvent.click(btn);
		});
		const status = screen.getByRole("status");
		expect(status.textContent).toBe("Copied!");
	});

	it("aria-live region is empty before clicking Copy link", async () => {
		renderInline();
		await act(async () => {});
		const status = screen.getByRole("status");
		expect(status.textContent).toBe("");
	});

	it("Copy chip in pt-br locale shows 'Copiado!'", async () => {
		cleanup();
		render(
			React.createElement(PostShare, {
				postUrl: POST_URL,
				postSlug: POST_SLUG,
				postTitle: POST_TITLE,
				locale: "pt-br",
				variant: "inline",
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

// ── Unit: native share branch — inline only (AC-4) ───────────────────────────

describe("unit: native share branch applies only to inline variant (AC-4)", () => {
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

	it("inline: renders a single Share button instead of chip row when navigator.share is defined", async () => {
		renderInline();
		await act(async () => {});
		expect(screen.getByRole("button", { name: "Share" })).toBeDefined();
		expect(screen.queryAllByRole("link").length).toBe(0);
	});

	it("inline: Share button has SVG icon", async () => {
		renderInline();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Share" });
		expect(btn.querySelector("svg")).not.toBeNull();
	});

	it("inline: clicking Share button calls navigator.share with a campaign-tagged URL (utm_medium=social, no utm_source)", async () => {
		renderInline();
		await act(async () => {});
		const shareBtn = screen.getByRole("button", { name: "Share" });
		await act(async () => {
			fireEvent.click(shareBtn);
		});
		expect(shareSpy).toHaveBeenCalledTimes(1);
		const arg = shareSpy.mock.calls[0][0] as {
			url: string;
			title: string;
			text: string;
		};
		expect(arg.title).toBe(POST_TITLE);
		expect(arg.text).toBe(POST_TITLE);
		// Native share carries campaign attribution but no per-platform source —
		// the OS routes it to an unknown destination (ADR-001).
		const shared = new URL(arg.url);
		expect(shared.origin + shared.pathname).toBe(POST_URL);
		expect(shared.searchParams.get("utm_medium")).toBe("social");
		expect(shared.searchParams.get("utm_campaign")).toBe(POST_SLUG);
		expect(shared.searchParams.has("utm_source")).toBe(false);
	});

	it("inline: Share button text reads 'Compartilhar' in pt-br locale", async () => {
		cleanup();
		render(
			React.createElement(PostShare, {
				postUrl: POST_URL,
				postSlug: POST_SLUG,
				postTitle: POST_TITLE,
				locale: "pt-br",
				variant: "inline",
			}),
		);
		await act(async () => {});
		expect(screen.getByRole("button", { name: "Compartilhar" })).toBeDefined();
	});
});

// ── Unit: dropdown variant ignores navigator.share (AC-5) ────────────────────

describe("unit: dropdown variant — never swaps to native share (AC-5)", () => {
	afterEach(() => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
	});

	it("renders trigger button even when navigator.share is undefined", async () => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
		renderDropdown();
		await act(async () => {});
		expect(screen.getByRole("button", { name: "Share post" })).toBeDefined();
	});

	it("renders trigger button even when navigator.share is a function", async () => {
		Object.defineProperty(navigator, "share", {
			value: vi.fn().mockResolvedValue(undefined),
			writable: true,
			configurable: true,
		});
		renderDropdown();
		await act(async () => {});
		// Still shows the icon-button trigger, NOT the native Share button
		expect(screen.getByRole("button", { name: "Share post" })).toBeDefined();
		// The inline-variant "Share" text-label button should NOT be present
		expect(screen.queryByRole("button", { name: "Share" })).toBeNull();
	});
});

// ── Unit: dropdown variant — Radix Popover open/close + ARIA (AC-6) ──────────

describe("unit: dropdown variant — popover open/close + ARIA roles (AC-6)", () => {
	beforeEach(() => {
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});
	});

	it("renders a single trigger button with aria-label='Share post'", async () => {
		renderDropdown();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Share post" });
		expect(trigger).toBeDefined();
	});

	it("popover content is not visible before trigger click", async () => {
		renderDropdown();
		await act(async () => {});
		// The menu should not be present in the DOM before opening
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("clicking trigger opens popover with role='menu'", async () => {
		renderDropdown();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Share post" });
		await act(async () => {
			fireEvent.click(trigger);
		});
		const menu = screen.getByRole("menu");
		expect(menu).toBeDefined();
	});

	it("open popover contains all 6 chips", async () => {
		renderDropdown();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Share post" });
		await act(async () => {
			fireEvent.click(trigger);
		});
		const items = screen.getAllByRole("menuitem");
		expect(items.length).toBe(6);
	});

	it("chips inside open popover are buttons that copy the per-platform UTM URL", async () => {
		const writeText = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			configurable: true,
			value: { writeText },
		});

		renderDropdown();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Share post" });
		await act(async () => {
			fireEvent.click(trigger);
		});

		// Admin dropdown chips are <button> not <a> — clicking writes the
		// tagged URL to the clipboard instead of opening a share intent.
		// Authors typically grab a URL to paste into Slack / DMs / email,
		// so the admin variant never bounces through twitter.com/intent.
		const linkedinItem = screen.getAllByRole("menuitem").find((el) => {
			const label = el.getAttribute("aria-label") ?? "";
			return label.includes("LinkedIn");
		});
		expect(linkedinItem).toBeDefined();
		expect((linkedinItem as HTMLElement).tagName).toBe("BUTTON");

		await act(async () => {
			fireEvent.click(linkedinItem as HTMLElement);
		});

		expect(writeText).toHaveBeenCalledTimes(1);
		const copied = writeText.mock.calls[0]?.[0] as string;
		expect(copied).toContain("utm_source=linkedin");
		expect(copied).toContain("utm_medium=social");
	});

	it("pressing Escape closes the popover", async () => {
		renderDropdown();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Share post" });
		await act(async () => {
			fireEvent.click(trigger);
		});
		// Confirm it's open
		expect(screen.getByRole("menu")).toBeDefined();
		// Press Esc
		await act(async () => {
			fireEvent.keyDown(document, { key: "Escape", code: "Escape" });
		});
		expect(screen.queryByRole("menu")).toBeNull();
	});

	it("Copy chip in open dropdown calls clipboard.writeText with canonical URL (no UTM)", async () => {
		const clipboardSpy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: clipboardSpy },
			writable: true,
			configurable: true,
		});

		renderDropdown();
		await act(async () => {});
		const trigger = screen.getByRole("button", { name: "Share post" });
		await act(async () => {
			fireEvent.click(trigger);
		});

		const copyItem = screen.getAllByRole("menuitem").find((el) => {
			const label = el.getAttribute("aria-label") ?? "";
			return label === "Copy link";
		});
		expect(copyItem).toBeDefined();
		await act(async () => {
			fireEvent.click(copyItem as HTMLElement);
		});
		expect(clipboardSpy).toHaveBeenCalledWith(POST_URL);
	});
});

// ── Unit: timer cleanup on unmount (AC-7) ────────────────────────────────────

describe("unit: timer cleanup on unmount (AC-7)", () => {
	it("unmounting component clears the copy timer without throwing", async () => {
		const clearTimeoutSpy = vi.spyOn(global, "clearTimeout");
		const clipboardSpy = vi.fn().mockResolvedValue(undefined);
		Object.defineProperty(navigator, "clipboard", {
			value: { writeText: clipboardSpy },
			writable: true,
			configurable: true,
		});
		Object.defineProperty(navigator, "share", {
			value: undefined,
			writable: true,
			configurable: true,
		});

		const { unmount } = renderInline();
		await act(async () => {});
		const btn = screen.getByRole("button", { name: "Copy link" });
		await act(async () => {
			fireEvent.click(btn);
		});
		// Unmount while copy timer is pending
		unmount();
		// clearTimeout must have been called (cleanup effect)
		expect(clearTimeoutSpy).toHaveBeenCalled();
	});
});

// ── Unit: AbortError handling (AC-8) ─────────────────────────────────────────

describe("unit: AbortError from navigator.share is silent (AC-8)", () => {
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

		renderInline();
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

		renderInline();
		await act(async () => {});
		const shareBtn = screen.getByRole("button", { name: "Share" });
		await act(async () => {
			fireEvent.click(shareBtn);
		});

		expect(consoleSpy).toHaveBeenCalledTimes(1);
	});
});
