import { describe, expect, it } from "vitest";
import {
	assertRuntime,
	inspectRuntime,
	type RuntimeExpectation,
} from "../../scripts/check-test-runtime";

const expected: RuntimeExpectation = {
	runtime: "node",
	version: "24",
	runner: "vitest",
	runnerVersion: "4.1.5",
};

describe("test runtime provenance", () => {
	it("detects Node without inspecting executable filename", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runtime).toBe("node");
		expect(provenance.runtimeVersion.split(".")[0]).toBe("24");
	});

	it("records executable path and command", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.execPath).toBe(process.execPath);
		expect(provenance.command).toContain(process.execPath);
		expect(provenance.command.length).toBeGreaterThan(process.execPath.length);
	});

	it("records the Vitest runner and version", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runner).toBe("vitest");
		expect(provenance.runnerVersion).toBe("4.1.5");
	});

	it("accepts the Node 24 reference expectation", () => {
		expect(assertRuntime(expected).runtimeVersion.split(".")[0]).toBe("24");
	});

	it("rejects a Bun expectation under Node", () => {
		expect(() =>
			assertRuntime({ ...expected, runtime: "bun", version: "1.4.0" }),
		).toThrow(/expected Bun 1\.4\.0, detected Node 24\.\d+\.\d+ at .+/);
	});

	it("rejects a wrong Node major", () => {
		expect(() => assertRuntime({ ...expected, version: "23" })).toThrow(
			/expected Node 23, detected Node 24\.\d+\.\d+ at .+/,
		);
	});

	it("rejects an empty expected version", () => {
		expect(() => assertRuntime({ ...expected, version: "" })).toThrow(
			/Invalid runtime expectation/,
		);
	});

	it("rejects an unsupported runner", () => {
		const malformed: unknown = { ...expected, runner: "jest" };
		expect(() => assertRuntime(malformed)).toThrow(
			/runner must be vitest or bun:test/,
		);
	});
});
