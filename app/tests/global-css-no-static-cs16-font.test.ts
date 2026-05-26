/**
 * Guards against accidental re-introduction of the static Press Start 2P
 * @import in app/styles/global.css (task_06, AC-1).
 *
 * The font is now lazy-loaded at runtime via ensureCs16Font() in theme.tsx
 * (ADR-004). The @import was removed to eliminate ~30 KB from the
 * critical-path CSS bundle for visitors who never activate cs16.
 *
 * If these tests break, someone re-added the static import — remove it and
 * rely on the ensureCs16Font() runtime injection instead.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const rootDir = new URL("../../", import.meta.url).pathname.replace(/\/$/, "");
const globalCssPath = join(rootDir, "app/styles/global.css");
const globalCss = readFileSync(globalCssPath, "utf-8");

// ---------------------------------------------------------------------------
// AC-1: static @import guard
// ---------------------------------------------------------------------------

describe("global.css — no static Press Start 2P import (task_06 AC-1)", () => {
	it("does NOT contain the @fontsource/press-start-2p package import", () => {
		// The exact string from the old import line — must be absent.
		expect(globalCss).not.toContain("@fontsource/press-start-2p");
	});

	it("does NOT contain a static @import for the press-start-2p CSS", () => {
		// Matches `@import "...press-start-2p...` pattern regardless of whitespace.
		// Uses the @import keyword + package name together to distinguish from
		// URL references in comments.
		expect(globalCss).not.toMatch(/@import[^;]*press-start-2p/);
	});
});

// ---------------------------------------------------------------------------
// cs16 block still present — ensures the lazily-loaded font is actually used
// ---------------------------------------------------------------------------

describe("global.css — cs16 font-family rules still present", () => {
	it("contains the html.cs16 body font-family rule for Press Start 2P", () => {
		expect(globalCss).toContain("html.cs16 body");
		expect(globalCss).toContain('"Press Start 2P"');
	});

	it("contains the @custom-variant cs16 declaration", () => {
		expect(globalCss).toContain("@custom-variant cs16");
	});

	it("contains the .cs16 color-variable block", () => {
		// The .cs16 { --background: ... } color section must survive the import removal.
		expect(globalCss).toContain(".cs16 {");
		expect(globalCss).toContain("--cs16-bevel-light");
	});

	it("retains the Inter and JetBrains Mono @imports (unrelated fonts unchanged)", () => {
		expect(globalCss).toContain("@fontsource/inter/latin-400.css");
		expect(globalCss).toContain("@fontsource/jetbrains-mono/latin-400.css");
	});
});
