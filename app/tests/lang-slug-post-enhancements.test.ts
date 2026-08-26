import "./happydom";
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";

const { act, cleanup, render, waitFor } = await import(
	"@testing-library/react"
);

import { createElement } from "react";
import type { Post } from "#/db/schema";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import * as realEnhancements from "#/lib/mdx/post-enhancements.client";

const realInitPostEnhancements = realEnhancements.initPostEnhancements;

import {
	COPY_BUTTON_CLASS,
	RAW_SOURCE_ATTR,
} from "#/lib/mdx/copy-button.transformer";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Replace the co-located server module so importing the route never pulls the
// real createServerFn / Drizzle chain into HappyDOM. PostView only invokes
// incrementViewCount (best-effort, `.catch()`'d) at runtime.
mock.module("#/routes/{-$locale}/$slug.server", () => ({
	getPostBySlugWithLang: jest.fn(),
	incrementViewCount: jest.fn(() => Promise.resolve()),
}));

// Stub the child components: PostHeader / PostFooter render <Link>, which needs a
// RouterProvider. Stubbing them keeps the test focused on PostView's own wiring
// (body ref + initializer effect) without standing up a router.
mock.module("#/components/ui/post-header", () => ({ PostHeader: () => null }));
mock.module("#/components/ui/post-footer", () => ({ PostFooter: () => null }));
mock.module("#/components/ui/post-share", () => ({ PostShare: () => null }));
mock.module("#/components/ui/translation-notice", () => ({
	TranslationNotice: () => null,
}));
mock.module("#/components/ui/static-page-profile", () => ({
	StaticPageProfile: () => null,
}));

// Wrap the REAL initializer in a spy: assert the call shape and the returned
// cleanup, while preserving the genuine copy-wiring / embed-mount behavior that
// the integration test exercises end-to-end.
mock.module("#/lib/mdx/post-enhancements.client", () => {
	return {
		...realEnhancements,
		initPostEnhancements: jest.fn((root: HTMLElement, opts) => {
			const realCleanup = realInitPostEnhancements(root, opts);
			return jest.fn(realCleanup);
		}),
	};
});

const { initPostEnhancements } = await import(
	"#/lib/mdx/post-enhancements.client"
);
const { PostView } = await import("#/routes/{-$locale}/$slug");

import type { PostLoaderResult } from "#/routes/{-$locale}/$slug.server";

const initSpy = initPostEnhancements as unknown as ReturnType<typeof jest.fn>;

// TicTacToe headings per locale — proof the embed island mounted with its locale.
const TTT_HEADING_EN = "Try it: tic-tac-toe";
const TTT_HEADING_PTBR = "Experimente: jogo da velha";

// Static HTML carrying both enhancement markers, mirroring renderMdx output: a
// fenced block (raw-source <pre> + copy button) and an embed placeholder.
const HTML_WITH_FEATURES =
	`<div class="code-block-wrapper relative group">` +
	`<button type="button" class="${COPY_BUTTON_CLASS}"></button>` +
	`<pre ${RAW_SOURCE_ATTR}="const a = 1;"><code>const a = 1;</code></pre></div>` +
	`<div data-embed="tic-tac-toe" data-props="{}">` +
	`<span class="embed-fallback">Interactive demo — requires JavaScript.</span></div>`;

// A distinct second body (different raw source) so navigating to it changes the
// `html` key — exercises the post→post in-place body-swap path, not a same-html
// re-render.
const HTML_WITH_FEATURES_B =
	`<div class="code-block-wrapper relative group">` +
	`<button type="button" class="${COPY_BUTTON_CLASS}"></button>` +
	`<pre ${RAW_SOURCE_ATTR}="const b = 2;"><code>const b = 2;</code></pre></div>` +
	`<div data-embed="tic-tac-toe" data-props="{}">` +
	`<span class="embed-fallback">Interactive demo — requires JavaScript.</span></div>`;

function makePost(overrides: Partial<Post> = {}): Post {
	return {
		id: 1,
		filePath: "/content/en/hello.mdx",
		slug: "hello",
		lang: "en",
		title: "Hello",
		description: "A post.",
		publishedAt: new Date("2026-05-02"),
		viewCount: 0,
		indexedAt: new Date("2026-05-02"),
		category: null,
		series: null,
		seriesPart: null,
		draft: null,
		...overrides,
	};
}

