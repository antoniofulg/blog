// @vitest-environment jsdom
import { act, cleanup } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	COPY_BUTTON_CLASS,
	RAW_SOURCE_ATTR,
} from "#/lib/mdx/copy-button.transformer";
import {
	initPostEnhancements,
	mountEmbeds,
	wireCopyButtons,
} from "#/lib/mdx/post-enhancements.client";

const COPY_LABELS = { copy: "Copy code", copied: "Copied!" };

// Headings TicTacToe renders per locale — used to assert the island mounted and
// that `locale` was injected into its props (see app/components/posts/tic-tac-toe).
const TTT_HEADING_EN = "Try it: tic-tac-toe";
const TTT_HEADING_PT = "Experimente: jogo da velha";

function clipboardMock(impl: () => Promise<void>) {
	const writeText = vi.fn(impl);
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
		writable: true,
	});
	return writeText;
}

function makeCodeBlock(root: HTMLElement, raw: string): HTMLButtonElement {
	const pre = document.createElement("pre");
	pre.setAttribute(RAW_SOURCE_ATTR, raw);
	const button = document.createElement("button");
	button.type = "button";
	button.className = COPY_BUTTON_CLASS;
	pre.appendChild(button);
	root.appendChild(pre);
	return button;
}

function makeEmbed(root: HTMLElement, name: string, props = "{}"): HTMLElement {
	const node = document.createElement("div");
	node.setAttribute("data-embed", name);
	node.setAttribute("data-props", props);
	const fallback = document.createElement("span");
	fallback.className = "embed-fallback";
	fallback.textContent = "Interactive demo — requires JavaScript.";
	node.appendChild(fallback);
	root.appendChild(node);
	return node;
}

let root: HTMLElement;

beforeEach(() => {
	root = document.createElement("div");
	document.body.appendChild(root);
});

afterEach(() => {
	cleanup();
	root.remove();
	vi.restoreAllMocks();
	vi.useRealTimers();
});

// ─── wireCopyButtons ──────────────────────────────────────────────────────────

describe("wireCopyButtons", () => {
	it("AC-1: copies the stashed raw source and sets the localized aria-label", async () => {
		const raw = "const x = 1;\nconst y = 2;";
		const writeText = clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, raw);

		wireCopyButtons(root, COPY_LABELS);
		// Initial label is the localized "copy" string before any interaction.
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);

		await act(async () => {
			button.click();
		});

		expect(writeText).toHaveBeenCalledTimes(1);
		expect(writeText).toHaveBeenCalledWith(raw);
	});

	it("AC-1: after click the label becomes 'Copied!' then reverts after the timer", async () => {
		vi.useFakeTimers();
		clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, "echo hi");

		wireCopyButtons(root, COPY_LABELS);

		button.click();
		// Flush the resolved clipboard microtask without advancing the revert timer.
		await vi.advanceTimersByTimeAsync(0);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copied);
		expect(button.getAttribute("data-copied")).toBe("true");

		// Live region announces the confirmation politely.
		const live = root.querySelector("output");
		expect(live?.getAttribute("aria-live")).toBe("polite");
		expect(live?.textContent).toBe(COPY_LABELS.copied);

		await vi.advanceTimersByTimeAsync(2000);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);
		expect(button.hasAttribute("data-copied")).toBe(false);
		expect(live?.textContent).toBe("");
	});

	it("does not enter the copied state when the clipboard write rejects", async () => {
		clipboardMock(() => Promise.reject(new Error("denied")));
		const button = makeCodeBlock(root, "secret");

		wireCopyButtons(root, COPY_LABELS);

		await act(async () => {
			button.click();
		});

		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);
		expect(button.hasAttribute("data-copied")).toBe(false);
	});

	it("copies an empty string when the button has no enclosing <pre>", async () => {
		const writeText = clipboardMock(() => Promise.resolve());
		const button = document.createElement("button");
		button.type = "button";
		button.className = COPY_BUTTON_CLASS;
		root.appendChild(button);

		wireCopyButtons(root, COPY_LABELS);
		await act(async () => {
			button.click();
		});

		expect(writeText).toHaveBeenCalledWith("");
	});

	it("re-clicking restarts the revert timer and cleanup clears a pending timer", async () => {
		vi.useFakeTimers();
		clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, "again");

		const detach = wireCopyButtons(root, COPY_LABELS);

		button.click();
		await vi.advanceTimersByTimeAsync(0);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copied);

		// Second click before revert: the prior timer is cleared and restarted, so
		// the label is still "Copied!" after the original 2s would have elapsed.
		await vi.advanceTimersByTimeAsync(1000);
		button.click();
		await vi.advanceTimersByTimeAsync(1000);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copied);

		// Cleanup with a timer still pending clears it (no later revert fires).
		detach();
		await vi.advanceTimersByTimeAsync(2000);
		expect(root.querySelector("output")).toBeNull();
	});

	it("AC-4: cleanup detaches the handler and removes the live region", async () => {
		const writeText = clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, "data");

		const detach = wireCopyButtons(root, COPY_LABELS);
		expect(root.querySelector("output")).not.toBeNull();

		detach();
		expect(root.querySelector("output")).toBeNull();

		await act(async () => {
			button.click();
		});
		expect(writeText).not.toHaveBeenCalled();
	});
});

