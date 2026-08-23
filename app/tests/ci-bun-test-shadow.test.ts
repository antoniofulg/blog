import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const playwright = readFileSync(join(root, "playwright.config.ts"), "utf8");

describe("Bun Test CI shadow", () => {
	it("keeps the test matrix entry", () => {
		expect(ci).toContain(
			"check: [test, lint, check, build-js, e2e, lint-tests]",
		);
	});

	it("uses the shared Bun runtime for the blocking test", () => {
		expect(ci).toContain('bun-version: "1.4.0"');
		expect(ci).not.toContain("uses: actions/setup-node@v4");
	});

	it("keeps Bun Test shadow non-blocking", () => {
		expect(ci).toContain("bun-test-shadow:");
		expect(ci).toContain("continue-on-error: true");
	});

	it("pins Bun 1.4 in the shadow job", () => {
		const shadow = ci.slice(ci.indexOf("bun-test-shadow:"));
		expect(shadow).toContain('bun-version: "1.4.0"');
	});

	it("runs parity and the candidate suite", () => {
		const shadow = ci.slice(ci.indexOf("bun-test-shadow:"));
		expect(shadow).toContain("bun run test:parity");
		expect(shadow).toContain("bun run test:bun");
	});

	it("provides E2E credentials to the candidate suite", () => {
		const shadow = ci.slice(ci.indexOf("bun-test-shadow:"));
		expect(shadow).toContain("E2E_ADMIN_EMAIL:");
		expect(shadow).toContain("secrets.E2E_ADMIN_EMAIL");
		expect(shadow).toContain("E2E_ADMIN_PASSWORD:");
		expect(shadow).toContain("secrets.E2E_ADMIN_PASSWORD");
	});

	it("writes schema-compatible results through the tested producer", () => {
		const shadow = ci.slice(ci.indexOf("bun-test-shadow:"));
		expect(shadow).toContain("scripts/write-shadow-result.ts");
		expect(shadow).not.toContain("node -e");
	});

	it("uploads JSON and logs with seven-day retention", () => {
		const shadow = ci.slice(ci.indexOf("bun-test-shadow:"));
		expect(shadow).toContain("shadow-result.json");
		expect(shadow).toContain("shadow-bun-test.log");
		expect(shadow).toContain("actions/upload-artifact@v4");
		expect(shadow).toContain("retention-days: 7");
	});

	it("keeps Playwright on one Chromium worker", () => {
		expect(playwright).toContain("workers: 1");
		expect(playwright).toContain('name: "chromium"');
		expect(playwright).not.toContain('name: "firefox"');
	});

	it("keeps the Bun web server boundary", () => {
		expect(playwright).toContain('command: "bun run scripts/e2e-server.ts"');
		expect(playwright).toContain("reuseExistingServer: false");
	});

	it("keeps retired Bun.WebView routes out of CI", () => {
		expect(ci).not.toContain("test:e2e:webview");
		expect(ci).not.toContain("bench:e2e:webview");
	});
});
