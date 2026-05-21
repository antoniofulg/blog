import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, test } from "vitest";
import {
	computeAgeHours,
	scanDir,
	scanFile,
} from "../../scripts/lint-test-annotations";

const FIXTURES = join(import.meta.dirname, "fixtures/lint-annotations");
const E2E_DIR = join(import.meta.dirname, "../../tests/e2e");

function isoAgo(days: number): string {
	const d = new Date();
	d.setUTCDate(d.getUTCDate() - days);
	return d.toISOString().slice(0, 10);
}

// ─── Unit: computeAgeHours ────────────────────────────────────────────────────

describe("computeAgeHours", () => {
	test("date 3 days ago → ~72h", () => {
		expect(computeAgeHours(isoAgo(3))).toBeGreaterThan(71);
	});

	test("date 1 day ago → between 0h and 48h", () => {
		const hours = computeAgeHours(isoAgo(1));
		expect(hours).toBeGreaterThan(0);
		expect(hours).toBeLessThan(48);
	});

	test("future date → negative hours", () => {
		const future = new Date();
		future.setUTCDate(future.getUTCDate() + 1);
		expect(computeAgeHours(future.toISOString().slice(0, 10))).toBeLessThan(0);
	});
});

// ─── Unit: scanFile ───────────────────────────────────────────────────────────

describe("scanFile — happy paths", () => {
	test("file with no annotations → no offenses", () => {
		const content = `declare const test: any;\ntest("simple test", () => {});\n`;
		expect(scanFile(content, "clean.ts")).toEqual([]);
	});

	test("@flaky tag with date within 48h → no offense", () => {
		const date = isoAgo(1);
		const content = [
			"declare const test: any;",
			`// added: ${date}`,
			`test("flaky", { tag: ["@flaky"] }, () => {});`,
		].join("\n");
		expect(scanFile(content, "test.ts")).toEqual([]);
	});

	test("test.skip with trailing same-line date comment → no offense", () => {
		const date = isoAgo(1);
		const content = `declare const test: any;\ntest.skip("s", () => {}); // added: ${date}\n`;
		expect(scanFile(content, "test.ts")).toEqual([]);
	});

	test("string literal containing @flaky → no offense", () => {
		const content = `const msg = "this test is @flaky";\n`;
		expect(scanFile(content, "test.ts")).toEqual([]);
	});

	test("comment referencing test.skip → no offense", () => {
		const content = [
			"// test.skip is useful for quarantine",
			"declare const test: any;",
			'test("normal test", () => {});',
		].join("\n");
		expect(scanFile(content, "test.ts")).toEqual([]);
	});

	test("@flaky only in a comment → no offense", () => {
		const content = `// @flaky tests need a date comment\ndeclare const test: any;\n`;
		expect(scanFile(content, "test.ts")).toEqual([]);
	});
});

describe("scanFile — offense cases", () => {
	test("test.skip with date >48h old → SLA offense", () => {
		const date = isoAgo(3);
		const content = [
			"declare const test: any;",
			`// added: ${date}`,
			`test.skip("old skip", () => {});`,
		].join("\n");
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/test\.skip/);
		expect(offenses[0]).toMatch(/exceeds 48h SLA/);
	});

	test("test.todo with date >48h old → SLA offense", () => {
		const date = isoAgo(3);
		const content = [
			"declare const test: any;",
			`// added: ${date}`,
			`test.todo("old todo");`,
		].join("\n");
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/test\.todo/);
		expect(offenses[0]).toMatch(/exceeds 48h SLA/);
	});

	test("@flaky tag with date >48h old → SLA offense", () => {
		const date = isoAgo(3);
		const content = [
			"declare const test: any;",
			`// added: ${date}`,
			`test("flaky test", { tag: ["@flaky"] }, () => {});`,
		].join("\n");
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/@flaky/);
		expect(offenses[0]).toMatch(/exceeds 48h SLA/);
	});

	test("test.skip with no date comment → missing-date offense", () => {
		const content = [
			"declare const test: any;",
			`test.skip("undated skip", () => {});`,
		].join("\n");
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/test\.skip/);
		expect(offenses[0]).toMatch(/missing ISO-date comment/);
	});

	test("test.todo with no date comment → missing-date offense", () => {
		const content = `declare const test: any;\ntest.todo("undated todo");\n`;
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/test\.todo/);
		expect(offenses[0]).toMatch(/missing ISO-date comment/);
	});

	test("@flaky tag with no date comment → missing-date offense", () => {
		const content = `declare const test: any;\ntest("flaky", { tag: ["@flaky"] }, () => {});\n`;
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/@flaky/);
		expect(offenses[0]).toMatch(/missing ISO-date comment/);
	});

	test("offense message includes file path and line number", () => {
		const content = `declare const test: any;\ntest.skip("s", () => {});\n`;
		const offenses = scanFile(content, "tests/e2e/foo.ts");
		expect(offenses[0]).toMatch(/^tests\/e2e\/foo\.ts:2:/);
	});

	test("multiple annotations → multiple offenses", () => {
		const oldDate = isoAgo(3);
		const content = [
			"declare const test: any;",
			`// added: ${oldDate}`,
			`test.skip("skip1", () => {});`,
			`test.todo("todo1");`,
		].join("\n");
		const offenses = scanFile(content, "test.ts");
		expect(offenses).toHaveLength(2);
	});
});

// ─── Integration: fixture files ───────────────────────────────────────────────

describe("fixtures", () => {
	test("clean.ts → no offenses", async () => {
		const content = await readFile(join(FIXTURES, "clean.ts"), "utf-8");
		expect(scanFile(content, "clean.ts")).toEqual([]);
	});

	test("expired-skip.ts → one SLA offense", async () => {
		const content = await readFile(join(FIXTURES, "expired-skip.ts"), "utf-8");
		const offenses = scanFile(content, "expired-skip.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/test\.skip/);
		expect(offenses[0]).toMatch(/exceeds 48h SLA/);
	});

	test("missing-date-todo.ts → one missing-date offense", async () => {
		const content = await readFile(
			join(FIXTURES, "missing-date-todo.ts"),
			"utf-8",
		);
		const offenses = scanFile(content, "missing-date-todo.ts");
		expect(offenses).toHaveLength(1);
		expect(offenses[0]).toMatch(/test\.todo/);
		expect(offenses[0]).toMatch(/missing ISO-date comment/);
	});

	test("string-literal-flaky.ts → no offenses (AST ignores comments and strings)", async () => {
		const content = await readFile(
			join(FIXTURES, "string-literal-flaky.ts"),
			"utf-8",
		);
		expect(scanFile(content, "string-literal-flaky.ts")).toEqual([]);
	});
});

// ─── Integration: real e2e directory ─────────────────────────────────────────

describe("real e2e dir", () => {
	test("tests/e2e/ tree with no annotations → scanDir exits clean", async () => {
		const offenses = await scanDir(E2E_DIR, process.cwd());
		expect(offenses).toEqual([]);
	});
});
