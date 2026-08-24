import {
	afterEach,
	beforeEach,
	describe,
	expect,
	jest,
	mock,
	test,
} from "bun:test";

// ─── Hoisted mocks ─────────────────────────────────────────────────────────

const mocks = (() => ({
	runAppAudit: jest.fn().mockResolvedValue([]),
	writeReport: jest.fn().mockResolvedValue(undefined),
}))();

mock.module("#/lib/app-audit/checks.server", () => ({
	runAppAudit: mocks.runAppAudit,
}));

mock.module("#/lib/app-audit/reporter.server", () => ({
	writeReport: mocks.writeReport,
}));

import {
	parseBaseUrl,
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
	test("extracts --trigger=foo", () => {
		expect(parseTrigger(["--trigger=foo"])).toBe("foo");
	});

	test("extracts trigger from multi-arg list", () => {
		expect(parseTrigger(["--other=val", "--trigger=ci-pr-42"])).toBe(
			"ci-pr-42",
		);
	});

	test("defaults to 'manual' when no flag", () => {
		expect(parseTrigger([])).toBe("manual");
	});

	test("defaults to 'manual' for unrelated flags", () => {
		expect(parseTrigger(["--routes=/a,/b"])).toBe("manual");
	});

	test("preserves value with hyphens and numbers", () => {
		expect(parseTrigger(["--trigger=workflow-dispatch-123"])).toBe(
			"workflow-dispatch-123",
		);
	});
});

// ─── parseRoutes ───────────────────────────────────────────────────────────

describe("parseRoutes", () => {
	test("parses --routes=/a,/b into array", () => {
		expect(parseRoutes(["--routes=/a,/b"])).toEqual(["/a", "/b"]);
	});

	test("parses single route", () => {
		expect(parseRoutes(["--routes=/"])).toEqual(["/"]);
	});

	test("returns undefined when not present", () => {
		expect(parseRoutes([])).toBeUndefined();
	});

	test("returns undefined for unrelated flags", () => {
		expect(parseRoutes(["--trigger=manual"])).toBeUndefined();
	});

	test("parses three routes", () => {
		expect(parseRoutes(["--routes=/,/about,/blog"])).toEqual([
			"/",
			"/about",
			"/blog",
		]);
	});

	// ─── parseRoutes normalization (issue 003) ─────────────────────────────

	test("--routes= (empty value) returns undefined", () => {
		expect(parseRoutes(["--routes="])).toBeUndefined();
	});

	test("trailing comma stripped: /foo, → ['/foo']", () => {
		expect(parseRoutes(["--routes=/foo,"])).toEqual(["/foo"]);
	});

	test("leading comma stripped: ,/foo,/bar → ['/foo', '/bar']", () => {
		expect(parseRoutes(["--routes=,/foo,/bar"])).toEqual(["/foo", "/bar"]);
	});

	test("whitespace-padded entries trimmed: '/foo, /bar' → ['/foo', '/bar']", () => {
		expect(parseRoutes(["--routes=/foo, /bar"])).toEqual(["/foo", "/bar"]);
	});
});

// ─── parseLighthouse ───────────────────────────────────────────────────────

describe("parseLighthouse", () => {
	test("--lighthouse returns true regardless of CI", () => {
		expect(parseLighthouse(["--lighthouse"], "true")).toBe(true);
	});

	test("--lighthouse returns true when CI not set", () => {
		expect(parseLighthouse(["--lighthouse"], undefined)).toBe(true);
	});

	test("--no-lighthouse returns false regardless of CI", () => {
		expect(parseLighthouse(["--no-lighthouse"], "true")).toBe(false);
	});

	test("--no-lighthouse returns false when CI not set", () => {
		expect(parseLighthouse(["--no-lighthouse"], undefined)).toBe(false);
	});

	test("default with CI=true returns false", () => {
		expect(parseLighthouse([], "true")).toBe(false);
	});

	test("default without CI env returns true", () => {
		expect(parseLighthouse([], undefined)).toBe(true);
	});

	test("--lighthouse takes precedence over --no-lighthouse (first wins)", () => {
		expect(parseLighthouse(["--lighthouse", "--no-lighthouse"], "true")).toBe(
			true,
		);
	});

	test("--no-lighthouse takes precedence when listed first if --lighthouse absent", () => {
		expect(parseLighthouse(["--no-lighthouse"], undefined)).toBe(false);
	});
});

// ─── runAppAuditCli — lighthouse forwarding ────────────────────────────────

