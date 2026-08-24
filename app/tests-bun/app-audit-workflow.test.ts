import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "../..");
const yml = readFileSync(join(root, ".github/workflows/app-audit.yml"), "utf8");

describe("unit: .github/workflows/app-audit.yml", () => {
	test("triggers on workflow_dispatch", () => {
		expect(yml).toContain("workflow_dispatch");
	});

	test("workflow_dispatch has lighthouse choice input", () => {
		expect(yml).toContain("lighthouse");
		expect(yml).toContain("type: choice");
	});

	test("lighthouse input default is 'false'", () => {
		expect(yml).toContain('default: "false"');
	});

	test("lighthouse input options include 'true' and 'false'", () => {
		expect(yml).toContain('"false"');
		expect(yml).toContain('"true"');
	});

	test("triggers on pull_request", () => {
		expect(yml).toContain("pull_request");
	});

	test("paths filter includes app/routes/**", () => {
		expect(yml).toContain("app/routes/**");
	});

	test("paths filter includes app/components/**", () => {
		expect(yml).toContain("app/components/**");
	});

	test("paths filter includes app/lib/**", () => {
		expect(yml).toContain("app/lib/**");
	});

	test("paths filter includes app/db/schema.ts", () => {
		expect(yml).toContain("app/db/schema.ts");
	});

	test("paths filter does NOT include app/content/**", () => {
		expect(yml).not.toContain("app/content/**");
	});

	test("uses peter-evans/create-or-update-comment@v4", () => {
		expect(yml).toContain("peter-evans/create-or-update-comment@v4");
	});

	test("comment body-includes matches app fingerprint only", () => {
		expect(yml).toContain('body-includes: "<!-- audit-fingerprint:app:"');
	});

	test("body-includes does not match content fingerprint", () => {
		expect(yml).not.toContain(
			'body-includes: "<!-- audit-fingerprint:content:',
		);
	});

	test("comment body embeds app fingerprint HTML comment", () => {
		expect(yml).toContain("<!-- audit-fingerprint:app:blocker=");
	});

	test("uses actions/upload-artifact@v4", () => {
		expect(yml).toContain("actions/upload-artifact@v4");
	});

	test("artifact path references docs/_reports/app-audit-*.md", () => {
		expect(yml).toContain("docs/_reports/app-audit-*.md");
	});

	test("artifact name uses app-audit-report prefix", () => {
		expect(yml).toContain("app-audit-report-");
	});

	test("uses oven-sh/setup-bun@v2 with version 1.4.0", () => {
		expect(yml).toContain("oven-sh/setup-bun@v2");
		expect(yml).toContain('bun-version: "1.4.0"');
	});

	test("installs dependencies with frozen lockfile", () => {
		expect(yml).toContain("bun install --frozen-lockfile");
	});

	test("runs bun run scripts/run-audit-fe.ts (orchestrator wrapper)", () => {
		expect(yml).toContain("bun run scripts/run-audit-fe.ts");
	});

	test("delta suppression uses actions/github-script", () => {
		expect(yml).toContain("actions/github-script");
	});

	test("PR comment step conditional on pull_request event", () => {
		expect(yml).toContain("github.event_name == 'pull_request'");
	});

	test("PR comment step guarded against fork PRs", () => {
		expect(yml).toContain(
			"github.event.pull_request.head.repo.full_name == github.repository",
		);
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

	test("builds app before starting preview server", () => {
		const buildIdx = yml.indexOf("bun run build");
		const previewIdx = yml.indexOf("bun run preview");
		expect(buildIdx).toBeGreaterThan(-1);
		expect(previewIdx).toBeGreaterThan(-1);
		expect(buildIdx).toBeLessThan(previewIdx);
	});

	test("sets AUDIT_BASE_URL for the audit step", () => {
		expect(yml).toContain("AUDIT_BASE_URL");
	});

	test("has postgres service for database", () => {
		expect(yml).toContain("postgres:");
		expect(yml).toContain("postgres:16-alpine");
	});

	test("lighthouse flag derived from workflow_dispatch input", () => {
		expect(yml).toContain("github.event.inputs.lighthouse");
	});
});
