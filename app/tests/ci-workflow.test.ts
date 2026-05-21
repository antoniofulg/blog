import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const ciYml = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");

function parseMatrixChecks(yml: string): string[] {
	const match = yml.match(/check:\s*\[([^\]]+)\]/);
	if (!match) return [];
	return match[1].split(",").map((e) => e.trim());
}

describe("unit: .github/workflows/ci.yml", () => {
	it("quality matrix includes e2e entry", () => {
		const entries = parseMatrixChecks(ciYml);
		expect(entries).toContain("e2e");
	});

	it("quality matrix includes lint-tests entry", () => {
		const entries = parseMatrixChecks(ciYml);
		expect(entries).toContain("lint-tests");
	});

	it("quality matrix retains all original entries", () => {
		const entries = parseMatrixChecks(ciYml);
		for (const entry of ["test", "lint", "check", "build-js"]) {
			expect(entries).toContain(entry);
		}
	});

	it("e2e job has Playwright Chromium cache step", () => {
		expect(ciYml).toContain("ms-playwright");
		expect(ciYml).toContain("actions/cache@v4");
		expect(ciYml).toContain("hashFiles('bun.lock')");
	});

	it("e2e job installs Chromium with playwright install", () => {
		expect(ciYml).toContain("playwright install --with-deps chromium");
	});

	it("e2e job injects E2E_ADMIN_EMAIL secret", () => {
		expect(ciYml).toContain("E2E_ADMIN_EMAIL");
		expect(ciYml).toContain("secrets.E2E_ADMIN_EMAIL");
	});

	it("e2e job injects E2E_ADMIN_PASSWORD secret", () => {
		expect(ciYml).toContain("E2E_ADMIN_PASSWORD");
		expect(ciYml).toContain("secrets.E2E_ADMIN_PASSWORD");
	});

	it("e2e job uploads playwright-report artifact", () => {
		expect(ciYml).toContain("playwright-report");
		expect(ciYml).toContain("actions/upload-artifact@v4");
	});

	it("artifact upload runs on always() condition", () => {
		expect(ciYml).toContain("always()");
	});

	it("commitlint job still targets pull_request only", () => {
		const commitlintSection = ciYml.slice(ciYml.indexOf("commitlint:"));
		expect(commitlintSection).toContain("pull_request");
	});

	it("branch-check job still targets pull_request only", () => {
		const branchCheckSection = ciYml.slice(ciYml.indexOf("branch-check:"));
		expect(branchCheckSection).toContain("pull_request");
	});
});
