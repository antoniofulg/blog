import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { portOwner } from "#/lib/bench/preflight.server";
import { measureRuntime } from "#/lib/bench/runtime.server";

const STUB = join(process.cwd(), "app/tests/fixtures/bench-stub-server.ts");
const PORT = 4187;

function opts(over: Record<string, unknown> = {}) {
	return {
		version: "1.4.0",
		routes: ["/", "/blog"],
		cwd: process.cwd(),
		port: PORT,
		command: ["bun", "run", STUB],
		load: { concurrency: 4, durationMs: 400 },
		settleMs: 200,
		cooldownMs: 200,
		...over,
	};
}

describe("bench runtime measurement", () => {
	it("records boot time from spawn to the first successful response", async () => {
		const result = await measureRuntime(
			opts({ env: { ...process.env, STUB_BOOT_DELAY_MS: "600" } }),
		);
		expect(result.bootMs).toBeGreaterThan(500);
		expect(result.bootMs).toBeLessThan(30_000);
	});

	it("records idle, peak and post-load resident memory", async () => {
		const result = await measureRuntime(opts());
		expect(result.idleRssBytes).toBeGreaterThan(0);
		expect(result.peakRssBytes).toBeGreaterThanOrEqual(result.idleRssBytes);
		expect(result.postLoadRssBytes).toBeGreaterThan(0);
	});

	it("shows a higher peak than idle when the load makes the server allocate", async () => {
		const result = await measureRuntime(
			opts({ routes: ["/heavy"], load: { concurrency: 2, durationMs: 700 } }),
		);
		expect(result.peakRssBytes).toBeGreaterThan(result.idleRssBytes);
	});

	it("reports the latency and request counts from the load phase", async () => {
		const result = await measureRuntime(opts());
		expect(result.totalRequests).toBeGreaterThan(0);
		expect(result.latency.p95).toBeGreaterThanOrEqual(result.latency.p50);
		expect(result.nonOk).toEqual([]);
	});

	it("tags the result with the version it measured", async () => {
		const result = await measureRuntime(opts());
		expect(result.version).toBe("1.4.0");
	});

	it("leaves no listener on the port once it returns", async () => {
		await measureRuntime(opts());
		expect(await portOwner(PORT)).toBeNull();
	});

	it("frees the port even when the server never boots", async () => {
		await expect(
			measureRuntime(opts({ command: ["bash", "-c", "sleep 60"] })),
		).rejects.toThrow(/did not answer/);
		expect(await portOwner(PORT)).toBeNull();
	}, 45_000);
});
