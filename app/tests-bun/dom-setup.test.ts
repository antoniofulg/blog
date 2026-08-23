import "./happydom";
import { afterEach, describe, expect, test } from "bun:test";

afterEach(() => {
	document.body.replaceChildren();
});

describe("DOM test setup", () => {
	test("provides a ResizeObserver with lifecycle methods", () => {
		const observer = new ResizeObserver(() => {});
		expect(typeof observer.observe).toBe("function");
		expect(typeof observer.unobserve).toBe("function");
		expect(typeof observer.disconnect).toBe("function");
		observer.disconnect();
	});

	test("provides matchMedia with query metadata and event methods", () => {
		const media = window.matchMedia("(min-width: 1px)");
		expect(media.media).toBe("(min-width: 1px)");
		expect(media.matches).toBe(false);
		expect(typeof media.addEventListener).toBe("function");
		expect(typeof media.removeEventListener).toBe("function");
	});

	test("keeps Bun-native Request and Headers for server-compatible DOM tests", () => {
		const request = new Request("http://localhost/test", {
			headers: { Cookie: "session=test" },
		});
		expect(request.headers).toBeInstanceOf(Headers);
		expect(request.headers.get("Cookie")).toBe("session=test");
	});

	test("clears DOM nodes after each test", () => {
		document.body.append(document.createElement("div"));
		expect(document.body.childElementCount).toBe(1);
	});

	test("starts each test with an empty body", () => {
		expect(document.body.childElementCount).toBe(0);
	});
});
