import { describe, expect, it } from "vitest";
import { resolvePreparePath } from "#/lib/bench/runner.server";
import { envFor, toolchainFor } from "#/lib/bench/versions";
import { WORKLOADS } from "#/lib/bench/workloads";

const CWD = "/repo";

// Both compared Bun versions extract packages into BUN_INSTALL_CACHE_DIR and
// leave the global ~/.bun/install untouched — verified on 2026-08-20 with the
// probe recorded in docs/benchmarks/bun-1-4/README.md. These tests pin the
// consequence: what a cold install clears must be exactly what the measured
// process was told to use as its store.
describe("install-cold clears the store the measured version actually uses", () => {
	it("clears the install cache before a cold install", () => {
		const coldInstall = WORKLOADS.find((w) => w.id === "install-cold");
		expect(coldInstall?.prepare).toContain("rm-install-cache");
	});

	it("clears exactly the directory the workload is told to use as its store", () => {
		for (const version of ["1.3.14", "1.4.0"]) {
			const cleared = resolvePreparePath("rm-install-cache", version, CWD);
			const used = envFor(
				version,
				{ PATH: "/usr/bin" },
				CWD,
			).BUN_INSTALL_CACHE_DIR;
			expect(cleared).toBe(used);
			expect(cleared).toBe(toolchainFor(version, CWD).cacheDir);
		}
	});

	it("keeps each version's store separate so one cannot warm the other", () => {
		expect(resolvePreparePath("rm-install-cache", "1.3.14", CWD)).not.toBe(
			resolvePreparePath("rm-install-cache", "1.4.0", CWD),
		);
	});
});
