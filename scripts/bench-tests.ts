#!/usr/bin/env bun
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { runTestComparison } from "#/lib/test-bench/runner.server";
import { writeTestComparison } from "#/lib/test-bench/reporter.server";
import {
	TEST_ARM_IDS,
	TEST_ARMS,
	type TestArmId,
} from "#/lib/test-bench/types";

export const DEFAULT_TEST_REPETITIONS = 1;
export const MAX_TEST_REPETITIONS = 20;

export type TestBenchArgs = {
	armIds: TestArmId[];
	repetitions: number;
	help: boolean;
};

function parsePositiveInt(value: string, option: string): number {
	if (!/^\d+$/.test(value)) {
		throw new Error(`${option} must be a positive integer`);
	}
	const parsed = Number(value);
	if (!Number.isSafeInteger(parsed) || parsed < 1) {
		throw new Error(`${option} must be a positive integer`);
	}
	if (option === "--repetitions" && parsed > MAX_TEST_REPETITIONS) {
		throw new Error(`${option} must be at most ${MAX_TEST_REPETITIONS}`);
	}
	return parsed;
}

function parseArms(value: string): TestArmId[] {
	const values = value.split(",").filter(Boolean);
	if (values.length === 0) throw new Error("--only must name at least one arm");
	const unknown = values.filter(
		(arm): arm is string => !TEST_ARM_IDS.includes(arm as TestArmId),
	);
	if (unknown.length > 0) {
		throw new Error(`--only has unknown arm(s): ${unknown.join(", ")}`);
	}
	const unique = [...new Set(values)] as TestArmId[];
	return unique;
}

export function parseTestBenchArgs(args: string[]): TestBenchArgs {
	const parsed: TestBenchArgs = {
		armIds: [...TEST_ARM_IDS],
		repetitions: DEFAULT_TEST_REPETITIONS,
		help: false,
	};
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (arg === "--help" || arg === "-h") {
			parsed.help = true;
			continue;
		}
		if (arg === "--only" || arg === "--repetitions") {
			const value = args[++index];
			if (!value) throw new Error(`${arg} requires a value`);
			if (arg === "--only") parsed.armIds = parseArms(value);
			else parsed.repetitions = parsePositiveInt(value, arg);
			continue;
		}
		if (arg.startsWith("--only=")) {
			parsed.armIds = parseArms(arg.slice("--only=".length));
			continue;
		}
		if (arg.startsWith("--repetitions=")) {
			parsed.repetitions = parsePositiveInt(
				arg.slice("--repetitions=".length),
				"--repetitions",
			);
			continue;
		}
		throw new Error(`unknown argument: ${arg}`);
	}
	return parsed;
}

function usage(): string {
	return [
		"Usage: bun run bench:tests [--only=A,B,C] [--repetitions=N]",
		"A: Vitest on Node 24; B: Vitest on Bun 1.4.0; C: Bun Test on Bun 1.4.0.",
		`Repetitions: 1-${MAX_TEST_REPETITIONS}, default ${DEFAULT_TEST_REPETITIONS}.`,
	].join("\n");
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const parsed = parseTestBenchArgs(args);
	if (parsed.help) {
		console.log(usage());
		return;
	}
	const arms = parsed.armIds.map((id) => TEST_ARMS[id]);
	const run = await runTestComparison(arms, parsed.repetitions);
	const paths = await writeTestComparison(run);
	console.log(`JSON: ${paths.jsonPath}`);
	console.log(`Markdown: ${paths.markdownPath}`);
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	await main();
}