// ─── mountEmbeds ──────────────────────────────────────────────────────────────

describe("mountEmbeds", () => {
	it("AC-2: mounts the registered component and injects the locale", () => {
		const node = makeEmbed(root, "tic-tac-toe");

		let detach: () => void = () => {};
		act(() => {
			detach = mountEmbeds(root, "pt-br");
		});

		// pt-br heading proves the component mounted AND received locale="pt-br".
		expect(node.textContent).toContain(TTT_HEADING_PT);
		expect(node.textContent).not.toContain(TTT_HEADING_EN);
		expect(node.querySelector(".embed-fallback")).toBeNull();

		act(() => detach());
	});

	it("AC-3: an unknown embed name does not mount, keeps the fallback, and warns", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const node = makeEmbed(root, "does-not-exist");

		let detach: () => void = () => {};
		act(() => {
			detach = mountEmbeds(root, "en");
		});

		expect(warn).toHaveBeenCalledOnce();
		expect(warn.mock.calls[0]?.[0]).toContain("does-not-exist");
		expect(node.querySelector(".embed-fallback")).not.toBeNull();

		act(() => detach());
	});

	it("AC-4: cleanup unmounts the island root and empties the node", () => {
		const node = makeEmbed(root, "tic-tac-toe");

		let detach: () => void = () => {};
		act(() => {
			detach = mountEmbeds(root, "en");
		});
		expect(node.textContent).toContain(TTT_HEADING_EN);

		act(() => detach());
		expect(node.childNodes.length).toBe(0);
	});

	it("mounts with empty props when the data-props attribute is absent", () => {
		const node = document.createElement("div");
		node.setAttribute("data-embed", "tic-tac-toe");
		root.appendChild(node);

		let detach: () => void = () => {};
		act(() => {
			detach = mountEmbeds(root, "en");
		});

		expect(node.textContent).toContain(TTT_HEADING_EN);
		act(() => detach());
	});

	it("degrades to empty props and warns when data-props is malformed JSON", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const node = makeEmbed(root, "tic-tac-toe", "{not json}");

		let detach: () => void = () => {};
		act(() => {
			detach = mountEmbeds(root, "en");
		});

		// Still mounts (props fall back to {}); warning records the parse failure.
		expect(node.textContent).toContain(TTT_HEADING_EN);
		expect(warn).toHaveBeenCalledOnce();

		act(() => detach());
	});
});

// ─── initPostEnhancements ─────────────────────────────────────────────────────

describe("initPostEnhancements", () => {
	it("wires copy buttons and mounts embeds, and the combined cleanup undoes both", async () => {
		const writeText = clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, "combined");
		const embedNode = makeEmbed(root, "tic-tac-toe");

		let detach: () => void = () => {};
		act(() => {
			detach = initPostEnhancements(root, {
				locale: "en",
				copyLabels: COPY_LABELS,
			});
		});

		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);
		expect(embedNode.textContent).toContain(TTT_HEADING_EN);

		act(() => detach());

		// Embed root unmounted (node emptied) and copy handler detached.
		expect(embedNode.childNodes.length).toBe(0);
		expect(root.querySelector("output")).toBeNull();
		await act(async () => {
			button.click();
		});
		expect(writeText).not.toHaveBeenCalled();
	});
});
