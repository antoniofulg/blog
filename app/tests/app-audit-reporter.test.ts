import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { AppAuditFinding } from "#/lib/app-audit/browser-sweep.server";
import { initSummary, writeReport } from "#/lib/app-audit/reporter.server";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeF(
	category: AppAuditFinding["category"],
	severity: AppAuditFinding["severity"],
	msg = "test message",
): AppAuditFinding {
	return { category, severity, filePath: "/test", message: msg };
}

const PRE_PHASE4_HEADER =
	"| Date       | Run trigger      | Blocker | Major | Minor | Top finding                                  |\n" +
	"| ---------- | ---------------- | ------- | ----- | ----- | -------------------------------------------- |\n";

function makePrePhase4Summary(rows: string[]): string {
	return PRE_PHASE4_HEADER + rows.join("");
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(async () => {
	tmpDir = await mkdtemp(join(tmpdir(), "app-audit-reporter-"));
	vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
});

afterEach(async () => {
	vi.restoreAllMocks();
	await rm(tmpDir, { recursive: true, force: true });
});

// ─── writeReport ─────────────────────────────────────────────────────────────

describe("writeReport", () => {
	it("creates per-run report at expected path", async () => {
		await writeReport([], "manual");
		const date = new Date().toISOString().slice(0, 10);
		const reportPath = join(tmpDir, "docs/_reports", `app-audit-${date}.md`);
		const content = await readFile(reportPath, "utf-8");
		expect(content).toContain(`# App Audit — ${date}`);
	});

	it("report contains sections for all 12 categories", async () => {
		await writeReport([], "manual");
		const date = new Date().toISOString().slice(0, 10);
		const content = await readFile(
			join(tmpDir, "docs/_reports", `app-audit-${date}.md`),
			"utf-8",
		);

		const categories = [
			"console-error",
			"hydration-mismatch",
			"network-fail",
			"broken-image",
			"missing-meta",
			"mixed-content",
			"slow-response",
			"a11y-violation",
			"seo-score-drop",
			"perf-budget-breach",
			"best-practices-fail",
			"sweep-error",
		];
		for (const cat of categories) {
			expect(content).toContain(`## ${cat}`);
		}
	});

	it("empty categories show (none)", async () => {
		await writeReport([], "manual");
		const date = new Date().toISOString().slice(0, 10);
		const content = await readFile(
			join(tmpDir, "docs/_reports", `app-audit-${date}.md`),
			"utf-8",
		);
		expect(content).toContain("(none)");
	});

	it("report embeds audit-fingerprint HTML comment in header", async () => {
		const findings: AppAuditFinding[] = [
			makeF("console-error", "blocker"),
			makeF("missing-meta", "major"),
		];
		await writeReport(findings, "manual");
		const date = new Date().toISOString().slice(0, 10);
		const content = await readFile(
			join(tmpDir, "docs/_reports", `app-audit-${date}.md`),
			"utf-8",
		);
		expect(content).toContain(
			"<!-- audit-fingerprint:app:blocker=1 major=1 -->",
		);
	});

	it("appends row to SUMMARY.md with Type: app", async () => {
		await writeReport([], "ci-pr-42");
		const summary = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(summary).toContain("| app");
		expect(summary).toContain("ci-pr-42");
	});

	it("severity-sort: blocker picked as top finding even when last in array", async () => {
		const findings: AppAuditFinding[] = [
			makeF("slow-response", "minor", "slow paint"),
			makeF("missing-meta", "major", "og:image missing"),
			makeF("console-error", "blocker", "TypeError in /admin"),
		];
		await writeReport(findings, "manual");
		const summary = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(summary).toContain("console-error");
	});

	it("severity-sort: major picked over minor when no blocker", async () => {
		const findings: AppAuditFinding[] = [
			makeF("slow-response", "minor", "slow paint"),
			makeF("missing-meta", "major", "og:image"),
		];
		await writeReport(findings, "manual");
		const summary = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(summary).toContain("missing-meta");
	});
});

// ─── initSummary ─────────────────────────────────────────────────────────────

describe("initSummary", () => {
	it("empty file → writes header with Type column", async () => {
		await initSummary();
		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(content).toContain("| Type");
		expect(content).toContain("| -------");
	});

	it("missing file → creates new summary with Type column", async () => {
		// No pre-existing file; initSummary should create it
		await initSummary();
		const content = await readFile(
			join(tmpDir, "docs/audits/SUMMARY.md"),
			"utf-8",
		);
		expect(content).toContain("| Date       | Type    |");
	});

	it("pre-Phase-4 fixture: header gets Type column inserted", async () => {
		const summaryDir = join(tmpDir, "docs/audits");
		await import("node:fs/promises").then((fs) =>
			fs.mkdir(summaryDir, { recursive: true }),
		);
		await writeFile(
			join(summaryDir, "SUMMARY.md"),
			makePrePhase4Summary([]),
			"utf-8",
		);

		await initSummary();

		const content = await readFile(join(summaryDir, "SUMMARY.md"), "utf-8");
		expect(content).toContain("| Date       | Type    | Run trigger      |");
		expect(content).toContain("| ---------- | ------- | ---------------- |");
	});

	it("pre-Phase-4 fixture: existing data rows backfilled with content", async () => {
		const summaryDir = join(tmpDir, "docs/audits");
		await import("node:fs/promises").then((fs) =>
			fs.mkdir(summaryDir, { recursive: true }),
		);
		const rows = [
			"| 2026-05-01 | manual           | 0       | 0     | 0     | no findings                                  |\n",
			"| 2026-05-02 | PR #10 (push)    | 1       | 2     | 3     | broken-link: missing twin                    |\n",
			"| 2026-05-03 | test-int-clean   | 0       | 0     | 0     | no findings                                  |\n",
		];
		await writeFile(
			join(summaryDir, "SUMMARY.md"),
			makePrePhase4Summary(rows),
			"utf-8",
		);

		await initSummary();

		const content = await readFile(join(summaryDir, "SUMMARY.md"), "utf-8");
		const dataLines = content
			.split("\n")
			.filter((l) => l.startsWith("| 2026-"));
		expect(dataLines).toHaveLength(3);
		for (const line of dataLines) {
			expect(line).toContain("| content |");
		}
	});

	it("idempotent: calling twice on pre-Phase-4 fixture does not duplicate header", async () => {
		const summaryDir = join(tmpDir, "docs/audits");
		await import("node:fs/promises").then((fs) =>
			fs.mkdir(summaryDir, { recursive: true }),
		);
		const rows = [
			"| 2026-05-01 | manual           | 0       | 0     | 0     | no findings                                  |\n",
		];
		await writeFile(
			join(summaryDir, "SUMMARY.md"),
			makePrePhase4Summary(rows),
			"utf-8",
		);

		await initSummary();
		await initSummary(); // second call

		const content = await readFile(join(summaryDir, "SUMMARY.md"), "utf-8");
		// Header row should appear exactly once
		const headerCount = content
			.split("\n")
			.filter((l) => l.includes("| Date") && l.includes("| Type")).length;
		expect(headerCount).toBe(1);
	});

	it("idempotent: calling twice on already-migrated file is a no-op", async () => {
		const summaryDir = join(tmpDir, "docs/audits");
		await import("node:fs/promises").then((fs) =>
			fs.mkdir(summaryDir, { recursive: true }),
		);
		const migratedContent =
			"| Date       | Type    | Run trigger      | Blocker | Major | Minor | Top finding                                  |\n" +
			"| ---------- | ------- | ---------------- | ------- | ----- | ----- | -------------------------------------------- |\n" +
			"| 2026-05-01 | content | manual           | 0       | 0     | 0     | no findings                                  |\n";

		await writeFile(join(summaryDir, "SUMMARY.md"), migratedContent, "utf-8");

		await initSummary();

		const content = await readFile(join(summaryDir, "SUMMARY.md"), "utf-8");
		expect(content).toBe(migratedContent);
	});

	it("atomic write: no .tmp file left after migration completes", async () => {
		const summaryDir = join(tmpDir, "docs/audits");
		await import("node:fs/promises").then((fs) =>
			fs.mkdir(summaryDir, { recursive: true }),
		);
		const summaryPath = join(summaryDir, "SUMMARY.md");
		await writeFile(summaryPath, makePrePhase4Summary([]), "utf-8");

		await initSummary();

		// temp file must be gone
		const tmpExists = await readFile(`${summaryPath}.tmp`, "utf-8")
			.then(() => true)
			.catch(() => false);
		expect(tmpExists).toBe(false);

		// migrated file must exist and have Type column
		const content = await readFile(summaryPath, "utf-8");
		expect(content).toContain("| Type");
	});
});

// ─── Integration: migration round-trip ───────────────────────────────────────

describe("SUMMARY migration round-trip", () => {
	it("pre-migration fixture → initSummary → 3 backfilled rows → app row appended", async () => {
		const summaryDir = join(tmpDir, "docs/audits");
		await import("node:fs/promises").then((fs) =>
			fs.mkdir(summaryDir, { recursive: true }),
		);
		const rows = [
			"| 2026-05-01 | manual           | 0       | 0     | 0     | no findings                                  |\n",
			"| 2026-05-02 | PR #1            | 1       | 0     | 0     | broken-link: x                               |\n",
			"| 2026-05-03 | test-clean       | 0       | 0     | 0     | no findings                                  |\n",
		];
		await writeFile(
			join(summaryDir, "SUMMARY.md"),
			makePrePhase4Summary(rows),
			"utf-8",
		);

		// writeReport calls initSummary internally before appending
		await writeReport(
			[makeF("console-error", "blocker", "TypeError on /")],
			"manual",
		);

		const content = await readFile(join(summaryDir, "SUMMARY.md"), "utf-8");
		const dataLines = content
			.split("\n")
			.filter((l) => l.startsWith("| 2026-"));

		// 3 original + 1 new
		expect(dataLines).toHaveLength(4);

		// Original rows backfilled with content
		const contentRows = dataLines.filter((l) => l.includes("| content |"));
		expect(contentRows).toHaveLength(3);

		// New row has app type
		const appRows = dataLines.filter((l) => l.includes("| app"));
		expect(appRows).toHaveLength(1);
		expect(appRows[0]).toContain("manual");
	});
});
