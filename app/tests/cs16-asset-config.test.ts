/**
 * Tests for the CS 1.6 VT323 font static-asset serving (task_03).
 *
 * VT323 is vendored from @fontsource/vt323 (OFL) at
 * `public/fonts/cs16/vt323-latin-400.woff2` and served by Nitro's built-in
 * public/ handler — no `publicAssets` entry required.
 *
 * Unit tests verify the vendored font file and the CSS that loads it both
 * exist and reference each other correctly.
 *
 * Integration tests (post-build) verify the files land at the expected paths
 * under `.output/public/` after `bun run build`.
 *
 * See ADR-004: Lazy-Load Press Start 2P Inside `setTheme` (the font has
 * since cycled Press Start 2P → ArialPixel → VT323; the ADR's lazy-load
 * mechanism is unchanged).
 */

import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const rootDir = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");

function abs(...parts: string[]): string {
	return join(rootDir, ...parts);
}

// ---------------------------------------------------------------------------
// Unit tests — vendored VT323 font + the CSS that loads it
// ---------------------------------------------------------------------------

describe("cs16 vendored font assets", () => {
	const woff2Path = abs("public/fonts/cs16/vt323-latin-400.woff2");
	const cssPath = abs("public/fonts/cs16/cs16-font.css");

	it("vt323-latin-400.woff2 exists in public/fonts/cs16/", () => {
		expect(existsSync(woff2Path)).toBe(true);
	});

	it("vt323-latin-400.woff2 is non-empty (sanity check on the vendored bytes)", () => {
		expect(statSync(woff2Path).size).toBeGreaterThan(1000);
	});

	it("cs16-font.css exists and declares @font-face for VT323", () => {
		expect(existsSync(cssPath)).toBe(true);
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("@font-face");
		expect(css).toContain("VT323");
	});

	it("cs16-font.css points its src URL at /fonts/cs16/vt323-latin-400.woff2", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("/fonts/cs16/vt323-latin-400.woff2");
	});

	it("cs16-font.css declares exactly one @font-face block (no fallback chain needed)", () => {
		const css = readFileSync(cssPath, "utf-8");
		// Match the rule head (`@font-face {`) so prose mentions inside the
		// file's top comment do not count as declarations.
		const fontFaceCount = (css.match(/@font-face\s*\{/g) ?? []).length;
		expect(fontFaceCount).toBe(1);
	});

	it("cs16-font.css sets font-display: swap (non-blocking pattern)", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("font-display: swap");
	});
});

// ---------------------------------------------------------------------------
// Regression guard — global.css must not re-introduce a static @import
// ---------------------------------------------------------------------------

describe("cs16 global.css regression guard", () => {
	const globalCss = abs("app/styles/global.css");

	it("global.css does not statically @import any cs16 font (must lazy-load via ensureCs16Font)", () => {
		const css = readFileSync(globalCss, "utf-8");
		// Historical cs16 fonts (Press Start 2P, ArialPixel) are explicitly banned
		// alongside the current VT323 — any static @import puts the font on the
		// critical path for all visitors, defeating the lazy-load design.
		expect(css).not.toMatch(/@import\s+["'][^"']*press-start-2p/i);
		expect(css).not.toMatch(/@import\s+["'][^"']*ArialPixel/);
		expect(css).not.toMatch(/@import\s+["'][^"']*vt323/i);
	});

	it("global.css references the VT323 family in the .cs16 block (font is applied once loaded)", () => {
		const css = readFileSync(globalCss, "utf-8");
		expect(css).toContain("VT323");
	});
});

// ---------------------------------------------------------------------------
// Integration tests — post-build artifact assertions.
// Skip when the build output does not exist yet.
// Run `bun run build` first to exercise these tests.
// ---------------------------------------------------------------------------

describe("cs16 vendored-font build output", () => {
	const woff2Output = abs(".output/public/fonts/cs16/vt323-latin-400.woff2");
	const cssOutput = abs(".output/public/fonts/cs16/cs16-font.css");

	const hasBuildOutput = existsSync(woff2Output) && existsSync(cssOutput);

	it.skipIf(!hasBuildOutput)(
		"vt323-latin-400.woff2 lands at .output/public/fonts/cs16/vt323-latin-400.woff2",
		() => {
			expect(existsSync(woff2Output)).toBe(true);
		},
	);

	it.skipIf(!hasBuildOutput)(
		"cs16-font.css lands at .output/public/fonts/cs16/cs16-font.css",
		() => {
			expect(existsSync(cssOutput)).toBe(true);
		},
	);

	it.skipIf(!hasBuildOutput)(
		"copied cs16-font.css is non-empty and still references the vendored woff2",
		() => {
			const css = readFileSync(cssOutput, "utf-8");
			expect(css).toContain("VT323");
			expect(css).toContain("/fonts/cs16/vt323-latin-400.woff2");
		},
	);
});
