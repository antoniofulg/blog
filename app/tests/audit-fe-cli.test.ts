import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => ({
	runAppAudit: vi.fn().mockResolvedValue([]),
	writeReport: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("#/lib/app-audit/checks.server", () => ({
	runAppAudit: mocks.runAppAudit,
}));

vi.mock("#/lib/app-audit/reporter.server", () => ({
	writeReport: mocks.writeReport,
}));

import {
	parseLighthouse,
	parseRoutes,
	parseTrigger,
	runAppAuditCli,
} from "../../scripts/audit-fe";

// ─── Helpers ───────────────────────────────────────────────────────────────

function makeBlockerFinding() {
	return {
		category: "console-error" as const,
		severity: "blocker" as const,
		filePath: "http://localhost:3000/",
		message: "Uncaught TypeError: Cannot read property of undefined",
	};
}

function makeMajorFinding() {
	return {
		category: "a11y-violation" as const,
		severity: "major" as const,
		filePath: "http://localhost:3000/",
		message: "Images must have alternate text",
	};
}

function makeMinorFinding() {
	return {
		category: "missing-meta" as const,
		severity: "minor" as const,
		filePath: "http://localhost:3000/",
		message: "Missing meta description",
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
		expect(parseTrigger(["--routes=/a,/b"])).toBe("manual");
	});

	it("preserves value with hyphens and numbers", () => {
		expect(parseTrigger(["--trigger=workflow-dispatch-123"])).toBe(
			"workflow-dispatch-123",
		);
	});
});

// ─── parseRoutes ───────────────────────────────────────────────────────────

describe("parseRoutes", () => {
	it("parses --routes=/a,/b into array", () => {
		expect(parseRoutes(["--routes=/a,/b"])).toEqual(["/a", "/b"]);
	});

	it("parses single route", () => {
		expect(parseRoutes(["--routes=/"])).toEqual(["/"]);
	});

	it("returns undefined when not present", () => {
		expect(parseRoutes([])).toBeUndefined();
	});

	it("returns undefined for unrelated flags", () => {
		expect(parseRoutes(["--trigger=manual"])).toBeUndefined();
	});

	it("parses three routes", () => {
		expect(parseRoutes(["--routes=/,/about,/blog"])).toEqual([
			"/",
			"/about",
			"/blog",
		]);
	});

	// ─── parseRoutes normalization (issue 003) ─────────────────────────────

	it("--routes= (empty value) returns undefined", () => {
		expect(parseRoutes(["--routes="])).toBeUndefined();
	});

	it("trailing comma stripped: /foo, → ['/foo']", () => {
		expect(parseRoutes(["--routes=/foo,"])).toEqual(["/foo"]);
	});

	it("leading comma stripped: ,/foo,/bar → ['/foo', '/bar']", () => {
		expect(parseRoutes(["--routes=,/foo,/bar"])).toEqual(["/foo", "/bar"]);
	});

	it("whitespace-padded entries trimmed: '/foo, /bar' → ['/foo', '/bar']", () => {
		expect(parseRoutes(["--routes=/foo, /bar"])).toEqual(["/foo", "/bar"]);
	});
});

// ─── parseLighthouse ───────────────────────────────────────────────────────

describe("parseLighthouse", () => {
	it("--lighthouse returns true regardless of CI", () => {
		expect(parseLighthouse(["--lighthouse"], "true")).toBe(true);
	});

	it("--lighthouse returns true when CI not set", () => {
		expect(parseLighthouse(["--lighthouse"], undefined)).toBe(true);
	});

	it("--no-lighthouse returns false regardless of CI", () => {
		expect(parseLighthouse(["--no-lighthouse"], "true")).toBe(false);
	});

	it("--no-lighthouse returns false when CI not set", () => {
		expect(parseLighthouse(["--no-lighthouse"], undefined)).toBe(false);
	});

	it("default with CI=true returns false", () => {
		expect(parseLighthouse([], "true")).toBe(false);
	});

	it("default without CI env returns true", () => {
		expect(parseLighthouse([], undefined)).toBe(true);
	});

	it("--lighthouse takes precedence over --no-lighthouse (first wins)", () => {
		expect(parseLighthouse(["--lighthouse", "--no-lighthouse"], "true")).toBe(
			true,
		);
	});

	it("--no-lighthouse takes precedence when listed first if --lighthouse absent", () => {
		expect(parseLighthouse(["--no-lighthouse"], undefined)).toBe(false);
	});
});

// ─── runAppAuditCli — lighthouse forwarding ────────────────────────────────

describe("runAppAuditCli — lighthouse forwarding", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("passes lighthouse=true when --lighthouse flag present", async () => {
		await runAppAuditCli(["--lighthouse"], { CI: "true" });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: true }),
		);
	});

	it("passes lighthouse=false when --no-lighthouse flag present", async () => {
		await runAppAuditCli(["--no-lighthouse"], { CI: undefined });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: false }),
		);
	});

	it("passes lighthouse=false when CI=true and no flag", async () => {
		await runAppAuditCli([], { CI: "true" });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: false }),
		);
	});

	it("passes lighthouse=true when CI unset and no flag", async () => {
		await runAppAuditCli([], { CI: undefined });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: true }),
		);
	});
});

