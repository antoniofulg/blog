import { resolve } from "node:path";
import {
	compareTestTrees,
	DEFAULT_VITEST_ONLY_DISPOSITIONS,
	formatParityFailure,
	scanTestTree,
} from "#/lib/test-migration/parity";

const root = process.cwd();

export async function checkParity(): Promise<number> {
	const reference = await scanTestTree(resolve(root, "app/tests"), "vitest");
	const candidate = await scanTestTree(resolve(root, "app/tests-bun"), "bun:test");
	const result = compareTestTrees(
		reference,
		candidate,
		DEFAULT_VITEST_ONLY_DISPOSITIONS,
	);
	console.log(formatParityFailure(result));
	if (!result.ok) {
		console.error(
			`Inventory: ${reference.length} reference files, ${candidate.length} candidate files, ${result.dispositions.length} explicit dispositions`,
		);
	}
	return result.ok ? 0 : 1;
}

if (import.meta.main) {
	try {
		process.exitCode = await checkParity();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
