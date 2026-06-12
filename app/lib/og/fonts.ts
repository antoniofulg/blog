import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

export type FontEntry = {
	name: string;
	data: Buffer;
	weight: 400 | 700;
	style: "normal";
};

// Module-level cache — font files never change between calls within a process.
// Avoids 3 readFileSync calls per generateOgImage invocation during content sync.
let _fontsCache: FontEntry[] | null = null;

/**
 * Reset the font cache. Only for use in tests that need to verify font-loading
 * error paths — do NOT call in production code.
 */
export function _clearFontCacheForTesting(): void {
	_fontsCache = null;
}

// Full JetBrains Mono TTF (OFL), committed under ./assets. Unlike the
// @fontsource latin-subset WOFF, this covers box-drawing (U+2500–257F) and the
// geometric-shape triangles (U+25B6 ▶, U+25BC ▼) used in ASCII flow diagrams —
// the latin subset has none of those, so satori dropped them to tofu on cards
// whose first code block is a diagram (e.g. the LangChain post's LangGraph map).
// Resolved relative to this module (not cwd) so it survives any working dir.
const JBMONO_TTF_PATH = fileURLToPath(
	new URL("./assets/JetBrainsMono-Regular.ttf", import.meta.url),
);

/**
 * Load Inter (regular + bold) from @fontsource and the full JetBrains Mono TTF
 * (committed under ./assets). Returns a satori-compatible font array.
 *
 * Reads font files synchronously on first call; subsequent calls return the cached result.
 */
export function loadFonts(): FontEntry[] {
	if (_fontsCache !== null) return _fontsCache;

	const base = join(process.cwd(), "node_modules");

	const interRegular = readFileSync(
		join(base, "@fontsource/inter/files/inter-latin-400-normal.woff"),
	);
	const interBold = readFileSync(
		join(base, "@fontsource/inter/files/inter-latin-700-normal.woff"),
	);
	const jbMono = readFileSync(JBMONO_TTF_PATH);

	_fontsCache = [
		{ name: "Inter", data: interRegular, weight: 400, style: "normal" },
		{ name: "Inter", data: interBold, weight: 700, style: "normal" },
		{
			name: "JetBrains Mono",
			data: jbMono,
			weight: 400,
			style: "normal",
		},
	];
	return _fontsCache;
}
