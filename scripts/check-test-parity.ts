import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import {
	compareTestTrees,
	formatParityFailure,
	scanTestTree,
	type TestFileInventory,
} from "../app/lib/test-migration/parity";
import {
	COHORTS,
	classifyTestFile,
	filterCohortInventory,
	parseCohortArgument,
	selectCohortFiles,
} from "../app/lib/test-migration/cohorts";

const root = process.cwd();
const referenceRoot = resolve(root, "app/tests");
const candidateRoot = resolve(root, "app/tests-bun");

async function withCohorts(
	rootPath: string,
	inventory: TestFileInventory[],
): Promise<TestFileInventory[]> {
	return Promise.all(
		inventory.map(async (file) => ({
			...file,
			cohort: classifyTestFile(await readFile(resolve(rootPath, file.relativePath), "utf8")),
		})),
	);
}

export async function checkParity(args: string[] = []): Promise<number> {
	const reference = await scanTestTree(referenceRoot, "vitest");
	const candidate = await scanTestTree(candidateRoot, "bun:test");
	const cohort = args.some((arg) => arg === "--cohort" || arg.startsWith("--cohort="))
		? parseCohortArgument(args)
		: undefined;
	const referenceWithCohorts = await withCohorts(referenceRoot, reference);
	const candidateWithCohorts = await withCohorts(candidateRoot, candidate);
	const result = cohort
		? compareTestTrees(
				filterCohortInventory(referenceWithCohorts, cohort),
				filterCohortInventory(candidateWithCohorts, cohort),
			)
		: compareTestTrees(referenceWithCohorts, candidateWithCohorts);
	console.log(formatParityFailure(result));
	return result.ok ? 0 : 1;
}

export async function runCohort(args: string[]): Promise<number> {
	const cohort = parseCohortArgument(args);
	const candidate = await withCohorts(candidateRoot, await scanTestTree(candidateRoot, "bun:test"));
	const files = selectCohortFiles(candidate, cohort).map((file) => resolve(candidateRoot, file));
	if (files.length === 0) {
		throw new Error(`Cohort ${cohort} is empty`);
	}
	console.log(`Running ${cohort} cohort (${files.length} files)`);
	const result = spawnSync("bun", ["test", "--timeout", "60000", ...files], {
		cwd: root,
		stdio: "inherit",
	});
	return result.status ?? 1;
}

if (import.meta.main) {
	try {
		const args = process.argv.slice(2);
		const status = args.includes("--execute-cohort")
			? await runCohort(args)
			: await checkParity(args);
		process.exitCode = status;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		console.error(`Known cohorts: ${COHORTS.join(", ")}`);
		process.exitCode = 1;
	}
}
