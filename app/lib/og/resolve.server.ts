import { existsSync } from "node:fs";
import { join } from "node:path";
import type { Locale } from "#/lib/locale";

export type ResolveOgImagePathInput = {
	/** Frontmatter override path. Null/undefined/empty → fall through. */
	coverImage?: string | null;
	locale: Locale;
	slug: string;
	/** Scheme + host (no trailing slash), e.g. "https://blog.example.com". */
	origin: string;
	/**
	 * Existence check for the auto-generated PNG.
	 * Defaults to `existsSync` from `node:fs`.
	 * Pass a custom fn in tests to avoid real filesystem I/O.
	 */
	existsFn?: (path: string) => boolean;
};

/**
 * Resolves the absolute OG image URL for a post via this priority order:
 * 1. `coverImage` frontmatter field (made absolute if relative)
 * 2. `/og/{locale}/{slug}.png` — if the file exists in `public/og/`
 * 3. `/og-image.jpg` — site-wide fallback
 *
 * Pure function; the only side effect is the file-existence check via
 * `existsFn`. Pass a custom `existsFn` to make tests deterministic.
 *
 * Server-only module: uses `node:fs` for filesystem checks.
 * Named `*.server.ts` so TanStack Start excludes it from the client bundle.
 */
export function resolveOgImagePath({
	coverImage,
	locale,
	slug,
	origin,
	existsFn = existsSync,
}: ResolveOgImagePathInput): string {
	// Step 1: frontmatter coverImage
	if (coverImage) {
		if (coverImage.startsWith("http://") || coverImage.startsWith("https://")) {
			return coverImage;
		}
		// Relative public path (CONTENT.md documents the field as "relative to
		// public/"). Authors may omit the leading slash (`og/cover.png` instead
		// of `/og/cover.png`); without normalising, `${origin}${coverImage}`
		// would produce `https://siteog/cover.png`. Ensure exactly one slash.
		const path = coverImage.startsWith("/") ? coverImage : `/${coverImage}`;
		return `${origin}${path}`;
	}

	// Step 2: auto-generated PNG
	const fsPath = join(process.cwd(), "public", "og", locale, `${slug}.png`);
	if (existsFn(fsPath)) {
		return `${origin}/og/${locale}/${slug}.png`;
	}

	// Step 3: site-wide fallback
	return `${origin}/og-image.jpg`;
}
