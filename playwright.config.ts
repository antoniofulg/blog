import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e",
	forbidOnly: !!process.env.CI,
	workers: 1,
	retries: process.env.CI ? 1 : 0,
	globalSetup: "./tests/e2e/global-setup.ts",
	globalTeardown: "./tests/e2e/global-teardown.ts",
	reporter: [
		["html"],
		["json", { outputFile: "playwright-report/results.json" }],
	],
	use: {
		baseURL: "http://localhost:4173",
		trace: "on-first-retry",
	},
	projects: [
		{
			name: "setup",
			testMatch: /auth\.setup\.ts/,
		},
		{
			name: "chromium",
			use: {
				...devices["Desktop Chrome"],
				storageState: "tests/e2e/.auth/admin.json",
			},
			dependencies: ["setup"],
		},
	],
	// scripts/e2e-server.ts creates the PGLite proxy and starts the Nitro server.
	// Playwright starts webServer BEFORE globalSetup, so the server owns the proxy.
	webServer: {
		command: "bun run scripts/e2e-server.ts",
		url: "http://localhost:4173",
		reuseExistingServer: false,
		stdout: "pipe",
		stderr: "pipe",
	},
});
