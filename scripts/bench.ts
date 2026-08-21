#!/usr/bin/env bun
// Entry point for `bun run bench`. Thin by design: parsing, preflight, matrix
// execution and reporting all live in app/lib/bench/.
//
// The working tree is mutated during a run (node_modules, .output, caches), so
// every exit path — including SIGINT — flushes partial results and reinstalls
// node_modules with the developer's default bun.
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import {
	parseBenchArgs,
	RESULTS_DIR,
	resultFilePath,
	splitRuntimeSelection,
} from "#/lib/bench/cli";
import { collectHostMeta } from "#/lib/bench/host.server";
import {
	preflight,
	resolveRuntimeRoutes,
} from "#/lib/bench/preflight.server";
import { writeReport } from "#/lib/bench/reporter.server";
import {
	type MatrixRun,
	restoreNodeModules,
	runMatrix,
	spawnMeasured,
	WORKLOAD_TIMEOUT_MS,
} from "#/lib/bench/runner.server";
import { measureRuntime } from "#/lib/bench/runtime.server";
import type { RunResult } from "#/lib/bench/types";
import { BENCH_VERSIONS, envFor } from "#/lib/bench/versions";
import { selectWorkloads } from "#/lib/bench/workloads";

const cwd = process.cwd();
const args = parseBenchArgs(process.argv.slice(2));

function log(message: string): void {
	process.stdout.write(`[bench] ${message}\n`);
}

async function writeResult(run: RunResult, path: string): Promise<void> {
	await mkdir(dirname(path), { recursive: true });
	await writeFile(path, `${JSON.stringify(run, null, 2)}\n`, "utf-8");
}

if (args.reportOnly) {
	const run = JSON.parse(await readFile(args.reportOnly, "utf-8")) as RunResult;
	log(`report written to ${await writeReport(run, RESULTS_DIR)}`);
	process.exit(0);
}

const versions = args.versions ?? [...BENCH_VERSIONS];
const { workloadIds, includeRuntime } = splitRuntimeSelection(args.only);
const workloads = workloadIds ? selectWorkloads(workloadIds) : selectWorkloads();

const check = await preflight({
	versions,
	workloads,
	allowNoisy: args.allowNoisy,
	includeRuntime,
	cwd,
	runtimePort: args.runtimePort,
});
if (!check.ok) {
	process.stderr.write(`[bench] preflight failed:\n${check.reason}\n`);
	process.exit(1);
}

const host = await collectHostMeta();
const resultPath = resultFilePath(host.startedAt);
const run: RunResult = {
	schemaVersion: 1,
	host,
	versions,
	workloads: [],
	runtime: [],
	findings: [],
};

// The bun that was on PATH before the harness touched anything.
const defaultBun = process.execPath;
let restored = false;

async function finish(exitCode: number): Promise<never> {
	if (!restored) {
		restored = true;
		await writeResult(run, resultPath);
		log(`results written to ${resultPath}`);
		log("restoring node_modules with the default bun...");
		await restoreNodeModules(defaultBun, cwd);
	}
	process.exit(exitCode);
}

for (const signal of ["SIGINT", "SIGTERM"] as const) {
	process.on(signal, () => {
		log(`${signal} received — flushing partial results`);
		void finish(130);
	});
}

try {
	if (workloads.length > 0) {
		log(`measuring ${workloads.length} workload(s) across ${versions.join(", ")}`);
		const matrix: MatrixRun = await runMatrix(
			versions,
			workloads,
			cwd,
			async (partial) => {
				run.workloads = partial.workloads;
				run.findings = partial.findings;
				await writeResult(run, resultPath);
			},
		);
		run.workloads = matrix.workloads;
		run.findings = matrix.findings;
	}

	if (includeRuntime) {
		const routes = await resolveRuntimeRoutes();
		log(`measuring runtime on ${routes.join(", ")}`);
		// Counterbalanced A,B,B,A so drift in machine conditions across the
		// runtime phase cannot land on one version and not the other. Each
		// version is therefore measured twice and both rows are reported.
		const order = [...versions, ...[...versions].reverse()];
		for (const version of order) {
			// The bundle must be produced by the version whose runtime we measure.
			await spawnMeasured(["bun", "run", "build"], envFor(version, process.env, cwd), {
				timeoutMs: WORKLOAD_TIMEOUT_MS,
				cwd,
			});
			run.runtime.push(
				await measureRuntime({ version, routes, cwd, port: args.runtimePort }),
			);
			await writeResult(run, resultPath);
		}
	}

	log(`report written to ${await writeReport(run, RESULTS_DIR)}`);
	await finish(0);
} catch (error) {
	process.stderr.write(
		`[bench] run failed: ${error instanceof Error ? error.message : String(error)}\n`,
	);
	await finish(1);
}
