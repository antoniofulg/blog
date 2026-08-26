import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const yml = readFileSync(
	join(root, ".github/workflows/content-audit.yml"),
	"utf8",
);

describe("unit: .github/workflows/content-audit.yml", () => {
	test("triggers on workflow_dispatch", () => {
		expect(yml).toContain("workflow_dispatch");
	});

	test("triggers on pull_request", () => {
		expect(yml).toContain("pull_request");
	});

	test("paths filter includes app/content/posts/**", () => {
		expect(yml).toContain("app/content/posts/**");
	});

	test("paths filter includes app/db/schema.ts", () => {
		expect(yml).toContain("app/db/schema.ts");
	});

	test("uses peter-evans/create-or-update-comment@v4", () => {
		expect(yml).toContain("peter-evans/create-or-update-comment@v4");
	});

	test("comment step has body-includes matching audit-fingerprint", () => {
		expect(yml).toContain("body-includes");
		expect(yml).toContain("audit-fingerprint");
	});

	test("comment body embeds fingerprint HTML comment with type and counts", () => {
		expect(yml).toContain("<!-- audit-fingerprint:content:blocker=");
	});

	test("uses actions/upload-artifact@v4", () => {
		expect(yml).toContain("actions/upload-artifact@v4");
	});

	test("artifact path references docs/_reports/content-audit-*.md", () => {
		expect(yml).toContain("docs/_reports/content-audit-*.md");
	});

	test("artifact name uses content-audit-report prefix", () => {
		expect(yml).toContain("content-audit-report-");
	});

	test("uses oven-sh/setup-bun@v2 with version 1.4.0", () => {
		expect(yml).toContain("oven-sh/setup-bun@v2");
		expect(yml).toContain('bun-version: "1.4.0"');
	});

	test("installs dependencies with frozen lockfile", () => {
		expect(yml).toContain("bun install --frozen-lockfile");
	});

	test("runs bun run audit:content", () => {
		expect(yml).toContain("bun run audit:content");
	});

	test("delta suppression uses actions/github-script", () => {
		expect(yml).toContain("actions/github-script");
	});

	test("PR comment step conditional on pull_request event", () => {
		expect(yml).toContain("github.event_name == 'pull_request'");
	});

	test("delta suppress output gates PR comment step", () => {
		expect(yml).toContain("suppress");
	});

	test("job has pull-requests write permission", () => {
		expect(yml).toContain("pull-requests: write");
	});

	test("artifact upload runs on always() so report is saved even on failure", () => {
		expect(yml).toContain("always()");
	});

	test("trigger arg uses ci-pr prefix for PR runs", () => {
		expect(yml).toContain("ci-pr-");
	});
});
