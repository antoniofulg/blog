import { readFileSync } from "node:fs";
import { join } from "node:path";

export type FontEntry = {
	name: string;
	data: Buffer;
	weight: 400 | 700;
	style: "normal";
};

/**
 * Load Inter (regular + bold) and JetBrains Mono (regular) from @fontsource/* paths.
 * Returns a satori-compatible font array.
 *
 * Reads WOFF files synchronously — called once per generateOgImage invocation (or cached by caller).
 */
export function loadFonts(): FontEntry[] {
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

	return [
		{ name: "Inter", data: interRegular, weight: 400, style: "normal" },
		{ name: "Inter", data: interBold, weight: 700, style: "normal" },
		{
			name: "JetBrains Mono",
			data: jbMono,
			weight: 400,
			style: "normal",
		},
	];
}
