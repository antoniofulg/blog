import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import { describe, expect, it } from "vitest";
import {
	BENCH_VERSIONS,
	envFor,
	installCommand,
	toolchainFor,
} from "#/lib/bench/versions";

const CWD = "/repo";

describe("bench versions", () => {
	it("declares the compared versions in one place", () => {
		expect([...BENCH_VERSIONS]).toEqual(["1.3.14", "1.4.0"]);
	});

	it("resolves every toolchain path under .bench/", () => {
		const tc = toolchainFor("1.4.0", CWD);
		expect(tc.root).toBe(join(CWD, ".bench", "bun-1.4.0"));
		expect(tc.binary).toBe(join(CWD, ".bench", "bun-1.4.0", "bin", "bun"));
		expect(tc.cacheDir).toBe(
			join(CWD, ".bench", "bun-1.4.0", "install", "cache"),
		);
	});

	it("points BUN_INSTALL and the cache dir away from the global ~/.bun", () => {
		const env = envFor("1.3.14", { PATH: "/usr/bin" }, CWD);
		const global = join(homedir(), ".bun");
		expect(env.BUN_INSTALL).toBe(join(CWD, ".bench", "bun-1.3.14"));
		expect(env.BUN_INSTALL).not.toContain(global);
		expect(env.BUN_INSTALL_CACHE_DIR).not.toContain(global);
	});

	it("prepends the version bin to PATH and keeps the original entries", () => {
		const env = envFor("1.4.0", { PATH: `/usr/bin${delimiter}/bin` }, CWD);
		const entries = (env.PATH ?? "").split(delimiter);
		expect(entries[0]).toBe(join(CWD, ".bench", "bun-1.4.0", "bin"));
		expect(entries).toContain("/usr/bin");
		expect(entries).toContain("/bin");
	});

	it("keeps unrelated environment variables intact", () => {
		const env = envFor(
			"1.4.0",
			{ PATH: "/usr/bin", DATABASE_URL: "pg://x" },
			CWD,
		);
		expect(env.DATABASE_URL).toBe("pg://x");
	});

	it("names the exact install command for a missing toolchain", () => {
		expect(installCommand("1.3.14", CWD)).toContain('bash -s "bun-v1.3.14"');
		expect(installCommand("1.3.14", CWD)).toContain(
			join(CWD, ".bench", "bun-1.3.14"),
		);
	});
});
