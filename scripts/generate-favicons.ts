#!/usr/bin/env bun
/**
 * Favicon generator — reads app/assets/favicon-source.svg and emits the full
 * favicon set to public/.  Run via `bun run favicons`.
 *
 * Also generates public/og-image.jpg (1200×630 optimised JPEG) from the
 * profile photo at public/about/profile.jpeg when --og flag is passed.
 *
 * Design notes
 * ─────────────
 * - ICO format: each entry is an embedded PNG (modern ICO; supported in Chrome,
 *   Firefox, Edge, Safari, IE9+).  No third-party ico-endec dep needed.
 * - Determinism: sharp PNG uses compressionLevel 9 + adaptiveFiltering false so
 *   the same source produces byte-identical output across runs.
 * - Fallback: if sharp install fails, regenerate via realfavicongenerator.net
 *   using app/assets/favicon-source.svg as the upload source.
 */

import { existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SOURCE_SVG = path.join(ROOT, "app/assets/favicon-source.svg");
const PUBLIC = path.join(ROOT, "public");
const PROFILE_JPEG = path.join(PUBLIC, "about/profile.jpeg");

// ─── Public helpers (exported for unit tests) ────────────────────────────────

export type ImageMimeType = "image/x-icon" | "image/svg+xml" | "image/png";

/**
 * Resize a source image (SVG or raster) to a square PNG buffer at the given
 * dimension.  Pure function — same input + size → same output bytes when sharp
 * PNG options are fixed.
 *
 * @throws Error when the source file is missing or unreadable.
 */
export async function loadAndResize(src: string, size: number): Promise<Buffer> {
	if (!existsSync(src)) {
		throw new Error(`[favicons] Source file not found: ${src}`);
	}
	// Dynamic import keeps sharp out of the module-evaluation path so tests
	// that mock the fs layer can import the helpers without loading sharp.
	const sharp = (await import("sharp")).default;
	return (
		sharp(src)
			.resize(size, size)
			// Fixed options ensure byte-identical output on repeated runs.
			.png({ compressionLevel: 9, adaptiveFiltering: false })
			.toBuffer()
	);
}

/**
 * Encode a list of PNG buffers into a single multi-resolution ICO file.
 * Each entry is stored as an embedded PNG (modern ICO format).
 *
 * ICO layout:
 *   ICONDIR header  — 6 bytes
 *   ICONDIRENTRY[]  — 16 bytes × N
 *   PNG data[]      — variable
 */
export function encodeIco(pngBuffers: Buffer[]): Buffer {
	const count = pngBuffers.length;
	const HEADER_SIZE = 6;
	const ENTRY_SIZE = 16; // bytes per directory entry

	// Pre-compute the file offset of each image's raw PNG data.
	const dirEnd = HEADER_SIZE + count * ENTRY_SIZE;
	const offsets: number[] = [];
	let cursor = dirEnd;
	for (const buf of pngBuffers) {
		offsets.push(cursor);
		cursor += buf.length;
	}

	const out = Buffer.alloc(cursor);

	// ── ICONDIR header ────────────────────────────────────────────────────────
	out.writeUInt16LE(0, 0); // reserved
	out.writeUInt16LE(1, 2); // type: 1 = ICO
	out.writeUInt16LE(count, 4); // image count

	// ── Directory entries + image data ────────────────────────────────────────
	for (let i = 0; i < count; i++) {
		const buf = pngBuffers[i];
		const entryOffset = HEADER_SIZE + i * ENTRY_SIZE;

		// Read dimensions from the PNG IHDR chunk.
		// PNG layout: 8-byte signature + 4-byte chunk-length + 4-byte "IHDR" +
		//             4-byte width (BE) + 4-byte height (BE) = width at byte 16.
		const width = buf.readUInt32BE(16);
		const height = buf.readUInt32BE(20);

		// ICO width/height fields are 1 byte; 0 means 256.
		out.writeUInt8(width >= 256 ? 0 : width, entryOffset);
		out.writeUInt8(height >= 256 ? 0 : height, entryOffset + 1);
		out.writeUInt8(0, entryOffset + 2); // colour count (0 = not palettised)
		out.writeUInt8(0, entryOffset + 3); // reserved
		out.writeUInt16LE(1, entryOffset + 4); // planes
		out.writeUInt16LE(32, entryOffset + 6); // bits per pixel (32bpp RGBA PNG)
		out.writeUInt32LE(buf.length, entryOffset + 8); // size of image data
		out.writeUInt32LE(offsets[i], entryOffset + 12); // offset from file start

		buf.copy(out, offsets[i]);
	}

	return out;
}

/**
 * Detect the MIME type of an image Buffer from its magic bytes.
 */
export function detectMimeType(buf: Buffer): ImageMimeType {
	// PNG: 89 50 4E 47
	if (
		buf[0] === 0x89 &&
		buf[1] === 0x50 &&
		buf[2] === 0x4e &&
		buf[3] === 0x47
	) {
		return "image/png";
	}
	// ICO: 00 00 01 00
	if (
		buf[0] === 0x00 &&
		buf[1] === 0x00 &&
		buf[2] === 0x01 &&
		buf[3] === 0x00
	) {
		return "image/x-icon";
	}
	// SVG: starts with '<' (XML)
	if (buf[0] === 0x3c) {
		return "image/svg+xml";
	}
	throw new Error(`[favicons] Unknown image MIME type (first byte: 0x${buf[0].toString(16)})`);
}

/**
 * Build the deployed favicon.svg content — identical Terminal icon with a
 * prefers-color-scheme media query so the SVG adapts to the OS colour scheme.
 *
 * Light: teal (#097098) bg, white icon.
 * Dark:  sky (#69C3FF) bg, dark (#1C2433) icon.
 */
export function buildFaviconSvg(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">
  <style>
    .bg  { fill: #097098; }
    .ico { fill: none; stroke: #ffffff; stroke-width: 2.5; stroke-linecap: round; stroke-linejoin: round; }
    @media (prefers-color-scheme: dark) {
      .bg  { fill: #69C3FF; }
      .ico { stroke: #1C2433; }
    }
  </style>
  <rect class="bg" width="24" height="24" rx="4"/>
  <g class="ico">
    <polyline points="5 18 11 12 5 6"/>
    <line x1="13" x2="19" y1="18" y2="18"/>
  </g>
</svg>`;
}

// ─── OG fallback image ───────────────────────────────────────────────────────

/**
 * Generate public/og-image.jpg (1200×630, <300 KB) from the profile photo.
 * Uses a centre-crop to fill the 1200×630 frame.
 */
async function generateOgImage(src: string, dest: string): Promise<void> {
	if (!existsSync(src)) {
		throw new Error(`[favicons] Profile photo not found: ${src}`);
	}
	const sharp = (await import("sharp")).default;
	await sharp(src)
		.resize(1200, 630, { fit: "cover", position: "top" })
		.jpeg({ quality: 85, progressive: true })
		.toFile(dest);
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
	const args = process.argv.slice(2);
	const withOg = args.includes("--og") || args.includes("--all");

	// Verify the source SVG exists before kicking off any generation.
	if (!existsSync(SOURCE_SVG)) {
		throw new Error(
			`[favicons] Source SVG not found at ${SOURCE_SVG}\n` +
				"  Create app/assets/favicon-source.svg and re-run `bun run favicons`.",
		);
	}

	console.log("[favicons] Generating favicon set from", SOURCE_SVG);

	// ── Rasterise to PNG at all required sizes (parallel) ────────────────────
	const [png16, png32, png48, png180, png192, png512] = await Promise.all([
		loadAndResize(SOURCE_SVG, 16),
		loadAndResize(SOURCE_SVG, 32),
		loadAndResize(SOURCE_SVG, 48),
		loadAndResize(SOURCE_SVG, 180),
		loadAndResize(SOURCE_SVG, 192),
		loadAndResize(SOURCE_SVG, 512),
	]);

	// ── Write outputs ─────────────────────────────────────────────────────────
	const ico = encodeIco([png16, png32, png48]);
	writeFileSync(path.join(PUBLIC, "favicon.ico"), ico);
	console.log("  ✓  favicon.ico  (16/32/48 px)");

	writeFileSync(path.join(PUBLIC, "favicon.svg"), buildFaviconSvg(), "utf-8");
	console.log("  ✓  favicon.svg  (light + dark variants)");

	writeFileSync(path.join(PUBLIC, "apple-touch-icon.png"), png180);
	console.log("  ✓  apple-touch-icon.png  (180 px)");

	writeFileSync(path.join(PUBLIC, "icon-192.png"), png192);
	console.log("  ✓  icon-192.png  (192 px)");

	writeFileSync(path.join(PUBLIC, "icon-512.png"), png512);
	console.log("  ✓  icon-512.png  (512 px)");

	if (withOg) {
		const ogDest = path.join(PUBLIC, "og-image.jpg");
		await generateOgImage(PROFILE_JPEG, ogDest);
		const { size } = (await import("node:fs")).statSync(ogDest);
		console.log(
			`  ✓  og-image.jpg  (1200×630, ${Math.round(size / 1024)} KB)`,
		);
	}

	console.log("[favicons] Done.");
}

main().catch((err: Error) => {
	console.error("[favicons] Fatal:", err.message);
	process.exit(1);
});
