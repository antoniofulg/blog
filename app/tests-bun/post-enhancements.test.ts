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

const { act, cleanup } = await import("@testing-library/react");

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
	const writeText = jest.fn(impl);
	Object.defineProperty(navigator, "clipboard", {
		value: { writeText },
		configurable: true,
		writable: true,
	});
	return writeText;
}

function makeCodeBlock(root: HTMLElement, raw: string): HTMLButtonElement {
	// Mirror the transformer's output: a non-scrolling wrapper holding the button
	// as a SIBLING of the <pre> (the <pre> is the horizontal-scroll container, so
	// the button must live outside it). The client reads the raw source from the
	// sibling <pre> via the shared wrapper parent.
	const wrapper = document.createElement("div");
	const pre = document.createElement("pre");
	pre.setAttribute(RAW_SOURCE_ATTR, raw);
	const button = document.createElement("button");
	button.type = "button";
	button.className = COPY_BUTTON_CLASS;
	wrapper.appendChild(button);
	wrapper.appendChild(pre);
	root.appendChild(wrapper);
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
	jest.restoreAllMocks();
	jest.useRealTimers();
});

// ─── wireCopyButtons ──────────────────────────────────────────────────────────

describe("wireCopyButtons", () => {
	test("AC-1: copies the stashed raw source and sets the localized aria-label", async () => {
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

	test("AC-1: after click the label becomes 'Copied!' then reverts after the timer", async () => {
		jest.useFakeTimers();
		clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, "echo hi");

		wireCopyButtons(root, COPY_LABELS);

		button.click();
		// Flush the resolved clipboard microtask without advancing the revert timer.
		await Promise.resolve();
		jest.advanceTimersByTime(0);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copied);
		expect(button.getAttribute("data-copied")).toBe("true");

		// Live region announces the confirmation politely.
		const live = root.querySelector("output");
		expect(live?.getAttribute("aria-live")).toBe("polite");
		expect(live?.textContent).toBe(COPY_LABELS.copied);

		jest.advanceTimersByTime(2000);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);
		expect(button.hasAttribute("data-copied")).toBe(false);
		expect(live?.textContent).toBe("");
	});

	test("does not enter the copied state when the clipboard write rejects", async () => {
		clipboardMock(() => Promise.reject(new Error("denied")));
		const button = makeCodeBlock(root, "secret");

		wireCopyButtons(root, COPY_LABELS);

		await act(async () => {
			button.click();
		});

		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);
		expect(button.hasAttribute("data-copied")).toBe(false);
	});

	test("copies an empty string when the button has no enclosing <pre>", async () => {
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

	test("does not throw and shows no copied state when clipboard is unavailable", async () => {
		// Non-secure origin / restrictive permission policy: navigator.clipboard is
		// undefined. Accessing .writeText would throw synchronously before the
		// .catch chain; the early guard must make the click a silent no-op.
		Object.defineProperty(navigator, "clipboard", {
			value: undefined,
			configurable: true,
			writable: true,
		});
		const button = makeCodeBlock(root, "data");
		wireCopyButtons(root, COPY_LABELS);
		await act(async () => {
			expect(() => button.click()).not.toThrow();
		});
		expect(button.hasAttribute("data-copied")).toBe(false);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copy);
	});

	test("re-clicking restarts the revert timer and cleanup clears a pending timer", async () => {
		jest.useFakeTimers();
		clipboardMock(() => Promise.resolve());
		const button = makeCodeBlock(root, "again");

		const detach = wireCopyButtons(root, COPY_LABELS);

		button.click();
		await Promise.resolve();
		jest.advanceTimersByTime(0);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copied);

		// Second click before revert: the prior timer is cleared and restarted, so
		// the label is still "Copied!" after the original 2s would have elapsed.
		jest.advanceTimersByTime(1000);
		button.click();
		await Promise.resolve();
		jest.advanceTimersByTime(1000);
		expect(button.getAttribute("aria-label")).toBe(COPY_LABELS.copied);

		// Cleanup with a timer still pending clears it (no later revert fires).
		detach();
		jest.advanceTimersByTime(2000);
		expect(root.querySelector("output")).toBeNull();
	});

	test("AC-4: cleanup detaches the handler and removes the live region", async () => {
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
	test("AC-2: mounts the registered component and injects the locale", () => {
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

	test("AC-3: an unknown embed name does not mount, keeps the fallback, and warns", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
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

	test("AC-4: cleanup unmounts the island root and empties the node", () => {
		const node = makeEmbed(root, "tic-tac-toe");

		let detach: () => void = () => {};
		act(() => {
			detach = mountEmbeds(root, "en");
		});
		expect(node.textContent).toContain(TTT_HEADING_EN);

		act(() => detach());
		expect(node.childNodes.length).toBe(0);
	});

	test("mounts with empty props when the data-props attribute is absent", () => {
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

	test("degrades to empty props and warns when data-props is malformed JSON", () => {
		const warn = jest.spyOn(console, "warn").mockImplementation(() => {});
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
	test("wires copy buttons and mounts embeds, and the combined cleanup undoes both", async () => {
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