// ─── runAppAuditCli — exit codes ───────────────────────────────────────────

describe("runAppAuditCli — exit codes", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("exit 0 when no findings", async () => {
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	it("exit 0 when only major findings", async () => {
		mocks.runAppAudit.mockResolvedValue([makeMajorFinding()]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	it("exit 0 when only minor findings", async () => {
		mocks.runAppAudit.mockResolvedValue([makeMinorFinding()]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	it("exit 1 when has blocker finding", async () => {
		mocks.runAppAudit.mockResolvedValue([makeBlockerFinding()]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(1);
	});

	it("exit 1 when mixed findings with blocker", async () => {
		mocks.runAppAudit.mockResolvedValue([
			makeBlockerFinding(),
			makeMajorFinding(),
			makeMinorFinding(),
		]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(1);
	});
});

// ─── runAppAuditCli — countsLine ───────────────────────────────────────────

describe("runAppAuditCli — countsLine format", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("countsLine uses stable key=value format", async () => {
		mocks.runAppAudit.mockResolvedValue([
			makeBlockerFinding(),
			makeMajorFinding(),
			makeMinorFinding(),
		]);
		const { countsLine } = await runAppAuditCli([]);
		expect(countsLine).toMatch(/^\[audit-counts\]/);
		expect(countsLine).toContain("blockers=1");
		expect(countsLine).toContain("majors=1");
		expect(countsLine).toContain("minors=1");
	});

	it("countsLine zero counts when no findings", async () => {
		const { countsLine } = await runAppAuditCli([]);
		expect(countsLine).toContain("blockers=0");
		expect(countsLine).toContain("majors=0");
		expect(countsLine).toContain("minors=0");
	});

	it("countsLine present even when exit 1", async () => {
		mocks.runAppAudit.mockResolvedValue([makeBlockerFinding()]);
		const { countsLine, exitCode } = await runAppAuditCli([]);
		expect(exitCode).toBe(1);
		expect(countsLine).toMatch(/^\[audit-counts\]/);
		expect(countsLine).toContain("blockers=1");
	});
});

// ─── runAppAuditCli — summary line ─────────────────────────────────────────

describe("runAppAuditCli — summary line format", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("summary line contains severity counts", async () => {
		mocks.runAppAudit.mockResolvedValue([
			makeBlockerFinding(),
			makeMajorFinding(),
			makeMinorFinding(),
		]);
		const { summaryLine } = await runAppAuditCli([]);
		expect(summaryLine).toMatch(/1 blocker/);
		expect(summaryLine).toMatch(/1 major/);
		expect(summaryLine).toMatch(/1 minor/);
	});

	it("summary line contains today's report path", async () => {
		const { summaryLine } = await runAppAuditCli([]);
		const today = new Date().toISOString().slice(0, 10);
		expect(summaryLine).toContain(`docs/_reports/app-audit-${today}.md`);
	});

	it("reportPath matches today's date", async () => {
		const { reportPath } = await runAppAuditCli([]);
		const today = new Date().toISOString().slice(0, 10);
		expect(reportPath).toBe(`docs/_reports/app-audit-${today}.md`);
	});

	it("zero counts when no findings", async () => {
		const { summaryLine } = await runAppAuditCli([]);
		expect(summaryLine).toMatch(/0 blocker/);
		expect(summaryLine).toMatch(/0 major/);
		expect(summaryLine).toMatch(/0 minor/);
	});
});

// ─── runAppAuditCli — trigger forwarding ───────────────────────────────────

describe("runAppAuditCli — trigger forwarding", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	it("passes --trigger value to writeReport", async () => {
		await runAppAuditCli(["--trigger=ci-pr-42"]);
		expect(mocks.writeReport).toHaveBeenCalledWith([], "ci-pr-42");
	});

	it("passes 'manual' to writeReport when no flag", async () => {
		await runAppAuditCli([]);
		expect(mocks.writeReport).toHaveBeenCalledWith([], "manual");
	});
});

// ─── runAppAuditCli — routes forwarding (issue 001) ───────────────────────

describe("runAppAuditCli — routes forwarding", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	afterEach(() => {
		vi.clearAllMocks();
	});

	it("passes routes array when --routes flag present", async () => {
		await runAppAuditCli(["--routes=/login,/admin"]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ routes: ["/login", "/admin"] }),
		);
	});

	it("passes routes: undefined when no --routes flag", async () => {
		await runAppAuditCli([]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ routes: undefined }),
		);
	});

	it("passes routes: undefined when --routes= is empty", async () => {
		await runAppAuditCli(["--routes="]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ routes: undefined }),
		);
	});
});
