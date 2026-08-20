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
