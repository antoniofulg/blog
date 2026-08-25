import { defineConfig } from "@playwright/test";

const externalServer =
	process.env.PLAYWRIGHT_WEBVIEW_EXTERNAL_SERVER === "1";
const baseURL =
	process.env.PLAYWRIGHT_WEBVIEW_BASE_URL ?? "http://localhost:4173";

export default defineConfig({
	testDir: "tests/e2e-webview",
	testMatch: /public-smoke\.spec\.ts/,
	fullyParallel: false,
	forbidOnly: true,
	workers: 1,
	retries: 0,
	timeout: 120_000,
	outputDir: "test-results-webview",
	reporter: [
		["html", { outputFolder: "playwright-report-webview", open: "never" }],
		["json", { outputFile: "playwright-report-webview/results.json" }],
	],
	use: { baseURL },
	projects: [
		{ name: "playwright-page" },
		{ name: "bun-webview-webkit" },
		{ name: "bun-webview-chrome" },
	],
	...(externalServer
		? {}
		: {
				globalSetup: "./tests/e2e/global-setup.ts",
				globalTeardown: "./tests/e2e/global-teardown.ts",
				webServer: {
					command: "bun run scripts/e2e-server.ts",
					url: baseURL,
					reuseExistingServer: false,
					stdout: "pipe" as const,
					stderr: "pipe" as const,
				},
			}),
});
