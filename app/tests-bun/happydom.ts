// Explicit setup for DOM tests. Server-side Bun tests must not import this file.

import { afterEach } from "bun:test";
import { GlobalRegistrator } from "@happy-dom/global-registrator";

const nativeRequest = globalThis.Request;
const nativeResponse = globalThis.Response;
const nativeHeaders = globalThis.Headers;
GlobalRegistrator.register({ url: "http://localhost" });

const { cleanup } = await import("@testing-library/react");
const happyDom = (
	globalThis as typeof globalThis & { happyDOM: { setURL(url: string): void } }
).happyDOM;

// happy-dom filters Cookie headers like a browser. Keep server-request tests'
// native fetch classes while retaining happy-dom's DOM globals.
if (nativeRequest) globalThis.Request = nativeRequest;
if (nativeResponse) globalThis.Response = nativeResponse;
if (nativeHeaders) globalThis.Headers = nativeHeaders;
process.env.SITE_URL ??= "http://localhost";

// jsdom ships these; happy-dom does not. The component under test observes its
// container, so without this the render throws instead of failing an assertion.
const resizeObserver =
	"ResizeObserver" in globalThis
		? globalThis.ResizeObserver
		: class {
				observe() {}
				unobserve() {}
				disconnect() {}
			};

(globalThis as { ResizeObserver?: unknown }).ResizeObserver = resizeObserver;

const matchMedia = (query: string) => ({
	matches: false,
	media: query,
	onchange: null,
	addListener: () => {},
	removeListener: () => {},
	addEventListener: () => {},
	removeEventListener: () => {},
	dispatchEvent: () => false,
});

Object.defineProperty(window, "matchMedia", {
	configurable: true,
	writable: true,
	value: matchMedia,
});

afterEach(() => {
	cleanup();
	document.body.replaceChildren();
	document.head.replaceChildren();
	window.localStorage.clear();
	window.sessionStorage.clear();
	happyDom.setURL("http://localhost/");
	(globalThis as { ResizeObserver?: unknown }).ResizeObserver = resizeObserver;
	window.matchMedia = matchMedia;
});
