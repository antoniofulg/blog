import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

export type RuntimeKind = "node" | "bun";
export type TestRunner = "vitest" | "bun:test";

export type RuntimeExpectation = {
	runtime: RuntimeKind;
	version: string;
	runner: TestRunner;
	runnerVersion?: string;
};

export type RuntimeProvenance = {
	command: string;
	execPath: string;
	runtime: RuntimeKind;
	runtimeVersion: string;
	runner: TestRunner;
	runnerVersion: string;
};

function valueOf(object: object, key: string): unknown {
	return Reflect.get(object, key);
}

function bunVersion(): string | undefined {
	const version = valueOf(process.versions, "bun");
	if (typeof version === "string") return version;

	const bun = valueOf(globalThis, "Bun");
	if (typeof bun === "object" && bun !== null) {
		const detected = valueOf(bun, "version");
		if (typeof detected === "string") return detected;
	}

	return undefined;
}

function detectRuntime(): { runtime: RuntimeKind; version: string } {
	const detectedBunVersion = bunVersion();
	if (detectedBunVersion) {
		return { runtime: "bun", version: detectedBunVersion };
	}

	return { runtime: "node", version: process.versions.node };
}

function installedVitestVersion(): string {
	try {
		const packagePath = new URL("../node_modules/vitest/package.json", import.meta.url);
		const packageJson: unknown = JSON.parse(readFileSync(packagePath, "utf8"));
		if (typeof packageJson === "object" && packageJson !== null) {
			const version = valueOf(packageJson, "version");
			if (typeof version === "string") return version;
		}
	} catch {
		return "unknown";
	}

	return "unknown";
}

function detectRunner(expected: TestRunner): { runner: TestRunner; runnerVersion: string } {
	return expected === "bun:test"
		? { runner: "bun:test", runnerVersion: bunVersion() ?? "unknown" }
		: { runner: "vitest", runnerVersion: installedVitestVersion() };
}

function parseExpectation(input: unknown): RuntimeExpectation {
	if (typeof input !== "object" || input === null) {
		throw new Error("Invalid runtime expectation: expected an object");
	}

	const runtime = valueOf(input, "runtime");
	const version = valueOf(input, "version");
	const runner = valueOf(input, "runner");
	const runnerVersion = valueOf(input, "runnerVersion");
	if (runtime !== "node" && runtime !== "bun") {
		throw new Error("Invalid runtime expectation: runtime must be node or bun");
	}
	if (typeof version !== "string" || version.length === 0) {
		throw new Error("Invalid runtime expectation: version must be non-empty");
	}
	if (runner !== "vitest" && runner !== "bun:test") {
		throw new Error("Invalid runtime expectation: runner must be vitest or bun:test");
	}
	if (runner === "bun:test" && runtime !== "bun") {
		throw new Error("Invalid runtime expectation: bun:test requires the Bun runtime");
	}
	if (runnerVersion !== undefined && typeof runnerVersion !== "string") {
		throw new Error("Invalid runtime expectation: runnerVersion must be a string");
	}
	if (runtime === "node" && !/^\d+$/.test(version)) {
		throw new Error("Invalid runtime expectation: Node version must be a major number");
	}
	if (runtime === "bun" && !/^\d+\.\d+\.\d+$/.test(version)) {
		throw new Error("Invalid runtime expectation: Bun version must be exact semver");
	}

	return {
		runtime,
		version,
		runner,
		...(runnerVersion === undefined ? {} : { runnerVersion }),
	};
}

function expectedVersionMatches(expectation: RuntimeExpectation, detectedVersion: string): boolean {
	if (expectation.runtime === "node") {
		return detectedVersion.split(".")[0] === expectation.version;
	}
	return detectedVersion === expectation.version;
}

export function inspectRuntime(input: RuntimeExpectation): RuntimeProvenance {
	parseExpectation(input);
	const detected = detectRuntime();
	const runner = detectRunner(input.runner);
	return {
		command: process.argv.join(" "),
		execPath: process.execPath,
		runtime: detected.runtime,
		runtimeVersion: detected.version,
		runner: runner.runner,
		runnerVersion: runner.runnerVersion,
	};
}

export function assertRuntime(input: unknown): RuntimeProvenance {
	const expectation = parseExpectation(input);
	const provenance = inspectRuntime(expectation);
	const expectedLabel = `${expectation.runtime === "node" ? "Node" : "Bun"} ${expectation.version}`;
	const detectedLabel = `${provenance.runtime === "node" ? "Node" : "Bun"} ${provenance.runtimeVersion}`;
	if (!expectedVersionMatches(expectation, provenance.runtimeVersion) || provenance.runtime !== expectation.runtime) {
		const nodeSetupHint =
			expectation.runtime === "node" && provenance.runtime === "node"
				? ". Install or select Node 24 using your preferred version manager or the official Node.js installer."
				: "";
		throw new Error(
			`Runtime mismatch: expected ${expectedLabel}, detected ${detectedLabel} at ${provenance.execPath}${nodeSetupHint}`,
		);
	}
	if (provenance.runner !== expectation.runner) {
		throw new Error(
			`Runner mismatch: expected ${expectation.runner}, detected ${provenance.runner} at ${provenance.execPath}`,
		);
	}
	if (expectation.runnerVersion && provenance.runnerVersion !== expectation.runnerVersion) {
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

const isMain = process.argv[1] !== undefined && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
	try {
		console.log(JSON.stringify(assertRuntime(cliExpectation(process.argv.slice(2)))));
	} catch (error) {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	}
}
