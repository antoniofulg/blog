import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Resvg } from "@resvg/resvg-js";
import React from "react";
import satori from "satori";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import type { Locale } from "#/lib/locale";
import { loadFonts } from "./fonts";
import type { CardTemplateProps, TokenLine } from "./template";
import { CardTemplate } from "./template";
import { truncateCode } from "./truncate";

export type OgGenerateInput = {
	locale: Locale;
	slug: string;
	title: string;
	/** First fenced code block extracted from the post. Null if the post has no code blocks. */
	firstCodeBlock: { lang: string; code: string } | null;
};

// ---------------------------------------------------------------------------
// Shiki highlighter singleton for OG generation
// (separate from the MDX renderer highlighter — this one runs at sync time)
// ---------------------------------------------------------------------------

let _highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null;

function getHighlighter() {
	if (!_highlighterPromise) {
		_highlighterPromise = createHighlighterCore({
			themes: [import("@shikijs/themes/github-dark")],
			langs: [
				import("@shikijs/langs/typescript"),
				import("@shikijs/langs/javascript"),
				import("@shikijs/langs/jsx"),
				import("@shikijs/langs/tsx"),
				import("@shikijs/langs/json"),
				import("@shikijs/langs/bash"),
				import("@shikijs/langs/markdown"),
				import("@shikijs/langs/css"),
				import("@shikijs/langs/html"),
				import("@shikijs/langs/yaml"),
				import("@shikijs/langs/python"),
			],
			engine: createJavaScriptRegexEngine(),
		});
	}
	return _highlighterPromise;
}

// ---------------------------------------------------------------------------
// Default Shiki github-dark colours (used when tokenisation falls back)
// ---------------------------------------------------------------------------

const DEFAULT_BG = "#24292e";
const DEFAULT_FG = "#e1e4e8";

// ---------------------------------------------------------------------------
// Profile avatar → base64 data URI, read once and cached. Same source + framing
// as the /about profile photo (public/about/profile.jpeg, rendered rounded-full /
// object-cover / centered). Rendered round, bottom-left in the card footer.
// Best-effort: "" if missing so the footer falls back to the Terminal mark and
// generation never fails on it.
// ---------------------------------------------------------------------------

let _avatarPromise: Promise<string> | null = null;

function loadAvatarDataUri(): Promise<string> {
	if (!_avatarPromise) {
		_avatarPromise = readFile(
			join(process.cwd(), "public", "about", "profile.jpeg"),
		)
			.then((buf) => `data:image/jpeg;base64,${buf.toString("base64")}`)
			.catch(() => "");
	}
	return _avatarPromise;
}

// ---------------------------------------------------------------------------
// generateOgImage
// ---------------------------------------------------------------------------

/**
 * Renders a 1200 × 630 PNG to `public/og/{locale}/{slug}.png` and returns the
 * public path on success (e.g. `/og/en/my-slug.png`).
 *
 * Never throws — any error is logged as a console.warn and returns `null` so
 * the MDX sync pipeline continues uninterrupted.
 */
export async function generateOgImage(
	input: OgGenerateInput,
): Promise<string | null> {
	const { locale, slug, title, firstCodeBlock } = input;

	try {
		const fonts = loadFonts();
		const avatarDataUri = await loadAvatarDataUri();

		let tokenLines: TokenLine[] | null = null;
		let codeBg = DEFAULT_BG;
		let codeFg = DEFAULT_FG;
		let didTruncate = false;

		if (firstCodeBlock !== null) {
			// truncateCode caps the block to 10 lines / 600 chars and reports whether
			// it actually cut anything; the template uses `didTruncate` to drive the
			// "more code below" fade (ADR-005), so a complete block renders clean.
			const truncated = truncateCode(firstCodeBlock.code);
			const { lines } = truncated;
			didTruncate = truncated.didTruncate;

			const highlighter = await getHighlighter();
			let result: {
				tokens: Array<Array<{ content: string; color?: string }>>;
				bg?: string;
				fg?: string;
			};

			try {
				result = highlighter.codeToTokens(lines.join("\n"), {
					lang: firstCodeBlock.lang,
					theme: "github-dark",
				});
			} catch {
				// Unknown / unsupported language — render as plain text
				result = {
					tokens: lines.map((line) => [{ content: line, color: DEFAULT_FG }]),
					bg: DEFAULT_BG,
					fg: DEFAULT_FG,
				};
			}

			codeBg = result.bg ?? DEFAULT_BG;
			codeFg = result.fg ?? DEFAULT_FG;
			tokenLines = result.tokens.map((line) =>
				line.map((token) => ({
					content: token.content,
					color: token.color ?? DEFAULT_FG,
				})),
			);
		}

		// Build CardTemplate props
		const templateProps: CardTemplateProps = {
			title,
			tokenLines,
			codeBg,
			codeFg,
			didTruncate,
			siteUrl: process.env.SITE_URL ?? "",
			avatarDataUri,
		};

		// Render JSX → SVG via satori
		const element = React.createElement(CardTemplate, templateProps);
		const svg = await satori(element, {
			width: 1200,
			height: 630,
			fonts,
		});

		// Rasterize SVG → PNG via resvg-js
		const resvg = new Resvg(svg);
		const rendered = resvg.render();
		const png = rendered.asPng();

		// Write to public/og/{locale}/{slug}.png (mkdir -p first)
		const dir = join(process.cwd(), "public", "og", locale);
		await mkdir(dir, { recursive: true });

		const filePath = join(dir, `${slug}.png`);
		await writeFile(filePath, png);

		return `/og/${locale}/${slug}.png`;
	} catch (error) {
		console.warn(
			`[og] generation failed for ${slug}: ${error instanceof Error ? error.message : String(error)}`,
		);
		return null;
	}
}
