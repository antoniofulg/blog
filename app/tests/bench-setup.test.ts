import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { BENCH_VERSIONS } from "#/lib/bench/versions";

const root = process.cwd();
const read = (name: string) => readFile(join(root, name), "utf-8");

describe("bench workspace setup", () => {
	it("ignores the per-version toolchain workspace", async () => {
		expect(await read(".gitignore")).toContain(".bench/");
	});

	it("installs each toolchain with the pinned bun tag", async () => {
		const makefile = await read("Makefile");
		expect(makefile).toContain("bench-setup:");
		expect(makefile).toContain('bash -s "bun-v$$v"');
		expect(makefile).toContain('BUN_INSTALL="$$root"');
	});

	it("skips a toolchain that is already installed at the right version", async () => {
		const makefile = await read("Makefile");
		expect(makefile).toContain('"$$root/bin/bun" --version');
		expect(makefile).toContain("already installed");
	});

	it("exposes a bench target that delegates to the harness", async () => {
		const makefile = await read("Makefile");
		expect(makefile).toMatch(/^bench:.*$/m);
		expect(makefile).toContain("bun run bench");
	});

	it("keeps the Makefile version list in sync with the declared versions", async () => {
		const makefile = await read("Makefile");
		const declared = makefile.match(/^BENCH_VERSIONS \?= (.+)$/m)?.[1] ?? "";
		expect(declared.trim().split(/\s+/)).toEqual([...BENCH_VERSIONS]);
	});
});
