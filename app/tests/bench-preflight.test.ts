import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	LOAD_AVG_LIMIT,
	type PreflightDeps,
	type PreflightOpts,
	preflight,
	RUNTIME_PORT,
	resolveRuntimeRoutes,
} from "#/lib/bench/preflight.server";
import type { Workload } from "#/lib/bench/workloads";

const CWD = "/repo";

const PLAIN: Workload = {
	id: "lint",
	argv: ["bun", "run", "lint"],
	reps: 3,
	needsDb: false,
	needsBundle: false,
	prepare: [],
};

const DB_WORKLOAD: Workload = { ...PLAIN, id: "sync", needsDb: true };

function deps(over: Partial<PreflightDeps> = {}): PreflightDeps {
	return {
		bunVersion: async (binary) =>
			binary.includes("bun-1.3.14") ? "1.3.14" : "1.4.0",
		loadAvg1: () => 0.5,
		dockerAvailable: async () => true,
		dbContainerRunning: async () => true,
		portOwner: async () => null,
		runtimeRoutes: async () => ["/", "/blog", "/post", "/pt-br/post"],
		...over,
	};
}

function opts(over: Partial<PreflightOpts> = {}): PreflightOpts {
	return {
		versions: ["1.3.14", "1.4.0"],
		workloads: [PLAIN],
		allowNoisy: false,
		includeRuntime: false,
		cwd: CWD,
		...over,
	};
}

function reasonOf(result: Awaited<ReturnType<typeof preflight>>): string {
	return result.ok ? "" : result.reason;
}

describe("bench preflight", () => {
	it("passes on a quiet machine with both toolchains installed", async () => {
		expect(await preflight(opts(), deps())).toEqual({ ok: true });
	});

	it("names the exact install command when a toolchain is missing", async () => {
		const result = await preflight(
			opts(),
			deps({ bunVersion: async () => null }),
		);
		expect(result.ok).toBe(false);
		expect(reasonOf(result)).toContain('bash -s "bun-v1.3.14"');
		expect(reasonOf(result)).toContain(join(CWD, ".bench", "bun-1.3.14"));
	});

	it("rejects a toolchain whose reported version does not match the pin", async () => {
		const result = await preflight(
			opts(),
			deps({ bunVersion: async () => "1.3.9" }),
		);
		expect(result.ok).toBe(false);
		expect(reasonOf(result)).toContain("reports 1.3.9, expected 1.3.14");
	});

	it("aborts above the load-average limit and names the observed value", async () => {
		const result = await preflight(opts(), deps({ loadAvg1: () => 28.01 }));
		expect(result.ok).toBe(false);
		expect(reasonOf(result)).toContain("28.01");
		expect(reasonOf(result)).toContain("--allow-noisy");
	});

	it("runs anyway above the limit when --allow-noisy was passed", async () => {
		const result = await preflight(
			opts({ allowNoisy: true }),
			deps({ loadAvg1: () => 28.01 }),
		);
		expect(result).toEqual({ ok: true });
	});

	it("treats a load average exactly at the limit as acceptable", async () => {
		const result = await preflight(
			opts(),
			deps({ loadAvg1: () => LOAD_AVG_LIMIT }),
		);
		expect(result).toEqual({ ok: true });
	});

	it("does not require Docker when no selected workload needs the database", async () => {
		const result = await preflight(
			opts({ workloads: [PLAIN] }),
			deps({ dockerAvailable: async () => false }),
		);
		expect(result).toEqual({ ok: true });
	});

	it("distinguishes Docker being absent from the container being stopped", async () => {
		const noDocker = await preflight(
			opts({ workloads: [DB_WORKLOAD] }),
			deps({ dockerAvailable: async () => false }),
		);
		expect(reasonOf(noDocker)).toContain("Docker is not available");

		const noContainer = await preflight(
			opts({ workloads: [DB_WORKLOAD] }),
			deps({ dbContainerRunning: async () => false }),
		);
		expect(reasonOf(noContainer)).toContain("docker compose up db -d");
		expect(reasonOf(noContainer)).not.toContain("Docker is not available");
	});

	it("aborts when the runtime port is bound, naming the port and the owner", async () => {
		const result = await preflight(
			opts({ includeRuntime: true }),
			deps({ portOwner: async () => 4242 }),
		);
		expect(result.ok).toBe(false);
		expect(reasonOf(result)).toContain(String(RUNTIME_PORT));
		expect(reasonOf(result)).toContain("PID 4242");
	});

	it("does not check the runtime port when the runtime workload is not selected", async () => {
		const result = await preflight(
			opts({ includeRuntime: false }),
			deps({ portOwner: async () => 4242 }),
		);
		expect(result).toEqual({ ok: true });
	});

	it("aborts when no pt-br route resolves for the runtime workload", async () => {
		const result = await preflight(
			opts({ includeRuntime: true }),
			deps({ runtimeRoutes: async () => ["/", "/blog", "/post"] }),
		);
		expect(result.ok).toBe(false);
		expect(reasonOf(result)).toContain("pt-br");
	});

	it("resolves four real SSR routes from the post inventory", async () => {
		const routes = await resolveRuntimeRoutes();
		expect(routes[0]).toBe("/");
		expect(routes[1]).toBe("/blog");
		expect(routes.some((r) => r.startsWith("/pt-br/"))).toBe(true);
		expect(routes).toHaveLength(4);
	});
});
