import "@tanstack/react-start/server-only";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { collectHostMeta } from "#/lib/bench/host.server";
import { type MeasuredRun, spawnMeasured } from "#/lib/bench/runner.server";
import type { HostMeta } from "#/lib/bench/types";
import {
	type RuntimeProvenance,
	TEST_ARMS,
	type TestArm,
	type TestArmSample,
	type TestComparisonRun,
	type TestOutcome,
} from "#/lib/test-bench/types";
import {
	compareTestTrees,
	type ParityResult,
	scanTestTree,
} from "#/lib/test-migration/parity";

const exec = promisify(execFile);
const PROVENANCE_KEYS = new Set([
	"command",
	"execPath",
	"runtime",
	"runtimeVersion",
	"runner",
	"runnerVersion",
]);

export type TestRunDeps = {
	spawn: (
		argv: string[],
		env: NodeJS.ProcessEnv,
		opts: { timeoutMs: number; cwd?: string },
	) => Promise<MeasuredRun>;
	host: () => Promise<HostMeta>;
	commit: () => Promise<string>;
	inventory: () => Promise<ParityResult>;
	env: NodeJS.ProcessEnv;
	cwd: string;
};

function emptyProvenance(arm: TestArm): RuntimeProvenance {
	return {
		command: arm.command.join(" "),
		execPath: "unknown",
		runtime: arm.runtime,
		runtimeVersion: arm.runtimeVersion,
		runner: arm.runner,
		runnerVersion: arm.runnerVersion,
	};
}

function provenanceFrom(stdout: string, arm: TestArm): RuntimeProvenance {
	for (const line of stdout.split("\n")) {
		try {
			const parsed: unknown = JSON.parse(line);
			if (
				typeof parsed === "object" &&
				parsed !== null &&
				[...PROVENANCE_KEYS].every((key) => key in parsed)
			) {
				return parsed as RuntimeProvenance;
			}
		} catch {
			// The runner output is not JSON on most lines.
		}
	}
	return emptyProvenance(arm);
}

function counts(line: string, word: string): number {
	return Number.parseInt(
		line.match(new RegExp(`(\\d+)\\s+${word}\\b`))?.[1] ?? "0",
		10,
	);
}

function fileCount(line: string): number {
	return Number.parseInt(line.match(/\((\d+)\)/)?.[1] ?? "0", 10);
}

function parseVitestSummaryLine(line: string): TestOutcome | null {
	if (!/^Test Files\s+/m.test(line)) return null;
	const files = fileCount(line);
	return {
		filesPassed: counts(line, "passed"),
		filesFailed: counts(line, "failed"),
		testsPassed: 0,
		testsFailed: 0,
		testsSkipped: 0,
		testFileCount: files,
	};
}

export function parseVitestSummary(stdout: string): TestOutcome | null {
	const lines = stdout.split("\n");
	const filesLine = lines.find((line) => /^Test Files\s+/.test(line));
	const testsLine = lines.find((line) => /^Tests\s+/.test(line));
	if (!filesLine || !testsLine) return null;
	const files = parseVitestSummaryLine(filesLine);
	if (!files) return null;
	return {
		...files,
		testsPassed: counts(testsLine, "passed"),
		testsFailed: counts(testsLine, "failed"),
		testsSkipped: counts(testsLine, "skipped"),
	};
}

export function parseBunTestSummary(stdout: string): TestOutcome | null {
	const ran = stdout.match(/Ran\s+(\d+)\s+tests?\s+across\s+(\d+)\s+files?/i);
	if (!ran) return null;
	const lines = stdout.split("\n").join(" ");
	const testsPassed = counts(lines, "pass");
	const testsFailed = counts(lines, "fail");
	const testsSkipped = counts(lines, "skip");
	const testFileCount = Number.parseInt(ran[2], 10);
	return {
		filesPassed: testsFailed === 0 ? testFileCount : 0,
		filesFailed: testsFailed > 0 ? testFileCount : 0,
		testsPassed,
		testsFailed,
		testsSkipped,
		testFileCount,
	};
}

function parseSummary(stdout: string, arm: TestArm): TestOutcome | null {
	return arm.runner === "vitest"
		? parseVitestSummary(stdout)
		: parseBunTestSummary(stdout);
}

function failureExcerpt(run: MeasuredRun): string | undefined {
	const excerpt = [run.stdout.trim(), run.stderrTail.trim()]
		.filter(Boolean)
		.join("\n");
	return excerpt || undefined;
}

export async function runTestArm(
	arm: TestArm,
	deps: Pick<TestRunDeps, "spawn" | "env" | "cwd">,
): Promise<TestArmSample> {
	const run = await deps.spawn(arm.command, deps.env, {
		timeoutMs: arm.timeoutMs,
		cwd: deps.cwd,
	});
	return {
		arm: arm.id,
		durationMs: run.ms,
		peakRssBytes: run.peakRssBytes,
		exitCode: run.timedOut ? null : run.exitCode,
		timedOut: run.timedOut,
		outcome: parseSummary(run.stdout, arm),
		provenance: provenanceFrom(run.stdout, arm),
		loadAvg1: run.loadAvg1,
		failureExcerpt: failureExcerpt(run),
	};
}

