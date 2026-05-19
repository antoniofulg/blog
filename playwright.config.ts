import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
	testDir: "tests/e2e",
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
	// globalSetup sets process.env.DATABASE_URL before webServer starts;
	// the subprocess inherits it via normal env inheritance.
	webServer: {
		command: "bun run preview",
		url: "http://localhost:4173",
		reuseExistingServer: !process.env.CI,
		stdout: "pipe",
		stderr: "pipe",
	},
});
