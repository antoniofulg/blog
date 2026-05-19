import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const yml = readFileSync(
	join(root, ".github/workflows/content-audit.yml"),
	"utf8",
);

describe("unit: .github/workflows/content-audit.yml", () => {
	it("triggers on workflow_dispatch", () => {
		expect(yml).toContain("workflow_dispatch");
	});

	it("triggers on pull_request", () => {
		expect(yml).toContain("pull_request");
	});

	it("paths filter includes app/content/posts/**", () => {
		expect(yml).toContain("app/content/posts/**");
	});

	it("paths filter includes app/db/schema.ts", () => {
		expect(yml).toContain("app/db/schema.ts");
	});

	it("uses peter-evans/create-or-update-comment@v4", () => {
		expect(yml).toContain("peter-evans/create-or-update-comment@v4");
	});

	it("comment step has body-includes matching audit-fingerprint", () => {
		expect(yml).toContain("body-includes");
		expect(yml).toContain("audit-fingerprint");
	});

	it("comment body embeds fingerprint HTML comment with counts", () => {
		expect(yml).toContain("<!-- audit-fingerprint:blocker=");
	});

	it("uses actions/upload-artifact@v4", () => {
		expect(yml).toContain("actions/upload-artifact@v4");
	});

	it("artifact path references docs/_reports/content-audit-*.md", () => {
		expect(yml).toContain("docs/_reports/content-audit-*.md");
	});

	it("artifact name uses content-audit-report prefix", () => {
		expect(yml).toContain("content-audit-report-");
	});

	it("uses oven-sh/setup-bun@v2 with version 1.3.13", () => {
		expect(yml).toContain("oven-sh/setup-bun@v2");
		expect(yml).toContain('bun-version: "1.3.13"');
	});

	it("installs dependencies with frozen lockfile", () => {
		expect(yml).toContain("bun install --frozen-lockfile");
	});

	it("runs bun run audit:content", () => {
		expect(yml).toContain("bun run audit:content");
	});

	it("delta suppression uses actions/github-script", () => {
		expect(yml).toContain("actions/github-script");
	});

	it("PR comment step conditional on pull_request event", () => {
		expect(yml).toContain("github.event_name == 'pull_request'");
	});

	it("delta suppress output gates PR comment step", () => {
		expect(yml).toContain("suppress");
	});

	it("job has pull-requests write permission", () => {
		expect(yml).toContain("pull-requests: write");
	});

	it("artifact upload runs on always() so report is saved even on failure", () => {
		expect(yml).toContain("always()");
	});

	it("trigger arg uses ci-pr prefix for PR runs", () => {
		expect(yml).toContain("ci-pr-");
	});
});
