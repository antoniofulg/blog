import { readFileSync } from "node:fs";
import { join } from "node:path";

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

/**
 * Load Inter (regular + bold) and JetBrains Mono (regular) from @fontsource/* paths.
 * Returns a satori-compatible font array.
 *
 * Reads WOFF files synchronously on first call; subsequent calls return the cached result.
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
	const jbMono = readFileSync(
		join(
			base,
			"@fontsource/jetbrains-mono/files/jetbrains-mono-latin-400-normal.woff",
		),
	);

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
