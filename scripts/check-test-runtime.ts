import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type RuntimeExpectation = {
	runtime: "bun";
	version: string;
	runner: "bun:test";
	runnerVersion?: string;
};

export type RuntimeProvenance = {
	command: string;
	execPath: string;
	runtime: "bun" | "node";
	runtimeVersion: string;
	runner: "bun:test";
	runnerVersion: string;
};

function valueOf(object: object, key: string): unknown {
	return Reflect.get(object, key);
}

function bunVersion(): string | undefined {
	const version = valueOf(process.versions, "bun");
	if (typeof version === "string") return version;

	const bun = valueOf(globalThis, "Bun");
	if (typeof bun !== "object" || bun === null) return undefined;
	const detected = valueOf(bun, "version");
	return typeof detected === "string" ? detected : undefined;
}

function parseExpectation(input: unknown): RuntimeExpectation {
	if (typeof input !== "object" || input === null) {
		throw new Error("Invalid runtime expectation: expected an object");
	}

	const runtime = valueOf(input, "runtime");
	const version = valueOf(input, "version");
	const runner = valueOf(input, "runner");
	const runnerVersion = valueOf(input, "runnerVersion");
	if (runtime !== "bun") {
		throw new Error("Invalid runtime expectation: runtime must be bun");
	}
	if (typeof version !== "string" || !/^\d+\.\d+\.\d+$/.test(version)) {
		throw new Error("Invalid runtime expectation: Bun version must be exact semver");
	}
	if (runner !== "bun:test") {
		throw new Error("Invalid runtime expectation: runner must be bun:test");
	}
	if (runnerVersion !== undefined && typeof runnerVersion !== "string") {
		throw new Error("Invalid runtime expectation: runnerVersion must be a string");
	}

	return {
		runtime,
		version,
		runner,
		...(runnerVersion === undefined ? {} : { runnerVersion }),
	};
}

export function inspectRuntime(input: RuntimeExpectation): RuntimeProvenance {
	parseExpectation(input);
	const detectedBunVersion = bunVersion();
	return {
		command: process.argv.join(" "),
		execPath: process.execPath,
		runtime: detectedBunVersion ? "bun" : "node",
		runtimeVersion: detectedBunVersion ?? process.versions.node,
		runner: "bun:test",
		runnerVersion: detectedBunVersion ?? "unknown",
	};
}

export function assertRuntime(input: unknown): RuntimeProvenance {
	const expectation = parseExpectation(input);
	const provenance = inspectRuntime(expectation);
	if (
		provenance.runtime !== "bun" ||
		provenance.runtimeVersion !== expectation.version
	) {
		throw new Error(
			`Runtime mismatch: expected Bun ${expectation.version}, detected ${provenance.runtime === "bun" ? "Bun" : "Node"} ${provenance.runtimeVersion} at ${provenance.execPath}`,
		);
	}
	if (
		expectation.runnerVersion &&
		provenance.runnerVersion !== expectation.runnerVersion
	) {
		throw new Error(
			`Runner version mismatch: expected ${expectation.runnerVersion}, detected ${provenance.runnerVersion} at ${provenance.execPath}`,
		);
	}

	return provenance;
}

function cliExpectation(args: string[]): RuntimeExpectation {
	const values = new Map<string, string>();
	for (const arg of args) {
		const match = /^--([^=]+)=(.+)$/.exec(arg);
		if (!match) throw new Error(`Invalid runtime argument: ${arg}`);
		values.set(match[1], match[2]);
	}

	return parseExpectation({
		runtime: values.get("runtime"),
		version: values.get("version"),
		runner: values.get("runner"),
		runnerVersion: values.get("runner-version"),
	});
}

const isMain =
	process.argv[1] !== undefined &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	try {
		console.log(JSON.stringify(assertRuntime(cliExpectation(process.argv.slice(2)))));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
