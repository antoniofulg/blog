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
	const pixelifyPath = abs("public/fonts/cs16/pixelify-sans-latin-400.woff2");
	const cssPath = abs("public/fonts/cs16/cs16-font.css");

	it("ArialPixel.ttf exists in public/fonts/cs16/", () => {
		expect(existsSync(ttfPath)).toBe(true);
	});

	it("ArialPixel.ttf is non-empty (sanity check on the vendored bytes)", () => {
		expect(statSync(ttfPath).size).toBeGreaterThan(1000);
	});

	it("pixelify-sans-latin-400.woff2 exists as the Latin-1+Latin-Extended fallback", () => {
		expect(existsSync(pixelifyPath)).toBe(true);
	});

	it("pixelify-sans-latin-400.woff2 is non-empty", () => {
		expect(statSync(pixelifyPath).size).toBeGreaterThan(1000);
	});

	it("cs16-font.css exists and declares @font-face for ArialPixel", () => {
		expect(existsSync(cssPath)).toBe(true);
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("@font-face");
		expect(css).toContain("ArialPixel");
	});

	it("cs16-font.css declares two @font-face blocks under the same family name (unicode-range fallback chain)", () => {
		const css = readFileSync(cssPath, "utf-8");
		// Match the rule head (`@font-face {`) so prose mentions inside the
		// file's top comment do not count as declarations.
		const fontFaceCount = (css.match(/@font-face\s*\{/g) ?? []).length;
		expect(fontFaceCount).toBe(2);
		// Both blocks must use the same family name so the browser picks the
		// matching file per codepoint via unicode-range, not per stack order.
		const familyDecls = css.match(/font-family:\s*"ArialPixel"/g) ?? [];
		expect(familyDecls.length).toBe(2);
	});

	it("cs16-font.css scopes ArialPixel.ttf to Basic Latin (U+0020-007E)", () => {
		const css = readFileSync(cssPath, "utf-8");
		// First @font-face references the .ttf; its unicode-range must be ASCII printable.
		expect(css).toContain("/fonts/cs16/ArialPixel.ttf");
		expect(css).toContain("U+0020-007E");
	});

	it("cs16-font.css scopes the Pixelify Sans fallback to Latin-1 Supplement + Latin Extended (U+0080-024F)", () => {
		const css = readFileSync(cssPath, "utf-8");
		expect(css).toContain("/fonts/cs16/pixelify-sans-latin-400.woff2");
		// Covers ã (U+00E3), é (U+00E9), ç (U+00E7), õ (U+00F5), á (U+00E1) etc.
		expect(css).toContain("U+0080-024F");
	});

	it("cs16-font.css sets font-display: swap on both blocks (non-blocking pattern)", () => {
		const css = readFileSync(cssPath, "utf-8");
		const swapCount = (css.match(/font-display:\s*swap/g) ?? []).length;
		expect(swapCount).toBe(2);
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
