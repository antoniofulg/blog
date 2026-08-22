import { describe, expect, it } from "vitest";
import { collectHostMeta, parsePowerSource } from "#/lib/bench/host.server";

describe("bench host metadata", () => {
	it("records the machine identity and capacity", async () => {
		const meta = await collectHostMeta();
		expect(meta.host.length).toBeGreaterThan(0);
		expect(meta.cpuModel.length).toBeGreaterThan(0);
		expect(meta.cores).toBeGreaterThan(0);
		expect(meta.totalMemBytes).toBeGreaterThan(0);
	});

	it("records the one-minute load average as a non-negative number", async () => {
		const meta = await collectHostMeta();
		expect(typeof meta.loadAvg1).toBe("number");
		expect(meta.loadAvg1).toBeGreaterThanOrEqual(0);
	});

	it("stamps the start time as a parseable ISO timestamp", async () => {
		const meta = await collectHostMeta();
		expect(meta.startedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
		expect(Number.isNaN(Date.parse(meta.startedAt))).toBe(false);
	});

	it("maps pmset output to a known power source", () => {
		expect(parsePowerSource("Now drawing from 'AC Power'")).toBe("ac");
		expect(parsePowerSource("Now drawing from 'Battery Power'")).toBe(
			"battery",
		);
	});

	it("reports unknown rather than guessing when pmset output is unrecognised", async () => {
		expect(parsePowerSource("")).toBe("unknown");
		expect(parsePowerSource("command not found")).toBe("unknown");
		const meta = await collectHostMeta();
		expect(["ac", "battery", "unknown"]).toContain(meta.powerSource);
	});
});