function makeData(overrides: Partial<PostLoaderResult> = {}): PostLoaderResult {
	return {
		kind: "post",
		post: makePost(overrides.post),
		html: "<p>body</p>",
		requestedLang: "en",
		notTranslated: false,
		availableLang: null,
		alternateLang: null,
		ogImagePath: "https://example.com/og.png",
		...overrides,
	};
}

function clipboardMock(impl: () => Promise<void>) {
	const writeText = jest.fn(impl);
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
		writable: true,
	});
	return writeText;
}

beforeEach(() => {
	jest.clearAllMocks();
	sessionStorage.clear();
});

afterEach(() => {
	cleanup();
});

// ─── AC-1: no slug-gated TicTacToe branch ─────────────────────────────────────

describe("PostView: slug hardcode removal (AC-1)", () => {
	test("renders the body container without a slug-gated TicTacToe branch", async () => {
		// The formerly-hardcoded slug — proves the conditional mount is gone: the
		// TicTacToe heading must NOT appear for a plain body lacking an embed.
		render(
			createElement(PostView, {
				data: makeData({
					post: makePost({ slug: "spec-driven-development-with-compozy" }),
					html: "<p>plain body, no embed</p>",
				}),
			}),
		);

		expect(document.body.textContent).not.toContain(TTT_HEADING_EN);
		// The initializer is dynamically imported inside the effect, so it resolves
		// on a microtask after render — wait for the call before asserting on it.
		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		// The static MDX HTML is injected into the container handed to the initializer.
		const container = initSpy.mock.calls[0]?.[0];
		expect(container).toBeInstanceOf(HTMLElement);
		expect(container?.innerHTML).toContain("plain body, no embed");
	});
});

// ─── AC-2: initializer invoked with container + requested locale ──────────────

describe("PostView: initializer wiring (AC-2)", () => {
	test("invokes initPostEnhancements once with the body container and en labels", async () => {
		render(createElement(PostView, { data: makeData() }));

		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		const [root, opts] = initSpy.mock.calls[0] ?? [];
		expect(root).toBeInstanceOf(HTMLElement);
		expect(opts).toEqual({
			locale: "en",
			copyLabels: {
				copy: strings.en.codeCopy.copy,
				copied: strings.en.codeCopy.copied,
			},
		});
	});

	test("forwards the pt-br requested locale and localized copy labels", async () => {
		render(
			createElement(PostView, {
				data: makeData({
					requestedLang: "pt-br" as Locale,
					post: makePost({ lang: "pt-br" }),
				}),
			}),
		);

		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		const [, opts] = initSpy.mock.calls[0] ?? [];
		expect(opts).toEqual({
			locale: "pt-br",
			copyLabels: {
				copy: strings["pt-br"].codeCopy.copy,
				copied: strings["pt-br"].codeCopy.copied,
			},
		});
	});

	// ─── Regression: untranslated fallback post must NOT flip locale on hydration ──
	// (slug, pt-br) -> fallback en: the server SSRs the body in English (post.lang),
	// so the client initializer must use the served content language (post.lang),
	// not the requested URL locale, or the copy buttons / embed re-label themselves
	// in pt-br after hydration while the article body stays English (issue_001 r5).
	test("untranslated fallback post initializes enhancements in the served content language, not the requested locale", async () => {
		render(
			createElement(PostView, {
				data: makeData({
					// URL asked for pt-br, but only the en post exists.
					requestedLang: "pt-br" as Locale,
					post: makePost({ lang: "en" }),
					notTranslated: true,
					availableLang: "en" as Locale,
					html: HTML_WITH_FEATURES,
				}),
			}),
		);

		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		const [, opts] = initSpy.mock.calls[0] ?? [];
		// Aligned with the English body the server rendered — NOT the pt-br URL locale.
		expect(opts).toEqual({
			locale: "en",
			copyLabels: {
				copy: strings.en.codeCopy.copy,
				copied: strings.en.codeCopy.copied,
			},
		});

		// The embed mounts in English too — proof the hydrated UI matches the body.
		await waitFor(() => {
			const node = document.querySelector<HTMLElement>("[data-embed]");
			expect(node?.textContent).toContain(TTT_HEADING_EN);
		});
		expect(document.body.textContent).not.toContain(TTT_HEADING_PTBR);
		const button = document.querySelector<HTMLButtonElement>(
			`button.${COPY_BUTTON_CLASS}`,
		);
		expect(button?.getAttribute("aria-label")).toBe(strings.en.codeCopy.copy);
	});
});

