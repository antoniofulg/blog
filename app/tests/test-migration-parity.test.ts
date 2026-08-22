import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	compareTestTrees,
	formatParityFailure,
	scanTestTree,
	type TestFileInventory,
} from "../lib/test-migration/parity";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

function inventory(
	overrides: Partial<TestFileInventory> = {},
): TestFileInventory {
	return {
		relativePath: "sample.test.ts",
		runner: "vitest",
		testCount: 2,
		assertionCount: 2,
		tests: 2,
		assertions: 2,
		fixturePaths: [],
		missingFixtures: [],
		residualVitestApis: [],
		omissionMarkers: [],
		...overrides,
	};
}

async function rootWithFiles(files: Record<string, string>): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "btr-parity-"));
	temporaryRoots.push(root);
	for (const [path, source] of Object.entries(files)) {
		await mkdir(dirname(join(root, path)), { recursive: true });
		await writeFile(join(root, path), source, "utf8");
	}
	return root;
}

describe("test tree parity analyzer", () => {
	it("scans sorted test files and counts declarations and assertions with AST", async () => {
		const root = await rootWithFiles({
			"z.test.ts": 'test("z", () => expect(1).toBe(1));',
			"nested/a.test.ts": 'it("a", () => expect(1).toBe(1));',
		});
		const result = await scanTestTree(root, "vitest");
		expect(result.map((file) => file.relativePath)).toEqual([
			"nested/a.test.ts",
			"z.test.ts",
		]);
		expect(result.map((file) => [file.testCount, file.assertionCount])).toEqual(
			[
				[1, 1],
				[1, 1],
			],
		);
	});

	it("fails when a reference file has no Bun twin", () => {
		const result = compareTestTrees([inventory()], []);
		expect(result.ok).toBe(false);
		expect(result.reasons).toContain("missing Bun twin: sample.test.ts");
	});

	it("fails when a candidate references a missing fixture", () => {
		const result = compareTestTrees(
			[inventory({ fixturePaths: ["fixtures/data.json"] })],
			[inventory({ missingFixtures: ["fixtures/data.json"] })],
		);
		expect(result.reasons).toContain(
			"sample.test.ts: missing fixture fixtures/data.json",
		);
	});

	it("fails when candidate test declarations are lower", () => {
		const result = compareTestTrees(
			[inventory({ testCount: 3 })],
			[inventory({ testCount: 2 })],
		);
		expect(result.reasons).toContain("sample.test.ts: test declarations 2 < 3");
	});

	it("fails when candidate assertions are lower", () => {
		const result = compareTestTrees(
			[inventory({ assertionCount: 3 })],
			[inventory({ assertionCount: 2 })],
		);
		expect(result.reasons).toContain("sample.test.ts: assertions 2 < 3");
	});

	it("fails when candidate retains a Vitest API", () => {
		const result = compareTestTrees(
			[inventory()],
			[inventory({ residualVitestApis: ['import "vitest"'] })],
		);
		expect(result.reasons).toContain(
			'sample.test.ts: residual Vitest API import "vitest"',
		);
	});

	it("fails when candidate declares a partial mock omission", () => {
		const result = compareTestTrees(
			[inventory()],
			[inventory({ omissionMarkers: ["partial mock skipped"] })],
		);
		expect(result.reasons).toContain(
			"sample.test.ts: forbidden omission marker partial mock skipped",
		);
	});

	it("allows a complete Vitest-only disposition for a missing twin", () => {
		const result = compareTestTrees(
			[inventory()],
			[],
			[
				{
					file: "sample.test.ts",
					reason: "unsupported import-original behavior",
					evidence: "Bun error captured in CI log",
					owner: "maintainer",
					followUp: "replace with supported mock API",
				},
			],
		);
		expect(result.ok).toBe(true);
		expect(result.missingFiles).toEqual(["sample.test.ts"]);
	});

	it("rejects a disposition missing required evidence", () => {
		const result = compareTestTrees(
			[inventory()],
			[],
			[
				{
					file: "sample.test.ts",
					reason: "unsupported behavior",
					evidence: "",
					owner: "maintainer",
					followUp: "repair",
				},
			],
		);
		expect(result.ok).toBe(false);
		expect(result.reasons[0]).toContain("evidence is required");
	});

	it("rejects a stale disposition when the candidate is already present", () => {
		const result = compareTestTrees(
			[inventory()],
			[inventory()],
			[
				{
					file: "sample.test.ts",
					reason: "old incompatibility",
					evidence: "old log",
					owner: "maintainer",
					followUp: "remove disposition",
				},
			],
		);
		expect(result.reasons).toContain(
			"stale Vitest-only disposition: sample.test.ts",
		);
	});

	it("fails an extra candidate file without a reference twin", () => {
		const result = compareTestTrees(
			[],
			[inventory({ relativePath: "extra.test.ts" })],
		);
		expect(result.extraFiles).toEqual(["extra.test.ts"]);
		expect(result.reasons).toContain(
			"extra Bun test without Vitest twin: extra.test.ts",
		);
	});

	it("formats every parity reason and rejects duplicate or unknown dispositions", () => {
		const result = compareTestTrees(
			[inventory()],
			[],
			[
				{
					file: "sample.test.ts",
					reason: "reason",
					evidence: "evidence",
					owner: "owner",
					followUp: "follow up",
				},
				{
					file: "sample.test.ts",
					reason: "reason",
					evidence: "evidence",
					owner: "owner",
					followUp: "follow up",
				},
				{
					file: "unknown.test.ts",
					reason: "reason",
					evidence: "evidence",
					owner: "owner",
					followUp: "follow up",
				},
			],
		);
		const formatted = formatParityFailure(result);
		expect(result.ok).toBe(false);
		expect(formatted).toContain("Parity failed:");
		expect(formatted).toContain("duplicate Vitest-only disposition");
		expect(formatted).toContain(
			"stale Vitest-only disposition: unknown.test.ts",
		);
	});
});
