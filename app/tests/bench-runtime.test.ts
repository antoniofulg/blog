import { spawn } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { portOwner } from "#/lib/bench/preflight.server";
import { findFreePort, measureRuntime } from "#/lib/bench/runtime.server";

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
		// Relative rather than absolute: a slow machine shifts both boots
		// equally, but a wrong implementation (a constant, or a clock started
		// after the server was already up) cannot reproduce the gap.
		const fast = await measureRuntime(
			opts({ env: { ...process.env, STUB_BOOT_DELAY_MS: "0" } }),
		);
		const slow = await measureRuntime(
			opts({ env: { ...process.env, STUB_BOOT_DELAY_MS: "800" } }),
		);
		expect(slow.bootMs - fast.bootMs).toBeGreaterThan(500);
		// Lower bound on the delayed boot alone: machine load can only push it
		// up, so this can fail for exactly one reason — the probe was answered
		// by a server left over from the previous measurement.
		expect(slow.bootMs).toBeGreaterThan(700);
	}, 60_000);

	it("records idle, peak and post-load resident memory", async () => {
		const result = await measureRuntime(opts());
		expect(result.idleRssBytes).toBeGreaterThan(0);
		expect(result.peakRssBytes).toBeGreaterThanOrEqual(result.idleRssBytes);
		expect(result.postLoadRssBytes).toBeGreaterThan(0);
	}, 30_000);

	it("shows a higher peak than idle when the load makes the server allocate", async () => {
		const result = await measureRuntime(
			opts({ routes: ["/heavy"], load: { concurrency: 2, durationMs: 700 } }),
		);
		expect(result.peakRssBytes).toBeGreaterThan(result.idleRssBytes);
	}, 30_000);

	it("reports the latency and request counts from the load phase", async () => {
		const result = await measureRuntime(opts());
		expect(result.totalRequests).toBeGreaterThan(0);
		expect(result.latency.p95).toBeGreaterThanOrEqual(result.latency.p50);
		expect(result.nonOk).toEqual([]);
	}, 30_000);

	it("tags the result with the version it measured", async () => {
		const result = await measureRuntime(opts());
		expect(result.version).toBe("1.4.0");
	}, 30_000);

	it("leaves no listener on the port once it returns", async () => {
		await measureRuntime(opts());
		expect(await portOwner(PORT)).toBeNull();
	}, 30_000);

	it("escalates to SIGKILL when the server ignores a polite shutdown", async () => {
		// A server that swallows SIGTERM keeps listening unless the caller
		// escalates. Asserting the port is free on return is the only check
		// that fails deterministically when the wait-then-SIGKILL is removed;
		// polling lsof alone passes by luck on an idle machine.
		await measureRuntime(
			opts({ env: { ...process.env, STUB_IGNORE_SIGTERM: "1" } }),
		);
		expect(await portOwner(PORT)).toBeNull();
	}, 60_000);

	it("refuses to measure a load mix that includes a route the app does not serve", async () => {
		// A 404 is cheap for every version, so a wrong route drags the whole
		// latency distribution down instead of failing. The first two real
		// runs of this harness sent a quarter of their load to a `/blog`
		// route that does not exist.
		await expect(
			measureRuntime(opts({ routes: ["/", "/missing"] })),
		).rejects.toThrow(/answered 404/);
		expect(await portOwner(PORT)).toBeNull();
	}, 30_000);

	it("refuses to measure a server it did not start", async () => {
		// A leftover listener answers the boot probe instantly and reports
		// another process's memory. Failing loudly is the only safe outcome:
		// the alternative is a plausible-looking number describing the wrong
		// process.
		const squatter = spawn("bun", ["run", STUB], {
			detached: true,
			env: { ...process.env, PORT: String(PORT) },
			stdio: "ignore",
		});
		try {
			while ((await portOwner(PORT)) === null) {
				await new Promise((r) => setTimeout(r, 50));
			}
			await expect(measureRuntime(opts())).rejects.toThrow(
				/already bound by PID/,
			);
		} finally {
			process.kill(-(squatter.pid ?? 0), "SIGKILL");
			while ((await portOwner(PORT)) !== null) {
				await new Promise((r) => setTimeout(r, 50));
			}
		}
	}, 30_000);

	it("frees the port even when the server never boots", async () => {
		await expect(
			measureRuntime(opts({ command: ["bash", "-c", "sleep 60"] })),
		).rejects.toThrow(/did not answer/);
		expect(await portOwner(PORT)).toBeNull();
	}, 45_000);
});

describe("free runtime port selection", () => {
	it("avoids a port that is currently taken", async () => {
		// Occupying a port and asserting the chooser skips it is what proves the
		// port came from the OS. Asserting only "the result is free" passes for
		// any hardcoded port that happens to be idle.
		const squatter = spawn("bun", ["run", STUB], {
			detached: true,
			env: { ...process.env, PORT: String(PORT) },
			stdio: "ignore",
		});
		try {
			while ((await portOwner(PORT)) === null) {
				await new Promise((r) => setTimeout(r, 50));
			}
			const port = await findFreePort();
			expect(port).not.toBe(PORT);
			expect(port).toBeGreaterThan(1024);
			expect(await portOwner(port)).toBeNull();
		} finally {
			process.kill(-(squatter.pid ?? 0), "SIGKILL");
			while ((await portOwner(PORT)) !== null) {
				await new Promise((r) => setTimeout(r, 50));
			}
		}
	}, 30_000);

	it("boots on a self-chosen port when none is pinned", async () => {
		const result = await measureRuntime({
			version: "1.4.0",
			routes: ["/"],
			cwd: process.cwd(),
			command: ["bun", "run", STUB],
			load: { concurrency: 2, durationMs: 300 },
			settleMs: 100,
			cooldownMs: 100,
		});
		expect(result.totalRequests).toBeGreaterThan(0);
	}, 30_000);
});
