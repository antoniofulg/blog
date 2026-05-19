import { execFile } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	runContentAudit: vi.fn().mockResolvedValue([]),
	writeReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/lib/content-audit/checks.server", () => ({
	runContentAudit: mocks.runContentAudit,
}));

vi.mock("#/lib/content-audit/reporter.server", () => ({
	writeReport: mocks.writeReport,
}));

import {
	parseContentDir,
	parseTrigger,
	runAuditCli,
} from "../../scripts/audit-content";

// ─── Helpers ───────────────────────────────────────────────────────────────

const execFileAsync = promisify(execFile);

function isPortFree(port: number): Promise<boolean> {
	return new Promise((res) => {
		const server = createServer();
		server.listen(port, () => server.close(() => res(true)));
		server.on("error", () => res(false));
	});
}

const port5432Free = await isPortFree(5432);

function makeBlockerFinding() {
	return {
		category: "frontmatter-invalid" as const,
		severity: "blocker" as const,
		filePath: "a.mdx",
		message: "Missing required frontmatter field: title",
	};
}

function makeMajorFinding() {
	return {
		category: "translation-gap" as const,
		severity: "major" as const,
		filePath: "b.mdx",
		message: "Post has no translation twin.",
	};
}

function makeMinorFinding() {
	return {
		category: "series-gap" as const,
		severity: "minor" as const,
		filePath: "c.mdx",
		message: "Series gap detected.",
	};
}

// ─── parseTrigger ──────────────────────────────────────────────────────────

describe("parseTrigger", () => {
	it("extracts --trigger=foo", () => {
		expect(parseTrigger(["--trigger=foo"])).toBe("foo");
	});

	it("extracts trigger from multi-arg list", () => {
		expect(parseTrigger(["--other=val", "--trigger=ci-pr-42"])).toBe(
			"ci-pr-42",
		);
	});

	it("defaults to 'manual' when no flag", () => {
		expect(parseTrigger([])).toBe("manual");
	});

	it("defaults to 'manual' for unrelated flags", () => {
		expect(parseTrigger(["--content-dir=/tmp"])).toBe("manual");
	});

	it("preserves value with hyphens and numbers", () => {
		expect(parseTrigger(["--trigger=workflow-dispatch-123"])).toBe(
			"workflow-dispatch-123",
		);
	});
});

// ─── parseContentDir ───────────────────────────────────────────────────────

describe("parseContentDir", () => {
	it("extracts --content-dir=/some/path", () => {
		expect(parseContentDir(["--content-dir=/some/path"])).toBe("/some/path");
	});

	it("returns undefined when not present", () => {
		expect(parseContentDir([])).toBeUndefined();
	});

	it("returns undefined for unrelated flags", () => {
		expect(parseContentDir(["--trigger=manual"])).toBeUndefined();
	});
});

// ─── runAuditCli — exit codes ──────────────────────────────────────────────

