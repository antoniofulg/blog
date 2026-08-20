import "@tanstack/react-start/server-only";
import { execFile } from "node:child_process";
import { cpus, hostname, loadavg, totalmem } from "node:os";
import { promisify } from "node:util";
import type { HostMeta, PowerSource } from "#/lib/bench/types";

const run = promisify(execFile);

/**
 * `pmset -g batt` opens with "Now drawing from 'AC Power'" or
 * "'Battery Power'". Anything else, including a missing pmset, is unknown —
 * an unrecognised format must not be reported as a known state.
 */
export function parsePowerSource(output: string): PowerSource {
	if (/'AC Power'/.test(output)) return "ac";
	if (/'Battery Power'/.test(output)) return "battery";
	return "unknown";
}

async function readPowerSource(): Promise<PowerSource> {
	try {
		const { stdout } = await run("pmset", ["-g", "batt"]);
		return parsePowerSource(stdout);
	} catch {
		return "unknown";
	}
}

/**
 * Provenance for a result file. Collected separately from preflight so a run
 * started with --allow-noisy still records the conditions it ran under.
 */
export async function collectHostMeta(): Promise<HostMeta> {
	const cores = cpus();
	return {
		host: hostname(),
		cpuModel: cores[0]?.model ?? "unknown",
		cores: cores.length,
		totalMemBytes: totalmem(),
		loadAvg1: loadavg()[0],
		powerSource: await readPowerSource(),
		startedAt: new Date().toISOString(),
	};
}
