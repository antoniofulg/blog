// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";

if (!("ResizeObserver" in globalThis)) {
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}

if (!window.matchMedia) {
	Object.defineProperty(window, "matchMedia", {
		configurable: true,
		writable: true,
		value: (query: string) => ({
			matches: false,
			media: query,
			onchange: null,
			addListener: () => {},
			removeListener: () => {},
			addEventListener: () => {},
			removeEventListener: () => {},
			dispatchEvent: () => false,
		}),
	});
}

afterEach(() => {
	document.body.replaceChildren();
});

describe("DOM test setup", () => {
	it("provides a ResizeObserver with lifecycle methods", () => {
		const observer = new ResizeObserver(() => {});
		expect(typeof observer.observe).toBe("function");
		expect(typeof observer.unobserve).toBe("function");
		expect(typeof observer.disconnect).toBe("function");
		observer.disconnect();
	});

	it("provides matchMedia with query metadata and event methods", () => {
		const media = window.matchMedia("(min-width: 1px)");
		expect(media.media).toBe("(min-width: 1px)");
		expect(media.matches).toBe(false);
		expect(typeof media.addEventListener).toBe("function");
		expect(typeof media.removeEventListener).toBe("function");
	});

	it("clears DOM nodes after each test", () => {
		document.body.append(document.createElement("div"));
		expect(document.body.childElementCount).toBe(1);
	});

	it("starts each test with an empty body", () => {
		expect(document.body.childElementCount).toBe(0);
	});
});
