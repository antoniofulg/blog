// @vitest-environment jsdom
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { createElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Post } from "#/db/schema";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import {
	COPY_BUTTON_CLASS,
	RAW_SOURCE_ATTR,
} from "#/lib/mdx/copy-button.transformer";

// ─── Mocks ────────────────────────────────────────────────────────────────────

// Replace the co-located server module so importing the route never pulls the
// real createServerFn / Drizzle chain into jsdom. PostView only invokes
// incrementViewCount (best-effort, `.catch()`'d) at runtime.
vi.mock("#/routes/{-$locale}/$slug.server", () => ({
	getPostBySlugWithLang: vi.fn(),
	incrementViewCount: vi.fn(() => Promise.resolve()),
}));

// Stub the child components: PostHeader / PostFooter render <Link>, which needs a
// RouterProvider. Stubbing them keeps the test focused on PostView's own wiring
// (body ref + initializer effect) without standing up a router.
vi.mock("#/components/ui/post-header", () => ({ PostHeader: () => null }));
vi.mock("#/components/ui/post-footer", () => ({ PostFooter: () => null }));
vi.mock("#/components/ui/post-share", () => ({ PostShare: () => null }));
vi.mock("#/components/ui/translation-notice", () => ({
	TranslationNotice: () => null,
}));
vi.mock("#/components/ui/static-page-profile", () => ({
	StaticPageProfile: () => null,
}));

// Wrap the REAL initializer in a spy: assert the call shape and the returned
// cleanup, while preserving the genuine copy-wiring / embed-mount behavior that
// the integration test exercises end-to-end.
vi.mock("#/lib/mdx/post-enhancements.client", async (importActual) => {
	const actual =
		await importActual<typeof import("#/lib/mdx/post-enhancements.client")>();
	return {
		...actual,
		initPostEnhancements: vi.fn((root: HTMLElement, opts) => {
			const realCleanup = actual.initPostEnhancements(root, opts);
			return vi.fn(realCleanup);
		}),
	};
});

import { initPostEnhancements } from "#/lib/mdx/post-enhancements.client";
import { PostView } from "#/routes/{-$locale}/$slug";
import type { PostLoaderResult } from "#/routes/{-$locale}/$slug.server";

const initSpy = vi.mocked(initPostEnhancements);

// TicTacToe headings per locale — proof the embed island mounted with its locale.
const TTT_HEADING_EN = "Try it: tic-tac-toe";

// Static HTML carrying both enhancement markers, mirroring renderMdx output: a
// fenced block (raw-source <pre> + copy button) and an embed placeholder.
const HTML_WITH_FEATURES =
	`<pre ${RAW_SOURCE_ATTR}="const a = 1;"><code>const a = 1;</code>` +
	`<button type="button" class="${COPY_BUTTON_CLASS}"></button></pre>` +
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
	const writeText = vi.fn(impl);
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
		writable: true,
	});
	return writeText;
}

beforeEach(() => {
	vi.clearAllMocks();
	sessionStorage.clear();
});

afterEach(() => {
	cleanup();
});

// ─── AC-1: no slug-gated TicTacToe branch ─────────────────────────────────────

describe("PostView: slug hardcode removal (AC-1)", () => {
	it("renders the body container without a slug-gated TicTacToe branch", async () => {
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
	it("invokes initPostEnhancements once with the body container and en labels", async () => {
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

	it("forwards the pt-br requested locale and localized copy labels", async () => {
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
});

// ─── AC-3: cleanup on unmount ─────────────────────────────────────────────────

describe("PostView: initializer cleanup (AC-3)", () => {
	it("runs the initializer's cleanup when the post unmounts", async () => {
		const { unmount } = render(createElement(PostView, { data: makeData() }));

		// The initializer resolves on a microtask (dynamic import) — wait for it
		// before capturing the cleanup it returned.
		await waitFor(() => expect(initSpy).toHaveBeenCalledTimes(1));
		// The spy wraps the real cleanup returned by initPostEnhancements.
		const cleanupFn = initSpy.mock.results[0]?.value as ReturnType<
			typeof vi.fn
		>;
		expect(cleanupFn).not.toHaveBeenCalled();

		unmount();
		expect(cleanupFn).toHaveBeenCalledTimes(1);
	});
});

// ─── Integration: embed mounts + copy button works through the route ──────────

describe("PostView: enhancements work end-to-end (integration)", () => {
	it("mounts the embed island and wires a working copy button over the body", async () => {
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
