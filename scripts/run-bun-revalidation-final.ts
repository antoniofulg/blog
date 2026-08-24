import { cpus, loadavg } from "node:os";
import {
	defaultRevalidationDeps,
	externalProcessContamination,
	runRevalidation,
	writeRevalidationReport,
} from "#/lib/test-bench/revalidation";

const infrastructure = [
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

const gated = ["auth-integ.test.ts", "indexer-integ.test.ts", "sync-integ.test.ts"];

function processSnapshot(): string {
	const result = Bun.spawnSync(["ps", "ax", "-o", "command="], {
		stdout: "pipe",
		stderr: "pipe",
	});
	return new TextDecoder().decode(result.stdout);
}

async function waitForQuietHost(): Promise<void> {
	const cpuCount = cpus().length;
	for (let attempt = 1; attempt <= 2160; attempt += 1) {
		const external = externalProcessContamination(processSnapshot());
		const load = loadavg()[0] / cpuCount;
		if (!external && load <= 0.8) {
			console.log(JSON.stringify({ event: "quiet-host", attempt, load, cpuCount }));
			return;
		}
		if (attempt === 1 || attempt % 12 === 0)
			console.log(JSON.stringify({ event: "waiting-host", attempt, load, external }));
		await Bun.sleep(5000);
	}
	throw new Error("quiet-host timeout after 3 hours");
}

const gatedExcludes = [...infrastructure, ...gated].map(
	(file) => `--exclude=app/tests/${file}`,
);
const candidateFiles = [...new Bun.Glob("app/tests-bun/**/*.test.ts")
	.scanSync({ cwd: process.cwd() })]
	.sort()
	.filter((file) => !gated.some((name) => file.endsWith(`/${name}`)));

const arms = [
	{
		id: "vitest-1-gated-excluded",
		runner: "vitest" as const,
		runtime: "bun" as const,
		runnerVersion: "4.1.5",
		runtimeVersion: "1.4.0",
		command: ["bun", "run", "test:vitest:bun:1", "--", ...gatedExcludes],
		workerCount: 1,
		isolation: "isolated" as const,
		timeoutMs: 900_000,
	},
	{
		id: "bun-isolated-1-gated-excluded",
		runner: "bun:test" as const,
		runtime: "bun" as const,
		runnerVersion: "1.4.0",
		runtimeVersion: "1.4.0",
		command: [
			"bash",
			"-c",
			`TZ=UTC bun --bun scripts/check-test-runtime.ts --runtime=bun --version=1.4.0 --runner=bun:test --runner-version=1.4.0 && TZ=UTC bun test ${candidateFiles.join(" ")} --isolate`,
		],
		workerCount: 1,
		isolation: "isolated" as const,
		timeoutMs: 900_000,
	},
];

if (import.meta.main) {
	await waitForQuietHost();
	const run = await runRevalidation(
		arms,
		5,
		{
			...defaultRevalidationDeps,
			contamination: () => externalProcessContamination(processSnapshot()),
		},
		{ maxAttempts: 15, allowExcludedSamples: true },
	);
	const paths = await writeRevalidationReport(
		run,
		"docs/benchmarks/bun-test-revalidation/runs",
	);
	console.log(
		JSON.stringify(
			{
				profile: "isolated-1-adaptive-nested-lock",
				gated,
				...paths,
				validComparison: run.validComparison,
				invalidReasons: run.invalidReasons,
				validSamples: Object.fromEntries(
					arms.map((arm) => [
						arm.id,
						run.samples.filter(
							(sample) => sample.arm === arm.id && !sample.excluded,
						).length,
					]),
				),
				excludedSamples: run.samples.filter(
					(sample) => sample.excluded && sample.repetition > 0,
				).length,
				aggregates: run.aggregates,
			},
			null,
			2,
		),
	);
	process.exitCode = run.validComparison ? 0 : 1;
}