describe("runAuditCli — exit codes", () => {
	beforeEach(() => {
		mocks.runContentAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("exit 0 when no findings", async () => {
		const result = await runAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	it("exit 0 when only major findings", async () => {
		mocks.runContentAudit.mockResolvedValue([makeMajorFinding()]);
		const result = await runAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	it("exit 0 when only minor findings", async () => {
		mocks.runContentAudit.mockResolvedValue([makeMinorFinding()]);
		const result = await runAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	it("exit 1 when has blocker finding", async () => {
		mocks.runContentAudit.mockResolvedValue([makeBlockerFinding()]);
		const result = await runAuditCli([]);
		expect(result.exitCode).toBe(1);
	});

	it("exit 1 when mixed findings with blocker", async () => {
		mocks.runContentAudit.mockResolvedValue([
			makeBlockerFinding(),
			makeMajorFinding(),
			makeMinorFinding(),
		]);
		const result = await runAuditCli([]);
		expect(result.exitCode).toBe(1);
	});
});

// ─── runAuditCli — summary line ────────────────────────────────────────────

describe("runAuditCli — summary line format", () => {
	beforeEach(() => {
		mocks.runContentAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("summary line contains severity counts", async () => {
		mocks.runContentAudit.mockResolvedValue([
			makeBlockerFinding(),
			makeMajorFinding(),
			makeMinorFinding(),
		]);
		const { summaryLine } = await runAuditCli([]);
		expect(summaryLine).toMatch(/1 blocker/);
		expect(summaryLine).toMatch(/1 major/);
		expect(summaryLine).toMatch(/1 minor/);
	});

	it("summary line contains today's report path", async () => {
		const { summaryLine } = await runAuditCli([]);
		const today = new Date().toISOString().slice(0, 10);
		expect(summaryLine).toContain(`docs/_reports/content-audit-${today}.md`);
	});

	it("reportPath matches today's date", async () => {
		const { reportPath } = await runAuditCli([]);
		const today = new Date().toISOString().slice(0, 10);
		expect(reportPath).toBe(`docs/_reports/content-audit-${today}.md`);
	});

	it("zero counts when no findings", async () => {
		const { summaryLine } = await runAuditCli([]);
		expect(summaryLine).toMatch(/0 blocker/);
		expect(summaryLine).toMatch(/0 major/);
		expect(summaryLine).toMatch(/0 minor/);
	});
});

// ─── runAuditCli — trigger forwarding ──────────────────────────────────────

describe("runAuditCli — trigger forwarding", () => {
	beforeEach(() => {
		mocks.runContentAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("passes --trigger value to writeReport", async () => {
		await runAuditCli(["--trigger=ci-pr-42"]);
		expect(mocks.writeReport).toHaveBeenCalledWith([], "ci-pr-42");
	});

	it("passes 'manual' to writeReport when no flag", async () => {
		await runAuditCli([]);
		expect(mocks.writeReport).toHaveBeenCalledWith([], "manual");
	});
});

// ─── runAuditCli — content dir forwarding ──────────────────────────────────

describe("runAuditCli — content dir forwarding", () => {
	beforeEach(() => {
		mocks.runContentAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("passes --content-dir to runContentAudit", async () => {
		await runAuditCli(["--content-dir=/tmp/test"]);
		expect(mocks.runContentAudit).toHaveBeenCalledWith("/tmp/test");
	});

	it("passes undefined when no --content-dir", async () => {
		await runAuditCli([]);
		expect(mocks.runContentAudit).toHaveBeenCalledWith(undefined);
	});
});

// ─── Integration: subprocess (requires live Postgres on port 5432) ─────────

describe.skipIf(port5432Free)("integration: subprocess", () => {
	let tmpDir: string;

	afterAll(async () => {
		if (tmpDir) await rm(tmpDir, { recursive: true, force: true });
	});

	const scriptPath = resolve(
		import.meta.dirname,
		"../../scripts/audit-content.ts",
	);
	const DB_URL = "postgres://blog:blog@localhost:5432/blog";

	it("exit 0 on clean content tree", async () => {
		await expect(
			execFileAsync("bun", ["run", scriptPath, "--trigger=test-int-clean"], {
				env: { ...process.env, DATABASE_URL: DB_URL },
				timeout: 30000,
			}),
		).resolves.toMatchObject({ stderr: "" });
	}, 35000);

	it("exit 1 when fixture has a blocker (missing title)", async () => {
		tmpDir = await mkdtemp(join(tmpdir(), "audit-cli-test-"));
		const enDir = join(tmpDir, "en");
		await mkdir(enDir, { recursive: true });
		await writeFile(
			join(enDir, "no-title.mdx"),
			"---\ndescription: no title here\n---\nContent.",
		);

		await expect(
			execFileAsync(
				"bun",
				[
					"run",
					scriptPath,
					"--trigger=test-int-blocker",
					`--content-dir=${tmpDir}`,
				],
				{ env: { ...process.env, DATABASE_URL: DB_URL }, timeout: 30000 },
			),
		).rejects.toMatchObject({ code: 1 });
	}, 35000);

	it("SUMMARY.md row count increases by 1 per invocation", async () => {
		const summaryPath = resolve(
			import.meta.dirname,
			"../../docs/audits/SUMMARY.md",
		);

		async function rowCount(): Promise<number> {
			const content = await readFile(summaryPath, "utf-8");
			return content
				.split("\n")
				.filter(
					(l) =>
						l.startsWith("|") &&
						!l.startsWith("| Date") &&
						!l.startsWith("| ---"),
				).length;
		}

		const before = await rowCount();

		await execFileAsync(
			"bun",
			["run", scriptPath, "--trigger=test-int-rowcount"],
			{ env: { ...process.env, DATABASE_URL: DB_URL }, timeout: 30000 },
		).catch(() => {
			// exit 1 is OK if there are blockers — we just care about row count
		});

		const after = await rowCount();
		expect(after).toBe(before + 1);
	}, 35000);
});
