import { describe, expect, test } from "bun:test";
import { BROWSER_SMOKE_ROUTE_IDS } from "#/lib/browser-bench/contract";
import {
	assessWebViewRoute,
	parseWebViewArgs,
} from "../../scripts/run-e2e-webview";

describe("local WebView smoke harness", () => {
	test("parses opt-in backend, view, pass, and smol controls", () => {
		expect(
			parseWebViewArgs([
				"--backend=chrome",
				"--base-url=http://localhost:4173",
				"--views=2",
				"--passes=5",
				"--smol",
			]),
		).toEqual({
			backend: "chrome",
			baseUrl: "http://localhost:4173/",
			views: 2,
			passes: 5,
			persistent: false,
			smol: true,
			externalServer: false,
		});
		expect(() => parseWebViewArgs(["--backend=firefox"])).toThrow(
			"--backend must be webkit or chrome",
		);
		expect(() => parseWebViewArgs(["--views=3"])).toThrow(
			"--views must be 1 or 2",
		);
	});

	test("asserts each canonical route's status and expected page outcome", () => {
		const route = {
			id: BROWSER_SMOKE_ROUTE_IDS[0],
			path: "/e2e-public-fixture",
			expectedStatus: 200,
			expectedLang: "en",
			expectedHeading: "E2E Public Fixture",
			expectedText: "English body",
		};
		const snapshot = {
			readyState: "complete",
			status: 200,
			lang: "en",
			headings: ["E2E Public Fixture"],
			bodyText: "English body",
			canonical: "http://localhost:4173/e2e-public-fixture",
		};
		expect(assessWebViewRoute(route, snapshot)).toEqual({
			id: "en-post",
			passed: true,
			status: 200,
		});
		expect(
			assessWebViewRoute(route, { ...snapshot, status: 500 }),
		).toMatchObject({
			passed: false,
			error: "status expected 200, got 500",
		});
	});
});