async function defaultCommit(): Promise<string> {
	try {
		const { stdout } = await exec("git", ["rev-parse", "HEAD"]);
		return stdout.trim();
	} catch {
		return "unknown";
	}
}

export const defaultTestRunDeps: TestRunDeps = {
	spawn: spawnMeasured,
	host: collectHostMeta,
	commit: defaultCommit,
	inventory: async () => {
		const reference = await scanTestTree("app/tests", "vitest");
		const candidate = await scanTestTree("app/tests-bun", "bun:test");
		return compareTestTrees(reference, candidate);
	},
	env: process.env,
	cwd: process.cwd(),
};

function provenanceMismatch(sample: TestArmSample, arm: TestArm): string[] {
	const mismatches: string[] = [];
	const expected = {
		runtime: arm.runtime,
		runtimeVersion: arm.runtimeVersion,
		runner: arm.runner,
		runnerVersion: arm.runnerVersion,
	};
	for (const [key, value] of Object.entries(expected)) {
		if (sample.provenance[key as keyof typeof expected] !== value) {
			mismatches.push(`${arm.id}: provenance ${key} expected ${value}`);
		}
	}
	if (sample.provenance.execPath === "unknown") {
		mismatches.push(`${arm.id}: missing executable provenance`);
	}
	return mismatches;
}

function sampleReasons(sample: TestArmSample, arm: TestArm): string[] {
	const reasons = provenanceMismatch(sample, arm);
	if (sample.timedOut) reasons.push(`${arm.id}: test arm timed out`);
	if (sample.exitCode !== 0)
		reasons.push(`${arm.id}: exit code ${sample.exitCode}`);
	if (!sample.outcome) reasons.push(`${arm.id}: test outcome summary missing`);
	return reasons;
}

function validSample(sample: TestArmSample, arm: TestArm): boolean {
	return sampleReasons(sample, arm).length === 0;
}

function outcomeMismatches(samples: TestArmSample[]): string[] {
	const reference = samples.filter((sample) => sample.arm === "A");
	const candidate = samples.filter((sample) => sample.arm === "C");
	const fields: Array<keyof TestOutcome> = [
		"testFileCount",
		"filesPassed",
		"filesFailed",
		"testsPassed",
		"testsFailed",
		"testsSkipped",
	];
	const reasons: string[] = [];
	for (
		let index = 0;
		index < Math.min(reference.length, candidate.length);
		index += 1
	) {
		const referenceOutcome = reference[index].outcome;
		const candidateOutcome = candidate[index].outcome;
		if (!referenceOutcome || !candidateOutcome) continue;
		for (const field of fields) {
			if (referenceOutcome[field] !== candidateOutcome[field]) {
				reasons.push(
					`A/C outcome ${field} mismatch: A=${referenceOutcome[field]}, C=${candidateOutcome[field]}`,
				);
			}
		}
	}
	return reasons;
}

function defaultHost(): HostMeta {
	return {
		host: "unknown",
		cpuModel: "unknown",
		cores: 0,
		totalMemBytes: 0,
		loadAvg1: 0,
		powerSource: "unknown",
		startedAt: new Date().toISOString(),
	};
}

export async function runTestComparison(
	arms: TestArm[] = Object.values(TEST_ARMS),
	repetitions = 1,
	deps: TestRunDeps = defaultTestRunDeps,
): Promise<TestComparisonRun> {
	if (!Number.isInteger(repetitions) || repetitions < 1) {
		throw new Error("repetitions must be a positive integer");
	}
	const samples: TestArmSample[] = [];
	for (let repetition = 0; repetition < repetitions; repetition += 1) {
		const order = repetition % 2 === 0 ? arms : [...arms].reverse();
		for (const arm of order) {
			samples.push(await runTestArm(arm, deps));
		}
	}
	const inventory = await deps.inventory();
	const outcomeReasons = outcomeMismatches(samples);
	const invalidReasons = [...inventory.reasons, ...outcomeReasons];
	for (const sample of samples) {
		const arm = arms.find((candidate) => candidate.id === sample.arm);
		if (arm) invalidReasons.push(...sampleReasons(sample, arm));
	}
	const host = await deps.host().catch(defaultHost);
	return {
		commit: await deps.commit(),
		timestamp: new Date().toISOString(),
		host,
		samples,
		inventory,
		validComparison:
			inventory.ok &&
			outcomeReasons.length === 0 &&
			samples.every((sample) => {
				const arm = arms.find((candidate) => candidate.id === sample.arm);
				return arm ? validSample(sample, arm) : false;
			}),
		invalidReasons: [...new Set(invalidReasons)],
	};
}
