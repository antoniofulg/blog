import { describe, expect, test } from "bun:test";
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
	test("detects Bun without inspecting executable filename", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runtime).toBe("bun");
		expect(provenance.runtimeVersion).toBe("1.4.0");
	});

	test("records executable path and command", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.execPath).toBe(process.execPath);
		expect(provenance.command).toContain(process.execPath);
		expect(provenance.command.length).toBeGreaterThan(process.execPath.length);
	});

	test("records the Bun Test runner and version", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runner).toBe("bun:test");
		expect(provenance.runnerVersion).toBe("1.4.0");
	});

	test("accepts the Bun 1.4 reference expectation", () => {
		expect(assertRuntime(expected).runtimeVersion).toBe("1.4.0");
	});

	test("rejects a Node expectation under Bun", () => {
		expect(() =>
			assertRuntime({
				...expected,
				runtime: "node",
				version: "24",
				runner: "vitest",
			}),
		).toThrow(
			/expected Node 24, detected Bun 1\.4\.0.*at (?!.*Install or select Node 24)/,
		);
	});

	test("rejects a wrong Bun version", () => {
		expect(() => assertRuntime({ ...expected, version: "1.3.14" })).toThrow(
			/expected Bun 1\.3\.14, detected Bun 1\.4\.0 at .+/,
		);
	});

	test("rejects an empty expected version", () => {
		expect(() => assertRuntime({ ...expected, version: "" })).toThrow(
			/Invalid runtime expectation/,
		);
	});

	test("rejects an unsupported runner", () => {
		const malformed: unknown = { ...expected, runner: "jest" };
		expect(() => assertRuntime(malformed)).toThrow(
			/runner must be vitest or bun:test/,
		);
	});
});
