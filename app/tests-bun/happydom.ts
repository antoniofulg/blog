// Preload for `bun test`. Registers happy-dom globals before any test file is
// evaluated, which is what gives the React component tests a DOM to render
// into. Vitest gets the same thing from `environment: "jsdom"` in its config;
// under Bun the environment is opt-in through this file.

import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

GlobalRegistrator.register();

afterEach(() => {
	document.body.replaceChildren();
});

// jsdom ships these; happy-dom does not. The component under test observes its
// container, so without this the render throws instead of failing an assertion.
if (!("ResizeObserver" in globalThis)) {
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	};
}

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
