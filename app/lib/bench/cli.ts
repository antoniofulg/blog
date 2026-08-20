// Pure flag parsing for `bun run bench`. Kept separate from the entry point so
// it is testable without spawning anything, following the exported-parser
// pattern in scripts/audit-fe.ts.

export type BenchArgs = {
	/** Workload ids to run; undefined means the whole matrix. */
	only?: string[];
	/** Bun versions to run; undefined means every declared version. */
	versions?: string[];
	/** Run even when the machine is under load. */
	allowNoisy: boolean;
	/** Skip measuring and re-render the report from an existing result file. */
	reportOnly?: string;
};

function listFlag(args: string[], name: string): string[] | undefined {
	const prefix = `--${name}=`;
	const flag = args.find((a) => a.startsWith(prefix));
	if (!flag) return undefined;
	const values = flag
		.slice(prefix.length)
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	return values.length > 0 ? values : undefined;
}

export function parseBenchArgs(argv: string[]): BenchArgs {
	const reportOnly = argv.find((a) => a.startsWith("--report-only="));
	return {
		only: listFlag(argv, "only"),
		versions: listFlag(argv, "versions"),
		allowNoisy: argv.includes("--allow-noisy"),
		reportOnly: reportOnly
			? reportOnly.slice("--report-only=".length)
			: undefined,
	};
}

/** Pseudo-workload id for the runtime measurement, which is not a spawned
 * command and therefore not in the workload registry. */
export const RUNTIME_ID = "runtime";

/** Directory holding committed result files. Deliberately not docs/_reports/,
 * which is gitignored — a published post must cite data a reader can open. */
export const RESULTS_DIR = "docs/benchmarks/bun-1-4";

/**
 * Splits `--only` into spawned workload ids and the runtime flag. With no
 * selection everything runs, including the runtime measurement.
 */
export function splitRuntimeSelection(only?: string[]): {
	workloadIds?: string[];
	includeRuntime: boolean;
} {
	if (!only) return { workloadIds: undefined, includeRuntime: true };
	const workloadIds = only.filter((id) => id !== RUNTIME_ID);
	return {
		workloadIds: workloadIds.length > 0 ? workloadIds : [],
		includeRuntime: only.includes(RUNTIME_ID),
	};
}

/** Date-stamped result path, so a re-run on another day never overwrites an
 * earlier run's data. */
export function resultFilePath(isoDate: string, dir = RESULTS_DIR): string {
	return `${dir}/${isoDate.slice(0, 10)}.json`;
}
