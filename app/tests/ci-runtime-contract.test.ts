import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const ci = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const playwright = readFileSync(join(root, "playwright.config.ts"), "utf8");

describe("CI Bun runtime contract", () => {
	it("runs the blocking test gate through pinned Bun", () => {
		expect(ci).toContain(
			"check: [test, lint, check, build-js, e2e, lint-tests]",
		);
		expect(ci).toContain('bun-version: "1.4.0"');
		expect(ci).not.toContain("uses: actions/setup-node@v4");
		expect(ci).toContain("make $" + "{{ matrix.check }}");
		expect(ci.toLowerCase()).not.toContain("vitest");
	});

	it("keeps retired candidate and parity routes out of CI", () => {
		expect(ci).not.toContain("test:parity");
		expect(ci).not.toContain("test:bun:parity");
		expect(ci).not.toContain("write-shadow-result");
	});

	it("keeps all Playwright browser projects and Bun web server", () => {
		for (const browser of ["chromium", "firefox", "webkit"])
			expect(playwright).toContain(`name: "${browser}"`);
		expect(playwright).toContain('command: "bun run scripts/e2e-server.ts"');
		expect(playwright).toContain("reuseExistingServer: false");
	});

	it("keeps Playwright on one worker across browser projects", () => {
		expect(playwright).toContain("workers: 1");
		expect(playwright).toContain('...devices["Desktop Firefox"]');
		expect(playwright).toContain('...devices["Desktop Safari"]');
		expect(playwright).toMatch(
			/name: "chromium"[\s\S]*?dependencies: \["setup"\][\s\S]*?name: "firefox"[\s\S]*?dependencies: \["setup"\][\s\S]*?name: "webkit"[\s\S]*?dependencies: \["setup"\]/,
		);
	});

	it("keeps retired Bun.WebView routes out of CI", () => {
		expect(ci).not.toContain("test:e2e:webview");
		expect(ci).not.toContain("bench:e2e:webview");
	});
});
