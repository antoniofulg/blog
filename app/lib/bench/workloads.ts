// Declarative registry of what the benchmark measures. Data only — the runner
// owns every filesystem side effect so this module stays pure and testable.

/**
 * A filesystem reset the runner performs before each repetition. Kept as a
 * vocabulary rather than callbacks so the registry never touches the disk and
 * a test can assert which paths a workload is allowed to clear.
 */
export type PrepareStep =
	| "rm-node-modules"
	| "rm-install-cache"
	| "rm-output"
	| "rm-vite-cache";

export type Workload = {
	id: string;
	/** Argv as spawned. Kept byte-identical to what a developer or CI runs. */
	argv: string[];
	/** Timed repetitions. One additional warm-up run is discarded upstream. */
	reps: number;
	/** Needs the Postgres container reachable via DATABASE_URL. */
	needsDb: boolean;
	/** Needs .output/server/index.mjs built by the version under measurement. */
	needsBundle: boolean;
	prepare: PrepareStep[];
	/** Excluded from the reported pipeline total — does not run every time. */
	excludeFromTotal?: boolean;
	/** Pulls extra facts out of stdout, e.g. Playwright pass/fail counts. */
	parseExtra?: (stdout: string) => Record<string, unknown>;
};

/**
 * Playwright prints its outcome as "N passed" / "N failed" in the summary.
 * Reading stdout keeps the measured command identical to CI's; switching to
 * `--reporter=json` would change what is being measured.
 */
export function parsePlaywrightCounts(stdout: string): Record<string, unknown> {
	const passed = stdout.match(/(\d+)\s+passed/);
	const failed = stdout.match(/(\d+)\s+failed/);
	return {
		passed: passed ? Number(passed[1]) : 0,
		failed: failed ? Number(failed[1]) : 0,
	};
}

export const WORKLOADS: readonly Workload[] = [
	{
		id: "install-cold",
		argv: ["bun", "install", "--frozen-lockfile"],
		reps: 3,
		needsDb: false,
		needsBundle: false,
		prepare: ["rm-node-modules", "rm-install-cache"],
		excludeFromTotal: true,
	},
	{
		id: "install-warm",
		argv: ["bun", "install", "--frozen-lockfile"],
		reps: 5,
		needsDb: false,
		needsBundle: false,
		prepare: ["rm-node-modules"],
		excludeFromTotal: true,
	},
	{
		id: "build",
		argv: ["bun", "run", "build"],
		reps: 5,
		needsDb: false,
		needsBundle: false,
		prepare: ["rm-output", "rm-vite-cache"],
	},
	{
		id: "test",
		argv: ["bun", "run", "test"],
		reps: 5,
		needsDb: false,
		needsBundle: false,
		prepare: [],
	},
	{
		id: "test-e2e",
		argv: ["bun", "run", "test:e2e"],
		reps: 5,
		needsDb: false,
		needsBundle: true,
		prepare: [],
		parseExtra: parsePlaywrightCounts,
	},
	{
		id: "lint",
		argv: ["bun", "run", "lint"],
		reps: 5,
		needsDb: false,
		needsBundle: false,
		prepare: [],
	},
	{
		id: "check",
		argv: ["bunx", "tsc", "--noEmit"],
		reps: 5,
		needsDb: false,
		needsBundle: false,
		prepare: [],
	},
	{
		id: "sync",
		argv: ["bun", "run", "sync"],
		reps: 5,
		needsDb: true,
		needsBundle: false,
		prepare: [],
	},
	{
		id: "audit-fe",
		argv: ["bun", "run", "scripts/run-audit-fe.ts", "--no-lighthouse"],
		reps: 5,
		needsDb: true,
		needsBundle: true,
		prepare: [],
	},
] as const;

export function selectWorkloads(ids?: string[]): Workload[] {
	if (!ids || ids.length === 0) return [...WORKLOADS];
	return ids.map((id) => {
		const found = WORKLOADS.find((w) => w.id === id);
		if (!found) {
			throw new Error(
				`unknown workload id "${id}" — known ids: ${WORKLOADS.map((w) => w.id).join(", ")}`,
			);
		}
		return found;
	});
}
