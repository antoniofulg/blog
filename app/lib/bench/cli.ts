// Pure flag parsing for `bun run bench`. Kept separate from the entry point so
// it is testable without spawning anything, following the exported-parser
// pattern in scripts/audit-fe.ts.

export type BenchArgs = {
	/** Workload ids to run; undefined means the whole matrix. */
	only?: string[];
	/** Bun versions to run; undefined means every declared version. */
	versions?: string[];
	/** Refuse to run on a busy machine. Off by default — a benchmark of a
	 * developer machine is meant to be taken on one. */
	strictLoad: boolean;
	/** Skip measuring and re-render the report from an existing result file. */
	reportOnly?: string;
	/** Pin the runtime port. Unset means the harness binds a free one. */
	runtimePort?: number;
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
	const runtimePort = argv.find((a) => a.startsWith("--runtime-port="));
	const port = runtimePort
		? Number.parseInt(runtimePort.slice("--runtime-port=".length), 10)
		: Number.NaN;
	return {
		runtimePort: Number.isInteger(port) ? port : undefined,
		only: listFlag(argv, "only"),
		versions: listFlag(argv, "versions"),
		strictLoad: argv.includes("--strict-load"),
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

/**
 * Timestamped result path. A run never overwrites another run's data, not even
 * one started the same day: measurements taken minutes apart can sit under
 * different machine conditions, and silently replacing the earlier file would
 * destroy the only record of those conditions.
 */
export function resultFilePath(
	isoTimestamp: string,
	dir = RESULTS_DIR,
): string {
	const stamp = isoTimestamp.slice(0, 19).replace(/:/g, "-");
	return `${dir}/${stamp}.json`;
}
