import { describe, expect, it } from "vitest";
import {
	parsePlaywrightCounts,
	selectWorkloads,
	WORKLOADS,
} from "#/lib/bench/workloads";

function byId(id: string) {
	const w = WORKLOADS.find((x) => x.id === id);
	if (!w) throw new Error(`missing workload ${id}`);
	return w;
}

describe("bench workload registry", () => {
	it("declares every measured pipeline step with a stable id", () => {
		expect(WORKLOADS.map((w) => w.id)).toEqual([
			"install-cold",
			"install-warm",
			"build",
			"test",
			"test-e2e",
			"lint",
			"check",
			"sync",
			"audit-fe",
		]);
	});

	it("clears node_modules and the install cache before a cold install", () => {
		expect(byId("install-cold").prepare).toEqual([
			"rm-node-modules",
			"rm-install-cache",
		]);
	});

	it("preserves the install cache for a warm install", () => {
		expect(byId("install-warm").prepare).toEqual(["rm-node-modules"]);
	});

	it("clears the output and vite caches before a build", () => {
		expect(byId("build").prepare).toEqual(["rm-output", "rm-vite-cache"]);
	});

	it("runs every install with --frozen-lockfile so bun.lock is never rewritten", () => {
		for (const id of ["install-cold", "install-warm"]) {
			expect(byId(id).argv).toContain("--frozen-lockfile");
		}
	});

	it("excludes both install workloads from the pipeline total", () => {
		const excluded = WORKLOADS.filter((w) => w.excludeFromTotal).map(
			(w) => w.id,
		);
		expect(excluded).toEqual(["install-cold", "install-warm"]);
	});

	it("requires the database for exactly sync and audit-fe", () => {
		expect(WORKLOADS.filter((w) => w.needsDb).map((w) => w.id)).toEqual([
			"sync",
			"audit-fe",
		]);
	});

	it("requires the production bundle for exactly test-e2e and audit-fe", () => {
		expect(WORKLOADS.filter((w) => w.needsBundle).map((w) => w.id)).toEqual([
			"test-e2e",
			"audit-fe",
		]);
	});

	it("extracts playwright pass and fail counts from the summary line", () => {
		expect(parsePlaywrightCounts("  12 passed (34.5s)")).toEqual({
			passed: 12,
			failed: 0,
		});
		expect(parsePlaywrightCounts("  2 failed\n  10 passed (34.5s)")).toEqual({
			passed: 10,
			failed: 2,
		});
		expect(byId("test-e2e").parseExtra).toBe(parsePlaywrightCounts);
	});

	it("selects all workloads when no ids are given and a subset when they are", () => {
		expect(selectWorkloads()).toHaveLength(WORKLOADS.length);
		expect(selectWorkloads([]).length).toBe(WORKLOADS.length);
		expect(selectWorkloads(["lint"]).map((w) => w.id)).toEqual(["lint"]);
	});

	it("throws naming the unknown id rather than silently skipping it", () => {
		expect(() => selectWorkloads(["nope"])).toThrow(
			/unknown workload id "nope"/,
		);
	});
});
