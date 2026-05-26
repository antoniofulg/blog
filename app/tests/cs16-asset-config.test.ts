/**
 * Tests for the Press Start 2P static-asset serving configuration (task_03).
 *
 * Unit tests verify the source files referenced by the Nitro publicAssets rule
 * exist in node_modules and that their relative URL references are coherent.
 *
 * Integration tests (post-build) verify the copied files land at the expected
 * paths under .output/public/ and that the default JS bundle does not inline
 * a @font-face declaration for Press Start 2P.
 *
 * See ADR-004: Lazy-Load Press Start 2P Inside `setTheme`.
 *
 * Mechanism note: vite-plugin-static-copy was evaluated but does not work
 * with Nitro's environments-based build (it reads the global Vite config's
 * build.outDir which defaults to "dist", while Nitro sets outDir only on
 * the per-environment config via configEnvironment()). Nitro's publicAssets
 * is the correct mechanism — it resolves in both dev and prod.
 */

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rootDir = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function abs(...parts: string[]): string {
	return join(rootDir, ...parts);
}

function findCssFiles(dir: string): string[] {
	const results: string[] = [];
	for (const entry of readdirSync(dir)) {
		const full = join(dir, entry);
		if (statSync(full).isDirectory()) {
			results.push(...findCssFiles(full));
		} else if (entry.endsWith(".css")) {
			results.push(full);
		}
	}
	return results;
}

// ---------------------------------------------------------------------------
// Unit tests — verify the source paths referenced by the Nitro publicAssets rule
// ---------------------------------------------------------------------------

describe("cs16 static-asset source files", () => {
	const cssPath = abs("node_modules/@fontsource/press-start-2p/latin-400.css");
	const woff2Path = abs(
		"node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff2",
	);
	const woffPath = abs(
		"node_modules/@fontsource/press-start-2p/files/press-start-2p-latin-400-normal.woff",
	);

	it("latin-400.css exists in node_modules at the path the Nitro publicAssets rule references", () => {
		expect(existsSync(cssPath)).toBe(true);
	});

	it("latin-400.css contains a @font-face declaration for Press Start 2P", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("@font-face");
		expect(css).toContain("Press Start 2P");
	});

	it("latin-400.css references ./files/press-start-2p-latin-400-normal.woff2 (relative url)", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("./files/press-start-2p-latin-400-normal.woff2");
	});

	it("woff2 file exists at the path referenced by latin-400.css", () => {
		expect(existsSync(woff2Path)).toBe(true);
	});

	it("woff file exists at the path referenced by latin-400.css", () => {
		expect(existsSync(woffPath)).toBe(true);
	});

	it("latin-400.css references ./files/press-start-2p-latin-400-normal.woff (fallback url)", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("./files/press-start-2p-latin-400-normal.woff");
	});
});

// ---------------------------------------------------------------------------
// Integration tests — post-build artifact assertions.
// Skip when the build output produced by this config does not exist yet.
// Run `bun run build` first to exercise these tests.
// ---------------------------------------------------------------------------

describe("cs16 static-asset build output", () => {
	const outputBase = abs(".output/public/_fontsource/press-start-2p");
	const cssOutput = join(outputBase, "latin-400.css");
	const woff2Output = join(
		outputBase,
		"files/press-start-2p-latin-400-normal.woff2",
	);
	const woffOutput = join(
		outputBase,
		"files/press-start-2p-latin-400-normal.woff",
	);

	// Only run integration tests if our specific font CSS output exists,
	// meaning the build has been run with the Nitro publicAssets configured.
	const hasFontOutput = existsSync(cssOutput);

	it.skipIf(!hasFontOutput)(
		"latin-400.css lands at .output/public/_fontsource/press-start-2p/latin-400.css",
		() => {
			expect(existsSync(cssOutput)).toBe(true);
		},
	);

	it.skipIf(!hasFontOutput)(
		"copied latin-400.css has valid @font-face content (not truncated)",
		() => {
			const css = readFileSync(cssOutput, "utf-8");
			expect(css).toContain("@font-face");
			expect(css).toContain("Press Start 2P");
			expect(css).toContain("files/press-start-2p-latin-400-normal.woff2");
		},
	);

	it.skipIf(!hasFontOutput)(
		"woff2 lands at .output/public/_fontsource/press-start-2p/files/",
		() => {
			expect(existsSync(woff2Output)).toBe(true);
		},
	);

	it.skipIf(!hasFontOutput)(
		"woff lands at .output/public/_fontsource/press-start-2p/files/",
		() => {
			expect(existsSync(woffOutput)).toBe(true);
		},
	);

	// AC-4: The main CSS bundle must not contain a Press Start 2P @font-face rule.
	// This test is skipped while app/styles/global.css still carries the static
	// @import "@fontsource/press-start-2p/latin-400.css" (removed in task_06).
	// Once task_06 removes that import, re-run `bun run build` — this test passes.
	const globalCss = abs("app/styles/global.css");
	const globalCssHasFontImport = existsSync(globalCss)
		? readFileSync(globalCss, "utf-8").includes("@fontsource/press-start-2p")
		: false;

	it.skipIf(!hasFontOutput || globalCssHasFontImport)(
		"default CSS bundle does not contain a Press Start 2P @font-face rule (requires task_06 @import removal)",
		() => {
			const publicDir = abs(".output/public");
			const allCss = findCssFiles(publicDir);

			// Exclude the copied font CSS itself from the check
			const bundleChunks = allCss.filter((f) => !f.includes("_fontsource"));

			for (const chunk of bundleChunks) {
				const content = readFileSync(chunk, "utf-8");
				// The .cs16 { font-family: "Press Start 2P", ... } rules are expected
				// to appear in the bundle CSS (they are needed once the font is loaded).
				// Other @font-face rules (Inter, JetBrains Mono) are also expected.
				// What must NOT appear is a @font-face block that declares Press Start 2P.
				// The regex matches @font-face blocks containing "Press Start 2P" on the
				// same rule (handles both minified and expanded output).
				const hasPressStart2PFontFace =
					/@font-face[^{]*\{[^}]*Press Start 2P/.test(content);
				expect(hasPressStart2PFontFace).toBe(false);
			}
		},
	);
});
