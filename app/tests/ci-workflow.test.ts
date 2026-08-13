import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const root = join(import.meta.dirname, "../..");
const ciYml = readFileSync(join(root, ".github/workflows/ci.yml"), "utf8");
const cdYml = readFileSync(join(root, ".github/workflows/cd.yml"), "utf8");
const dockerfile = readFileSync(join(root, "Dockerfile"), "utf8");

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

describe("unit: .github/workflows/cd.yml", () => {
	it("publishes images without legacy SSH deployment", () => {
		expect(cdYml).toContain("docker/build-push-action@v6");
		expect(cdYml).not.toContain("VPS_SSH_KEY");
		expect(cdYml).not.toMatch(/^ {2}deploy:/m);
	});

	it("publishes an immutable image tagged with the full triggering commit SHA", () => {
		expect(cdYml).toContain(
			`ghcr.io/\${{ github.repository }}:\${{ github.event.workflow_run.head_sha }}`,
		);
		expect(cdYml).not.toContain("sha_short");
	});

	it("builds the checked-out commit instead of the action Git context", () => {
		expect(cdYml).toContain("context: .");
		expect(cdYml).toContain("Verify checkout SHA");
		expect(cdYml).toContain('git rev-parse HEAD)" = "$EXPECTED_SHA"');
	});

	it("cancels superseded production runs and skips stale commits", () => {
		expect(cdYml).toContain(`group: \${{ github.workflow }}-production`);
		expect(cdYml).toContain("cancel-in-progress: true");
		expect(cdYml).toContain(`github.event.workflow_run.head_sha == github.sha`);
	});

	it("requests a Coolify deployment after the image is published", () => {
		const publishIndex = cdYml.indexOf("docker/build-push-action@v6");
		const deployIndex = cdYml.indexOf("Deploy with Coolify");

		expect(deployIndex).toBeGreaterThan(publishIndex);
		expect(cdYml).toContain("secrets.COOLIFY_WRITE_TOKEN");
		expect(cdYml).toContain("--request PATCH");
		expect(cdYml).toContain(
			"https://antoniofulg.tech/_ops/coolify/blog/deploy",
		);
		expect(cdYml).toContain('"docker_registry_image_tag"');
		expect(cdYml).toContain('"instant_deploy":true');
	});
});

describe("unit: production Dockerfile", () => {
	it("runs migrations and content sync before starting the server", () => {
		expect(dockerfile).toContain(
			'CMD ["sh", "-c", "bun run db:migrate && bun run sync && exec bun .output/server/index.mjs"]',
		);
	});
});
