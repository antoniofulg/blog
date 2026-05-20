import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const yml = readFileSync(join(root, ".github/workflows/app-audit.yml"), "utf8");

describe("unit: .github/workflows/app-audit.yml", () => {
	it("triggers on workflow_dispatch", () => {
		expect(yml).toContain("workflow_dispatch");
	});

	it("workflow_dispatch has lighthouse choice input", () => {
		expect(yml).toContain("lighthouse");
		expect(yml).toContain("type: choice");
	});

	it("lighthouse input default is 'false'", () => {
		expect(yml).toContain('default: "false"');
	});

	it("lighthouse input options include 'true' and 'false'", () => {
		expect(yml).toContain('"false"');
		expect(yml).toContain('"true"');
	});

	it("triggers on pull_request", () => {
		expect(yml).toContain("pull_request");
	});

	it("paths filter includes app/routes/**", () => {
		expect(yml).toContain("app/routes/**");
	});

	it("paths filter includes app/components/**", () => {
		expect(yml).toContain("app/components/**");
	});

	it("paths filter includes app/lib/**", () => {
		expect(yml).toContain("app/lib/**");
	});

	it("paths filter includes app/db/schema.ts", () => {
		expect(yml).toContain("app/db/schema.ts");
	});

	it("paths filter does NOT include app/content/**", () => {
		expect(yml).not.toContain("app/content/**");
	});

	it("uses peter-evans/create-or-update-comment@v4", () => {
		expect(yml).toContain("peter-evans/create-or-update-comment@v4");
	});

	it("comment body-includes matches app fingerprint only", () => {
		expect(yml).toContain('body-includes: "<!-- audit-fingerprint:app:"');
	});

	it("body-includes does not match content fingerprint", () => {
		expect(yml).not.toContain(
			'body-includes: "<!-- audit-fingerprint:content:',
		);
	});

	it("comment body embeds app fingerprint HTML comment", () => {
		expect(yml).toContain("<!-- audit-fingerprint:app:blocker=");
	});

	it("uses actions/upload-artifact@v4", () => {
		expect(yml).toContain("actions/upload-artifact@v4");
	});

	it("artifact path references docs/_reports/app-audit-*.md", () => {
		expect(yml).toContain("docs/_reports/app-audit-*.md");
	});

	it("artifact name uses app-audit-report prefix", () => {
		expect(yml).toContain("app-audit-report-");
	});

	it("uses oven-sh/setup-bun@v2 with version 1.3.13", () => {
		expect(yml).toContain("oven-sh/setup-bun@v2");
		expect(yml).toContain('bun-version: "1.3.13"');
	});

	it("installs dependencies with frozen lockfile", () => {
		expect(yml).toContain("bun install --frozen-lockfile");
	});

	it("runs bun run audit:fe", () => {
		expect(yml).toContain("bun run audit:fe");
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

	it("builds app before starting preview server", () => {
		const buildIdx = yml.indexOf("bun run build");
		const previewIdx = yml.indexOf("bun run preview");
		expect(buildIdx).toBeGreaterThan(-1);
		expect(previewIdx).toBeGreaterThan(-1);
		expect(buildIdx).toBeLessThan(previewIdx);
	});

	it("sets AUDIT_BASE_URL for the audit step", () => {
		expect(yml).toContain("AUDIT_BASE_URL");
	});

	it("has postgres service for database", () => {
		expect(yml).toContain("postgres:");
		expect(yml).toContain("postgres:16-alpine");
	});

	it("lighthouse flag derived from workflow_dispatch input", () => {
		expect(yml).toContain("github.event.inputs.lighthouse");
	});
});
