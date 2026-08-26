import { describe, expect, it } from "bun:test";
import {
	assertRuntime,
	inspectRuntime,
	type RuntimeExpectation,
} from "../../scripts/check-test-runtime";

const expected: RuntimeExpectation = {
	runtime: "bun",
	version: "1.4.0",
	runner: "bun:test",
	runnerVersion: "1.4.0",
};

describe("test runtime provenance", () => {
	it("detects the pinned Bun runtime", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runtime).toBe("bun");
		expect(provenance.runtimeVersion).toBe("1.4.0");
	});

	it("records executable path and command", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.execPath).toBe(process.execPath);
		expect(provenance.command).toContain(process.execPath);
	});

	it("records native Bun Test provenance", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runner).toBe("bun:test");
		expect(provenance.runnerVersion).toBe("1.4.0");
	});

	it("accepts the canonical expectation", () => {
		expect(assertRuntime(expected)).toMatchObject({
			runtime: expected.runtime,
			runtimeVersion: expected.version,
			runner: expected.runner,
			runnerVersion: expected.runnerVersion,
		});
	});

	it("rejects a different Bun version", () => {
		expect(() => assertRuntime({ ...expected, version: "1.3.14" })).toThrow(
			/expected Bun 1\.3\.14, detected Bun 1\.4\.0/,
		);
	});

	it("rejects a non-semver Bun version", () => {
		expect(() => assertRuntime({ ...expected, version: "1.4" })).toThrow(
			/Bun version must be exact semver/,
		);
	});

	it("rejects a non-Bun runtime", () => {
		expect(() => assertRuntime({ ...expected, runtime: "node" })).toThrow(
			/runtime must be bun/,
		);
	});

	it("rejects a non-native runner", () => {
		expect(() => assertRuntime({ ...expected, runner: "vitest" })).toThrow(
			/runner must be bun:test/,
		);
	});
});
