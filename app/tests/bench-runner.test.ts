import { describe, expect, it } from "vitest";
import {
	groupRssBytes,
	spawnMeasured,
	tailLines,
} from "#/lib/bench/runner.server";

const ENV = process.env;
const MB = 1024 * 1024;

describe("bench spawn measurement", () => {
	it("measures wall-clock duration of the spawned command", async () => {
		const result = await spawnMeasured(["bash", "-c", "sleep 0.4"], ENV, {
			timeoutMs: 10_000,
		});
		expect(result.ms).toBeGreaterThan(350);
		expect(result.exitCode).toBe(0);
	});

	it("reports higher peak RSS for a child that allocates than one that does not", async () => {
		const idle = await spawnMeasured(["bash", "-c", "sleep 3.5"], ENV, {
			timeoutMs: 30_000,
		});
		const heavy = await spawnMeasured(
			[
				"bash",
				"-c",
				"bun -e 'const b=Buffer.alloc(300*1024*1024,7);const t=Date.now();while(Date.now()-t<3500){};console.log(b.length)'",
			],
			ENV,
			{ timeoutMs: 30_000 },
		);
		expect(heavy.peakRssBytes).toBeGreaterThan(idle.peakRssBytes);
		expect(heavy.peakRssBytes).toBeGreaterThan(150 * MB);
	});

	it("counts a descendant's memory, not only the direct child's", async () => {
		// bash is the direct child; bun is its descendant and holds the memory.
		const result = await spawnMeasured(
			[
				"bash",
				"-c",
				"bun -e 'const b=Buffer.alloc(300*1024*1024,7);const t=Date.now();while(Date.now()-t<3500){};console.log(b.length)' | cat",
			],
			ENV,
			{ timeoutMs: 30_000 },
		);
		expect(result.peakRssBytes).toBeGreaterThan(150 * MB);
	});

	it("kills a command that exceeds the timeout and leaves no orphan", async () => {
		const result = await spawnMeasured(["bash", "-c", "sleep 30"], ENV, {
			timeoutMs: 700,
		});
		expect(result.timedOut).toBe(true);
		expect(result.exitCode).not.toBe(0);
		expect(result.ms).toBeLessThan(5_000);
		expect(await groupRssBytes(result.pgid)).toBe(0);
	});

	it("returns a non-zero exit as data rather than throwing", async () => {
		const result = await spawnMeasured(["bash", "-c", "exit 3"], ENV, {
			timeoutMs: 10_000,
		});
		expect(result.exitCode).toBe(3);
		expect(result.timedOut).toBe(false);
	});

	it("captures stdout and the tail of stderr", async () => {
		const result = await spawnMeasured(
			["bash", "-c", "echo hello; echo boom >&2"],
			ENV,
			{ timeoutMs: 10_000 },
		);
		expect(result.stdout).toContain("hello");
		expect(result.stderrTail).toContain("boom");
	});

	it("keeps only the last 20 stderr lines", () => {
		const text = Array.from({ length: 50 }, (_, i) => `line${i}`).join("\n");
		const tail = tailLines(text);
		expect(tail.split("\n")).toHaveLength(20);
		expect(tail).toContain("line49");
		expect(tail).not.toContain("line29");
	});

	it("reports zero resident memory for a process group that no longer exists", async () => {
		expect(await groupRssBytes(999_999)).toBe(0);
	});
});
