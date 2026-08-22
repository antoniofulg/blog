import type { TestCohort, TestFileInventory } from "./parity";

export const COHORTS: readonly TestCohort[] = [
	"pure",
	"dom",
	"mocks-timers",
	"integration-infra",
];

const INTEGRATION =
	/(?:pglite|postgres|database|from\s+["'](?:node:)?(?:fs|child_process)|spawn\(|watch\(|fetch\(|process\.env|playwright)/i;
const MOCKS_OR_TIMERS =
	/(?:mock\.module|vi\.mock|jest\.mock|useFakeTimers|fakeTimers|setSystemTime|jest\.useFakeTimers)/i;
const DOM =
	/(?:@testing-library\/react|@testing-library\/dom|document\.|window\.|screen\.|render\(|HTMLElement|ResizeObserver|matchMedia)/i;

export function isTestCohort(value: string | undefined): value is TestCohort {
	return value !== undefined && COHORTS.some((cohort) => cohort === value);
}

export function classifyTestFile(source: string): TestCohort {
	if (INTEGRATION.test(source)) return "integration-infra";
	if (MOCKS_OR_TIMERS.test(source)) return "mocks-timers";
	if (DOM.test(source)) return "dom";
	return "pure";
}

export function selectCohortFiles(
	inventory: Array<TestFileInventory & { cohort?: TestCohort }>,
	cohort: TestCohort,
): string[] {
	return inventory
		.filter((file) => file.cohort === cohort)
		.map((file) => file.relativePath)
		.sort((a, b) => a.localeCompare(b));
}

export function filterCohortInventory(
	inventory: Array<TestFileInventory & { cohort?: TestCohort }>,
	cohort: TestCohort,
): TestFileInventory[] {
	return inventory
		.filter((file) => file.cohort === cohort)
		.sort((a, b) => a.relativePath.localeCompare(b.relativePath));
}

export function parseCohortArgument(args: string[]): TestCohort {
	const index = args.findIndex(
		(arg) => arg === "--cohort" || arg.startsWith("--cohort="),
	);
	const value =
		index < 0
			? undefined
			: args[index].includes("=")
				? args[index].split("=", 2)[1]
				: args[index + 1];
	if (!isTestCohort(value)) {
		throw new Error(
			`Unknown or empty cohort. Expected one of: ${COHORTS.join(", ")}`,
		);
	}
	return value;
}
