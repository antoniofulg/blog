import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	compareRuntimeOutcomes,
	compareTestTrees,
	scanTestTree,
	type TestFileInventory,
	type VitestOnlyDisposition,
} from "#/lib/test-migration/parity";

const temporaryRoots: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryRoots
			.splice(0)
			.map((root) => rm(root, { recursive: true, force: true })),
	);
});

async function tree(source: string, name = "suite.test.ts"): Promise<string> {
	const root = await mkdtemp(join(tmpdir(), "blog-parity-"));
	temporaryRoots.push(root);
	await writeFile(join(root, name), source, "utf8");
	return root;
}

function inventory(
	path: string,
	overrides: Partial<TestFileInventory> = {},
): TestFileInventory {
	return {
		relativePath: path,
		runner: "vitest",
		leafTests: ["suite > passes"],
		testCount: 1,
		assertionCount: 1,
		tests: 1,
		assertions: 1,
		fixturePaths: [],
		missingFixtures: [],
		residualVitestApis: [],
		omissionMarkers: [],
		mockExports: [],
		hooks: { afterAll: 0, afterEach: 0, beforeAll: 0, beforeEach: 0 },
		semantics: {
			usesDom: false,
			usesFakeTimers: false,
			usesEnvironment: false,
			usesFilesystem: false,
			usesSubprocess: false,
		},
		...overrides,
	};
}

describe("test tree parity", () => {
	it("scans leaf identities, hooks, and static resource semantics deterministically", async () => {
		const root = await tree(`
      import { beforeEach, describe, expect, it } from "vitest";
      describe("suite", () => {
        beforeEach(() => process.env.MODE = "test");
        it("passes", () => expect(document.body).toBeDefined());
      });
    `);

		const [result] = await scanTestTree(root, "vitest");
		expect(result.leafTests).toEqual(["suite > passes"]);
		expect(result.testCount).toBe(1);
		expect(result.assertionCount).toBe(1);
		expect(result.hooks.beforeEach).toBe(1);
		expect(result.semantics).toMatchObject({
			usesDom: true,
			usesEnvironment: true,
		});
	});

	it("rejects lower leaf count, identity, hook, and semantics drift", () => {
		const reference = inventory("suite.test.ts", {
			hooks: { afterAll: 0, afterEach: 0, beforeAll: 0, beforeEach: 1 },
			semantics: {
				...inventory("suite.test.ts").semantics,
				usesFilesystem: true,
			},
		});
		const candidate = inventory("suite.test.ts", {
			leafTests: ["suite > different"],
			testCount: 1,
			tests: 1,
			hooks: { afterAll: 0, afterEach: 0, beforeAll: 0, beforeEach: 0 },
			semantics: { ...reference.semantics, usesFilesystem: false },
		});
		const result = compareTestTrees([reference], [candidate]);
		expect(result.ok).toBe(false);
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				"suite.test.ts: leaf test identities differ",
				"suite.test.ts: lifecycle hook inventory differs",
				"suite.test.ts: static state/resource semantics differ",
			]),
		);
	});

	it("requires complete dispositions for missing infrastructure files", () => {
		const reference = [inventory("infra.test.ts")];
		const invalid: VitestOnlyDisposition = {
			file: "infra.test.ts",
			reason: "kept",
			evidence: "",
			owner: "tests",
			followUp: "later",
		};
		const invalidResult = compareTestTrees(reference, [], [invalid]);
		expect(invalidResult.ok).toBe(false);
		expect(invalidResult.reasons[0]).toContain("evidence is required");

		const valid: VitestOnlyDisposition = {
			...invalid,
			evidence: "runner contract assertion",
		};
		const validResult = compareTestTrees(reference, [], [valid]);
		expect(validResult.ok).toBe(true);
		expect(validResult.missingFiles).toEqual(["infra.test.ts"]);
	});

	it("rejects extra and stale-disposition files", () => {
		const result = compareTestTrees(
			[inventory("suite.test.ts")],
			[inventory("suite.test.ts"), inventory("extra.test.ts")],
			[
				{
					file: "suite.test.ts",
					reason: "obsolete",
					evidence: "e",
					owner: "x",
					followUp: "y",
				},
			],
		);
		expect(result.ok).toBe(false);
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				"extra Bun test without Vitest twin: extra.test.ts",
				"stale Vitest-only disposition: suite.test.ts",
			]),
		);
	});
});

describe("runtime outcome parity", () => {
	const outcome = (): Parameters<typeof compareRuntimeOutcomes>[0] => ({
		filesPassed: 2,
		filesFailed: 0,
		testsPassed: 4,
		testsFailed: 0,
		testsSkipped: 1,
		testsTodo: 0,
		testFileCount: 2,
		leafTests: ["a > one", "b > two"],
	});

	it("accepts equal outcomes and leaf identities", () => {
		expect(compareRuntimeOutcomes(outcome(), outcome()).ok).toBe(true);
	});

	it("invalidates any count or leaf identity difference", () => {
		const candidate = {
			...outcome(),
			testsSkipped: 2,
			leafTests: ["a > one", "b > changed"],
		};
		const result = compareRuntimeOutcomes(outcome(), candidate);
		expect(result.ok).toBe(false);
		expect(result.reasons).toEqual(
			expect.arrayContaining([
				"runtime outcome testsSkipped mismatch: reference=1, candidate=2",
				"runtime leaf test identities differ",
			]),
		);
	});
});