describe("runAppAuditCli — lighthouse forwarding", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	test("passes lighthouse=true when --lighthouse flag present", async () => {
		await runAppAuditCli(["--lighthouse"], { CI: "true" });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: true }),
		);
	});

	test("passes lighthouse=false when --no-lighthouse flag present", async () => {
		await runAppAuditCli(["--no-lighthouse"], { CI: undefined });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: false }),
		);
	});

	test("passes lighthouse=false when CI=true and no flag", async () => {
		await runAppAuditCli([], { CI: "true" });
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ lighthouse: false }),
		);
	});

	test("passes lighthouse=true when CI unset and no flag", async () => {
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
		jest.clearAllMocks();
	});

	test("exit 0 when no findings", async () => {
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	test("exit 0 when only major findings", async () => {
		mocks.runAppAudit.mockResolvedValue([makeMajorFinding()]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	test("exit 0 when only minor findings", async () => {
		mocks.runAppAudit.mockResolvedValue([makeMinorFinding()]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(0);
	});

	test("exit 1 when has blocker finding", async () => {
		mocks.runAppAudit.mockResolvedValue([makeBlockerFinding()]);
		const result = await runAppAuditCli([]);
		expect(result.exitCode).toBe(1);
	});

	test("exit 1 when mixed findings with blocker", async () => {
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

	test("countsLine uses stable key=value format", async () => {
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

	test("countsLine zero counts when no findings", async () => {
		const { countsLine } = await runAppAuditCli([]);
		expect(countsLine).toContain("blockers=0");
		expect(countsLine).toContain("majors=0");
		expect(countsLine).toContain("minors=0");
	});

	test("countsLine present even when exit 1", async () => {
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

	test("summary line contains severity counts", async () => {
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

	test("summary line contains today's report path", async () => {
		const { summaryLine } = await runAppAuditCli([]);
		const today = new Date().toISOString().slice(0, 10);
		expect(summaryLine).toContain(`docs/_reports/app-audit-${today}.md`);
	});

	test("reportPath matches today's date", async () => {
		const { reportPath } = await runAppAuditCli([]);
		const today = new Date().toISOString().slice(0, 10);
		expect(reportPath).toBe(`docs/_reports/app-audit-${today}.md`);
	});

	test("zero counts when no findings", async () => {
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

	test("passes --trigger value to writeReport", async () => {
		await runAppAuditCli(["--trigger=ci-pr-42"]);
		expect(mocks.writeReport).toHaveBeenCalledWith([], "ci-pr-42");
	});

	test("passes 'manual' to writeReport when no flag", async () => {
		await runAppAuditCli([]);
		expect(mocks.writeReport).toHaveBeenCalledWith([], "manual");
	});
});

// ─── parseBaseUrl (issue 005) ──────────────────────────────────────────────

describe("parseBaseUrl", () => {
	test("extracts --baseUrl=http://localhost:4173", () => {
		expect(parseBaseUrl(["--baseUrl=http://localhost:4173"])).toBe(
			"http://localhost:4173",
		);
	});

	test("returns undefined when flag absent", () => {
		expect(parseBaseUrl([])).toBeUndefined();
	});

	test("returns undefined for unrelated flags", () => {
		expect(parseBaseUrl(["--trigger=manual", "--lighthouse"])).toBeUndefined();
	});

	test("preserves equals sign in URL value: --baseUrl=http://host?debug=1", () => {
		expect(parseBaseUrl(["--baseUrl=http://host:3000?debug=1"])).toBe(
			"http://host:3000?debug=1",
		);
	});

	test("extracts from multi-arg list", () => {
		expect(
			parseBaseUrl([
				"--lighthouse",
				"--baseUrl=http://staging:8080",
				"--trigger=ci",
			]),
		).toBe("http://staging:8080");
	});
});

// ─── runAppAuditCli — routes forwarding (issue 001) ───────────────────────

describe("runAppAuditCli — routes forwarding", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test("passes routes array when --routes flag present", async () => {
		await runAppAuditCli(["--routes=/login,/admin"]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ routes: ["/login", "/admin"] }),
		);
	});

	test("passes routes: undefined when no --routes flag", async () => {
		await runAppAuditCli([]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ routes: undefined }),
		);
	});

	test("passes routes: undefined when --routes= is empty", async () => {
		await runAppAuditCli(["--routes="]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ routes: undefined }),
		);
	});
});

// ─── runAppAuditCli — baseUrl forwarding (issue 005) ──────────────────────

describe("runAppAuditCli — baseUrl forwarding", () => {
	beforeEach(() => {
		mocks.runAppAudit.mockResolvedValue([]);
		mocks.writeReport.mockResolvedValue(undefined);
	});

	afterEach(() => {
		jest.clearAllMocks();
	});

	test("passes baseUrl when --baseUrl flag present", async () => {
		await runAppAuditCli(["--baseUrl=http://localhost:4173"]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ baseUrl: "http://localhost:4173" }),
		);
	});

	test("passes baseUrl: undefined when flag absent", async () => {
		await runAppAuditCli([]);
		expect(mocks.runAppAudit).toHaveBeenCalledWith(
			expect.objectContaining({ baseUrl: undefined }),
		);
	});
});
