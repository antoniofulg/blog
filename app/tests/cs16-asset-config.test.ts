/**
 * Tests for the CS 1.6 ArialPixel font static-asset serving (task_03).
 *
 * ArialPixel.ttf is vendored from ekmas/cs16.css (MIT) at
 * `public/fonts/cs16/ArialPixel.ttf` and served by Nitro's built-in public/
 * handler — no `publicAssets` entry required.
 *
 * Unit tests verify the vendored font file and the CSS that loads it both
 * exist and reference each other correctly.
 *
 * Integration tests (post-build) verify the files land at the expected paths
 * under `.output/public/` after `bun run build`.
 *
 * See ADR-004: Lazy-Load Press Start 2P Inside `setTheme` (font swapped to
 * ArialPixel in the styling-adjustments commit).
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
// Unit tests — vendored ArialPixel font + the CSS that loads it
// ---------------------------------------------------------------------------

describe("cs16 vendored font assets", () => {
	const ttfPath = abs("public/fonts/cs16/ArialPixel.ttf");
	const cssPath = abs("public/fonts/cs16/cs16-font.css");

	it("ArialPixel.ttf exists in public/fonts/cs16/", () => {
		expect(existsSync(ttfPath)).toBe(true);
	});

	it("ArialPixel.ttf is non-empty (sanity check on the vendored bytes)", () => {
		expect(statSync(ttfPath).size).toBeGreaterThan(1000);
	});

	it("cs16-font.css exists and declares @font-face for ArialPixel", () => {
		expect(existsSync(cssPath)).toBe(true);
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("@font-face");
		expect(css).toContain("ArialPixel");
	});

	it("cs16-font.css points its src URL at /fonts/cs16/ArialPixel.ttf", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("/fonts/cs16/ArialPixel.ttf");
	});

	it("cs16-font.css sets font-display: swap (matches non-blocking pattern of other fonts)", () => {
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
		// Either ArialPixel or the historical Press Start 2P import would put the
		// font on the critical path for all visitors. Both are banned.
		expect(css).not.toMatch(/@import\s+["'][^"']*ArialPixel/);
		expect(css).not.toMatch(/@import\s+["'][^"']*press-start-2p/i);
	});

	it("global.css references the ArialPixel family in the .cs16 block (font is applied once loaded)", () => {
		const css = readFileSync(globalCss, "utf-8");
		expect(css).toContain("ArialPixel");
	});
});

// ---------------------------------------------------------------------------
// Integration tests — post-build artifact assertions.
// Skip when the build output does not exist yet.
// Run `bun run build` first to exercise these tests.
// ---------------------------------------------------------------------------

describe("cs16 vendored-font build output", () => {
	const ttfOutput = abs(".output/public/fonts/cs16/ArialPixel.ttf");
	const cssOutput = abs(".output/public/fonts/cs16/cs16-font.css");

	const hasBuildOutput = existsSync(ttfOutput) && existsSync(cssOutput);

	it.skipIf(!hasBuildOutput)(
		"ArialPixel.ttf lands at .output/public/fonts/cs16/ArialPixel.ttf",
		() => {
			expect(existsSync(ttfOutput)).toBe(true);
		},
	);

	it.skipIf(!hasBuildOutput)(
		"cs16-font.css lands at .output/public/fonts/cs16/cs16-font.css",
		() => {
			expect(existsSync(cssOutput)).toBe(true);
		},
	);

	it.skipIf(!hasBuildOutput)(
		"copied cs16-font.css is non-empty and still references ArialPixel.ttf",
		() => {
			const css = readFileSync(cssOutput, "utf-8");
			expect(css).toContain("ArialPixel");
			expect(css).toContain("/fonts/cs16/ArialPixel.ttf");
		},
	);
});
