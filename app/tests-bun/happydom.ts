// Explicit setup for DOM tests. Server-side Bun tests must not import this file.

import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const nativeRequest = globalThis.Request;
const nativeResponse = globalThis.Response;
const nativeHeaders = globalThis.Headers;
GlobalRegistrator.register({ url: "http://localhost" });

// happy-dom filters Cookie headers like a browser. Keep server-request tests'
// native fetch classes while retaining happy-dom's DOM globals.
if (nativeRequest) globalThis.Request = nativeRequest;
if (nativeResponse) globalThis.Response = nativeResponse;
if (nativeHeaders) globalThis.Headers = nativeHeaders;
process.env.SITE_URL ??= "http://localhost";

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