// ─── AC-3: cleanup on unmount ─────────────────────────────────────────────────

describe("PostView: initializer cleanup (AC-3)", () => {
	test("runs the initializer's cleanup when the post unmounts", async () => {
		const { unmount } = render(createElement(PostView, { data: makeData() }));

		// The initializer resolves on a microtask (dynamic import) — wait for it
		// before capturing the cleanup it returned.
		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		// The spy wraps the real cleanup returned by initPostEnhancements.
		const cleanupFn = initSpy.mock.results[0]?.value as ReturnType<
			typeof jest.fn
		>;
		expect(cleanupFn).not.toHaveBeenCalled();

		unmount();
		expect(cleanupFn).toHaveBeenCalledTimes(1);
	});

	test("tears down and re-initializes exactly once on post change (no stale double-mount)", async () => {
		const { rerender } = render(
			createElement(PostView, {
				data: makeData({ html: HTML_WITH_FEATURES }),
			}),
		);

		// First init resolves on a microtask (dynamic import); capture its cleanup
		// and wait for the embed to mount over post A's marker.
		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		const firstCleanup = initSpy.mock.results[0]?.value as ReturnType<
			typeof jest.fn
		>;
		await waitFor(() => {
			const node = document.querySelector<HTMLElement>("[data-embed]");
			expect(node?.textContent).toContain(TTT_HEADING_EN);
		});

		// Navigate to a different post on the SAME instance: new html + pt-br locale.
		// This is the post→post body-swap path that issue_001 (r2) regresses on and
		// the AC-3 unmount-only test never covered.
		rerender(
			createElement(PostView, {
				data: makeData({
					html: HTML_WITH_FEATURES_B,
					requestedLang: "pt-br" as Locale,
					post: makePost({ id: 2, slug: "second", lang: "pt-br" }),
				}),
			}),
		);

		// The first post's cleanup ran exactly once, and the initializer re-ran
		// exactly once more — no third stale run from the prior import promise.
		await waitFor(() => expect(firstCleanup).toHaveBeenCalledTimes(1));
		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(2));

		// The container holds exactly one mounted embed (re-rendered in the new
		// pt-br locale) and one copy live region — proof no duplicate roots survived
		// the post change and the re-init used the new locale. The copy live region
		// is `output[aria-atomic="true"]`; TicTacToe's own status <output> has no
		// aria-atomic, so this selector isolates the copy-wiring region.
		await waitFor(() => {
			const embeds = document.querySelectorAll("[data-embed]");
			expect(embeds).toHaveLength(1);
			expect(embeds[0]?.textContent).toContain(TTT_HEADING_PTBR);
		});
		expect(
			document.querySelectorAll('output[aria-atomic="true"]'),
		).toHaveLength(1);
	});
});

// ─── Integration: embed mounts + copy button works through the route ──────────

describe("PostView: enhancements work end-to-end (integration)", () => {
	test("mounts the embed island and wires a working copy button over the body", async () => {
		const writeText = clipboardMock(() => Promise.resolve());

		render(
			createElement(PostView, {
				data: makeData({ html: HTML_WITH_FEATURES }),
			}),
		);

		// The initializer is dynamically imported, so the embed island mounts on a
		// microtask after render — wait for the placeholder to be replaced by the
		// mounted TicTacToe island.
		await waitFor(() => {
			const node = document.querySelector<HTMLElement>("[data-embed]");
			expect(node?.textContent).toContain(TTT_HEADING_EN);
		});
		const embed = document.querySelector<HTMLElement>("[data-embed]");
		expect(embed?.querySelector(".embed-fallback")).toBeNull();

		// The copy button copies the stashed raw source via the Clipboard API.
		const button = document.querySelector<HTMLButtonElement>(
			`button.${COPY_BUTTON_CLASS}`,
		);
		expect(button?.getAttribute("aria-label")).toBe(strings.en.codeCopy.copy);

		await act(async () => {
			button?.click();
		});

		expect(writeText).toHaveBeenCalledWith("const a = 1;");
	});
});
