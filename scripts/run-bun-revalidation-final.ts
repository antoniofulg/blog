import { cpus, loadavg } from "node:os";
import {
	defaultRevalidationDeps,
	externalProcessContamination,
	runRevalidation,
	writeRevalidationReport,
	type RevalidationArm,
} from "#/lib/test-bench/revalidation";

const infrastructure = [
	"bench-cli.test.ts", "bench-e2e-runtimes.test.ts", "bench-host.test.ts",
	"bench-load.test.ts", "bench-matrix.test.ts", "bench-preflight.test.ts",
	"bench-reporter.test.ts", "bench-runner.test.ts", "bench-runtime.test.ts",
	"bench-setup.test.ts", "bench-stats.test.ts", "bench-store.test.ts",
	"bench-versions.test.ts", "bench-vitest-workers.test.ts", "bench-workloads.test.ts",
	"ci-runtime-contract.test.ts", "test-runtime.test.ts", "test-scripts.test.ts",
	"test-migration-parity.test.ts", "vitest-summary.test.ts",
];

type Profile = { id: "isolated-1" | "isolated-2" | "isolated-4" | "smol-2"; workers: 1 | 2 | 4; smol?: boolean };
const profiles: Profile[] = [
	{ id: "isolated-1", workers: 1 },
	{ id: "isolated-2", workers: 2 },
	{ id: "isolated-4", workers: 4 },
	{ id: "smol-2", workers: 2, smol: true },
];

function processSnapshot(): string {
	const result = Bun.spawnSync(["ps", "ax", "-o", "command="], { stdout: "pipe", stderr: "pipe" });
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
		if (attempt === 1 || attempt % 12 === 0) console.log(JSON.stringify({ event: "waiting-host", attempt, load, external }));
		await Bun.sleep(5000);
	}
	throw new Error("quiet-host timeout after 3 hours");
}

const vitestExcludes = infrastructure.map((file) => `--exclude=app/tests/${file}`);
const candidateFiles = [...new Bun.Glob("app/tests-bun/**/*.test.ts").scanSync({ cwd: process.cwd() })].sort();

function vitestCommand(profile: Profile): string[] {
	return ["bun", "run", `test:vitest:bun:${profile.workers}`, "--", ...vitestExcludes];
}

function bunCommand(profile: Profile): string[] {
	const flags = [`--parallel=${profile.workers}`, "--isolate"];
	const runner = profile.smol ? "bun --smol test" : "bun test";
	return ["bash", "-c", [
		"TZ=UTC bun --bun scripts/check-test-runtime.ts --runtime=bun --version=1.4.0 --runner=bun:test --runner-version=1.4.0",
		`TZ=UTC ${runner} ${candidateFiles.join(" ")} ${flags.join(" ")}`,
	].join(" && ")];
}

function arms(profile: Profile): RevalidationArm[] {
	return [
		{ id: `vitest-${profile.workers}`, runner: "vitest", runtime: "bun", runnerVersion: "4.1.5", runtimeVersion: "1.4.0", command: vitestCommand(profile), workerCount: profile.workers, isolation: "isolated", timeoutMs: 15 * 60 * 1000 },
		{ id: `bun-${profile.smol ? "smol-" : "isolated-"}${profile.workers}`, runner: "bun:test", runtime: "bun", runnerVersion: "1.4.0", runtimeVersion: "1.4.0", command: bunCommand(profile), workerCount: profile.workers, isolation: "isolated", timeoutMs: 15 * 60 * 1000 },
	];
}

async function runProfile(profile: Profile) {
	await waitForQuietHost();
	const selectedArms = arms(profile);
	const run = await runRevalidation(selectedArms, 5, {
		...defaultRevalidationDeps,
		contamination: () => externalProcessContamination(processSnapshot()),
	}, { maxAttempts: 15, allowExcludedSamples: true });
	const paths = await writeRevalidationReport(run, "docs/benchmarks/bun-test-revalidation/runs");
	return {
		profile: profile.id,
		files: candidateFiles.length,
		...paths,
		validComparison: run.validComparison,
		invalidReasons: run.invalidReasons,
		validSamples: Object.fromEntries(selectedArms.map((arm) => [arm.id, run.samples.filter((sample) => sample.arm === arm.id && !sample.excluded).length])),
		excludedSamples: run.samples.filter((sample) => sample.excluded && sample.repetition > 0).length,
		aggregates: run.aggregates,
	};
}

if (import.meta.main) {
	const selected = process.argv.find((arg) => arg.startsWith("--profile="))?.split("=", 2)[1];
	const requested = selected ? profiles.filter((profile) => profile.id === selected) : profiles;
	if (requested.length === 0) throw new Error(`unknown profile: ${selected}`);
	const results = [];
	for (const profile of requested) results.push(await runProfile(profile));
	console.log(JSON.stringify(results, null, 2));
	process.exitCode = results.every((result) => result.validComparison) ? 0 : 1;
}
