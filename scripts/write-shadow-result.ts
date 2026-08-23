#!/usr/bin/env bun
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { loadavg } from "node:os";
import {
	createShadowRunRecord,
	type ShadowRunRecord,
} from "#/lib/test-bench/shadow";

export type WriteShadowResultArgs = {
	parityStatus: number;
	referenceStatus: number;
	bunStatus: number;
	parityLogPath: string;
	referenceLogPath: string;
	bunLogPath: string;
	outputPath: string;
	commit: string;
	timestamp?: string;
	loadAvg1?: number;
};

function required(value: string | undefined, name: string): string {
	if (!value) throw new Error(`${name} is required`);
	return value;
}

function status(value: string | undefined, name: string): number {
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 0) {
		throw new Error(`${name} must be a non-negative integer`);
	}
	return parsed;
}

export function parseWriteShadowArgs(args: string[], env = process.env): WriteShadowResultArgs {
	const values = new Map<string, string>();
	for (let index = 0; index < args.length; index += 1) {
		const arg = args[index];
		if (!arg.startsWith("--")) throw new Error(`unknown argument: ${arg}`);
		const inline = arg.indexOf("=");
		if (inline > 0) {
			values.set(arg.slice(2, inline), arg.slice(inline + 1));
			continue;
		}
		const value = args[++index];
		if (!value || value.startsWith("--")) throw new Error(`${arg} requires a value`);
		values.set(arg.slice(2), value);
	}
	const get = (name: string, envName: string): string | undefined =>
		values.get(name) ?? env[envName];
	return {
		parityStatus: status(get("parity-status", "PARITY_STATUS"), "parity-status"),
		referenceStatus: status(
			get("reference-status", "REFERENCE_STATUS"),
			"reference-status",
		),
		bunStatus: status(get("bun-status", "BUN_STATUS"), "bun-status"),
		parityLogPath: required(get("parity-log", "PARITY_LOG"), "parity-log"),
		referenceLogPath: required(
			get("reference-log", "REFERENCE_LOG"),
			"reference-log",
		),
		bunLogPath: required(get("bun-log", "BUN_LOG"), "bun-log"),
		outputPath: required(get("output", "SHADOW_OUTPUT"), "output"),
		commit: required(get("commit", "GITHUB_SHA"), "commit"),
		timestamp: get("timestamp", "SHADOW_TIMESTAMP"),
		loadAvg1: get("load-avg-1", "LOAD_AVG_1")
			? Number(get("load-avg-1", "LOAD_AVG_1"))
			: loadavg()[0],
	};
}

function parityReasons(log: string): string[] {
	return log
		.split("\n")
		.map((line) => line.match(/^\s*-\s+(.+)$/)?.[1])
		.filter((reason): reason is string => reason !== undefined);
}

export async function writeShadowResult(
	input: WriteShadowResultArgs,
): Promise<ShadowRunRecord> {
	const [parityLog, referenceLog, bunLog] = await Promise.all([
		readFile(input.parityLogPath, "utf8"),
		readFile(input.referenceLogPath, "utf8"),
		readFile(input.bunLogPath, "utf8"),
	]);
	const record = createShadowRunRecord({
		parity: {
			ok: input.parityStatus === 0,
			reasons: input.parityStatus === 0 ? [] : parityReasons(parityLog),
		},
		referenceStatus: input.referenceStatus,
		referenceOutput: referenceLog,
		bunStatus: input.bunStatus,
		bunOutput: bunLog,
		commit: input.commit,
		timestamp: input.timestamp ?? new Date().toISOString(),
		loadAvg1: input.loadAvg1,
	});
	const outputPath = resolve(input.outputPath);
	await mkdir(dirname(outputPath), { recursive: true });
	await writeFile(outputPath, `${JSON.stringify(record, null, 2)}\n`, "utf8");
	return record;
}

export async function main(args = process.argv.slice(2)): Promise<void> {
	const input = parseWriteShadowArgs(args);
	const record = await writeShadowResult(input);
	console.log(JSON.stringify({ output: resolve(input.outputPath), noisy: record.noisy }));
}

if (import.meta.main) {
	try {
		await main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
