// Which Bun versions the benchmark compares, and how each one's toolchain is
// laid out on disk. Every path lives under .bench/ so the developer's global
// ~/.bun install is never read from or written to during a run.
import { delimiter, join } from "node:path";

/**
 * The single declared list of compared versions. Adding a version here is the
 * only edit needed to widen the matrix — no workload code references a version.
 */
export const BENCH_VERSIONS = ["1.3.14", "1.4.0"] as const;

/** Directory holding every per-version toolchain, relative to the repo root. */
export const BENCH_ROOT = ".bench";

export type Toolchain = {
	/** BUN_INSTALL root for this version. */
	root: string;
	/** Directory prepended to PATH so `bun` resolves to this version. */
	bin: string;
	/** The bun executable itself. */
	binary: string;
	/** BUN_INSTALL_CACHE_DIR for this version. */
	cacheDir: string;
};

export function toolchainFor(version: string, cwd = process.cwd()): Toolchain {
	const root = join(cwd, BENCH_ROOT, `bun-${version}`);
	return {
		root,
		bin: join(root, "bin"),
		binary: join(root, "bin", "bun"),
		cacheDir: join(root, "install", "cache"),
	};
}

/**
 * Environment for a workload spawned under `version`. Prepends the version's
 * bin to PATH and redirects both the install root and the install cache into
 * .bench/, so a workload can never populate or clear the global cache.
 */
export function envFor(
	version: string,
	baseEnv: NodeJS.ProcessEnv,
	cwd = process.cwd(),
): NodeJS.ProcessEnv {
	const tc = toolchainFor(version, cwd);
	return {
		...baseEnv,
		PATH: [tc.bin, baseEnv.PATH ?? ""].filter(Boolean).join(delimiter),
		BUN_INSTALL: tc.root,
		BUN_INSTALL_CACHE_DIR: tc.cacheDir,
	};
}

/** The `curl … | bash` line that installs a missing toolchain. */
export function installCommand(version: string, cwd = process.cwd()): string {
	const tc = toolchainFor(version, cwd);
	return `curl -fsSL https://bun.com/install | BUN_INSTALL="${tc.root}" bash -s "bun-v${version}"`;
}
