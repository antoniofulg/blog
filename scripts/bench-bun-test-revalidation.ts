import {
	defaultRevalidationDeps,
	runRevalidation,
	writeRevalidationReport,
	type RevalidationArm,
} from "#/lib/test-bench/revalidation";

const infrastructureFiles = [
	"bench-cli.test.ts",
	"bench-e2e-runtimes.test.ts",
	"bench-host.test.ts",
	"bench-load.test.ts",
	"bench-matrix.test.ts",
	"bench-preflight.test.ts",
	"bench-reporter.test.ts",
	"bench-runner.test.ts",
	"bench-runtime.test.ts",
	"bench-setup.test.ts",
	"bench-stats.test.ts",
	"bench-store.test.ts",
	"bench-versions.test.ts",
	"bench-vitest-workers.test.ts",
	"bench-workloads.test.ts",
	"ci-runtime-contract.test.ts",
	"test-runtime.test.ts",
	"test-scripts.test.ts",
	"test-migration-parity.test.ts",
	"vitest-summary.test.ts",
];

function repetitions(args: string[]): number {
	const value = args.find((arg) => arg.startsWith("--repetitions="))?.split("=", 2)[1];
	const parsed = value === undefined ? 5 : Number.parseInt(value, 10);
	if (!Number.isInteger(parsed) || parsed < 1) throw new Error("--repetitions must be a positive integer");
	return parsed;
}

function vitestCommand(profile: string): string[] {
	const script = profile === "vitest:2" ? "test:vitest:bun:2" : profile === "vitest:4" ? "test:vitest:bun:4" : "test:vitest:bun:1";
	return ["bun", "run", script, "--", ...infrastructureFiles.map((file) => `--exclude=app/tests/${file}`)];
}

function arms(profile: string): RevalidationArm[] {
	const vitest: RevalidationArm = {
		id: "vitest",
		runner: "vitest",
		runtime: "bun",
		runnerVersion: "4.1.5",
		runtimeVersion: "1.4.0",
		command: vitestCommand(profile),
		workerCount: profile === "vitest:4" ? 4 : profile === "vitest:2" ? 2 : 1,
		isolation: "isolated",
		timeoutMs: 15 * 60 * 1000,
	};
	const bunScript = profile === "bun:parallel:2" ? "test:bun:parallel:2" : profile === "bun:parallel:4" ? "test:bun:parallel:4" : profile === "bun:shared:2" ? "test:bun:shared:2" : profile === "bun:shared:4" ? "test:bun:shared:4" : profile === "bun:smol:2" ? "test:bun:smol:2" : "test:bun:parity";
	const bun: RevalidationArm = {
		id: "bun-test",
		runner: "bun:test",
		runtime: "bun",
		runnerVersion: "1.4.0",
		runtimeVersion: "1.4.0",
		command: ["bun", "run", bunScript],
		workerCount: bunScript.endsWith(":4") ? 4 : bunScript.includes(":2") ? 2 : 1,
		isolation: bunScript.includes("shared") ? "shared" : "isolated",
		timeoutMs: 15 * 60 * 1000,
	};
	return [vitest, bun];
}

if (import.meta.main) {
	try {
		const profile = process.argv.find((arg) => arg.startsWith("--profile="))?.split("=", 2)[1] ?? "parity";
		const run = await runRevalidation(arms(profile), repetitions(process.argv.slice(2)), defaultRevalidationDeps);
		const paths = await writeRevalidationReport(run);
		console.log(JSON.stringify({ ...paths, validComparison: run.validComparison, invalidReasons: run.invalidReasons }, null, 2));
		process.exitCode = run.validComparison ? 0 : 1;
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
