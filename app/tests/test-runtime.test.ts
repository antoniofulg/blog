import { describe, expect, it } from "vitest";
import {
	assertRuntime,
	inspectRuntime,
	type RuntimeExpectation,
} from "../../scripts/check-test-runtime";

const isBun = Boolean(process.versions.bun);
const expected: RuntimeExpectation = {
	runtime: isBun ? "bun" : "node",
	version: isBun ? "1.4.0" : "24",
	runner: "vitest",
	runnerVersion: "4.1.5",
};

describe("test runtime provenance", () => {
	it("detects the active runtime without inspecting executable filename", () => {
		const provenance = inspectRuntime(expected);
		expect(provenance.runtime).toBe(expected.runtime);
		expect(provenance.runtimeVersion.startsWith(expected.version)).toBe(true);
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

	it("records native Bun Test provenance when requested", () => {
		if (!isBun) return;
		const provenance = inspectRuntime({
			runtime: "bun",
			version: "1.4.0",
			runner: "bun:test",
			runnerVersion: "1.4.0",
		});
		expect(provenance.runner).toBe("bun:test");
		expect(provenance.runnerVersion).toBe("1.4.0");
	});

	it("accepts the active runtime expectation", () => {
		expect(assertRuntime(expected).runtime).toBe(expected.runtime);
	});

	it("rejects the opposite runtime", () => {
		const opposite: RuntimeExpectation = isBun
			? { ...expected, runtime: "node", version: "24" }
			: { ...expected, runtime: "bun", version: "1.4.0" };
		const message = isBun
			? /expected Node 24, detected Bun 1\.4\.0.*at (?!.*Install or select Node 24)/
			: /expected Bun 1\.4\.0, detected Node 24\.\d+\.\d+ at .+/;
		expect(() => assertRuntime(opposite)).toThrow(message);
	});

	it("rejects a wrong runtime version", () => {
		const version = isBun ? "1.3.14" : "23";
		const message = isBun
			? /expected Bun 1\.3\.14, detected Bun 1\.4\.0 at .+/
			: /expected Node 23, detected Node 24\.\d+\.\d+ at .+\. Install or select Node 24 using your preferred version manager or the official Node\.js installer\./;
		expect(() => assertRuntime({ ...expected, version })).toThrow(message);
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

	it("rejects native Bun Test when the runtime is not Bun", () => {
		expect(() =>
			assertRuntime({
				runtime: "node",
				version: "24",
				runner: "bun:test",
				runnerVersion: "1.4.0",
			}),
		).toThrow(/bun:test requires the Bun runtime/);
	});
});
