/**
 * Tests for scripts/generate-favicons.ts
 *
 * Unit tests: pure helpers (loadAndResize, encodeIco, detectMimeType, buildFaviconSvg)
 * Integration tests: run `bun run favicons`, inspect generated files
 */

import { execSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

// ─── Paths ────────────────────────────────────────────────────────────────────

const ROOT = path.resolve(__dirname, "../..");
const FIXTURE_SVG = path.join(__dirname, "fixtures/test-favicon.svg");
const PUBLIC = path.join(ROOT, "public");

// ─── Import helpers under test ────────────────────────────────────────────────

import {
	buildFaviconSvg,
	detectMimeType,
	encodeIco,
	loadAndResize,
} from "../../scripts/generate-favicons";

// ─── Unit: loadAndResize ──────────────────────────────────────────────────────

describe("loadAndResize", () => {
	it("returns a Buffer of the requested square dimensions", async () => {
		const buf = await loadAndResize(FIXTURE_SVG, 32);
		// Verify PNG magic bytes
		expect(buf[0]).toBe(0x89);
		expect(buf[1]).toBe(0x50); // P
		expect(buf[2]).toBe(0x4e); // N
		expect(buf[3]).toBe(0x47); // G

		// PNG IHDR width/height at bytes 16/20
		const width = buf.readUInt32BE(16);
		const height = buf.readUInt32BE(20);
		expect(width).toBe(32);
		expect(height).toBe(32);
	});

	it("returns correct dimensions for multiple sizes", async () => {
		for (const size of [16, 48, 180, 192, 512]) {
			const buf = await loadAndResize(FIXTURE_SVG, size);
			const width = buf.readUInt32BE(16);
			const height = buf.readUInt32BE(20);
			expect(width).toBe(size);
			expect(height).toBe(size);
		}
	});

	it("is deterministic — same input produces identical bytes", async () => {
		const [a, b] = await Promise.all([
			loadAndResize(FIXTURE_SVG, 32),
			loadAndResize(FIXTURE_SVG, 32),
		]);
		expect(a).toEqual(b);
	});

	it("throws a descriptive error when the source file is missing", async () => {
		await expect(
			loadAndResize("/nonexistent/path/icon.svg", 32),
		).rejects.toThrow(/Source file not found/);
	});
});

// ─── Unit: encodeIco ─────────────────────────────────────────────────────────

describe("encodeIco", () => {
	it("produces a Buffer with the ICO magic bytes", async () => {
		const png = await loadAndResize(FIXTURE_SVG, 16);
		const ico = encodeIco([png]);
		// ICO magic: 00 00 01 00
		expect(ico[0]).toBe(0x00);
		expect(ico[1]).toBe(0x00);
		expect(ico[2]).toBe(0x01);
		expect(ico[3]).toBe(0x00);
	});

	it("writes the correct image count in the header", async () => {
		const [p16, p32, p48] = await Promise.all([
			loadAndResize(FIXTURE_SVG, 16),
			loadAndResize(FIXTURE_SVG, 32),
			loadAndResize(FIXTURE_SVG, 48),
		]);
		const ico = encodeIco([p16, p32, p48]);
		expect(ico.readUInt16LE(4)).toBe(3);
	});

	it("encodes width and height for each entry", async () => {
		const sizes = [16, 32, 48] as const;
		const pngs = await Promise.all(
			sizes.map((s) => loadAndResize(FIXTURE_SVG, s)),
		);
		const ico = encodeIco(pngs);

		const HEADER = 6;
		const ENTRY = 16;
		for (let i = 0; i < sizes.length; i++) {
			const entryBase = HEADER + i * ENTRY;
			const w = ico.readUInt8(entryBase);
			const h = ico.readUInt8(entryBase + 1);
			expect(w).toBe(sizes[i]);
			expect(h).toBe(sizes[i]);
		}
	});

	it("includes all PNG bytes in the output (total size check)", async () => {
		const [p16, p32] = await Promise.all([
			loadAndResize(FIXTURE_SVG, 16),
			loadAndResize(FIXTURE_SVG, 32),
		]);
		const ico = encodeIco([p16, p32]);
		// Header (6) + 2 entries × 16 (32) + sum of PNG sizes
		const expectedMin = 6 + 2 * 16 + p16.length + p32.length;
		expect(ico.length).toBe(expectedMin);
	});

	it("detects as image/x-icon via detectMimeType", async () => {
		const png = await loadAndResize(FIXTURE_SVG, 16);
		const ico = encodeIco([png]);
		expect(detectMimeType(ico)).toBe("image/x-icon");
	});
});

// ─── Unit: detectMimeType ─────────────────────────────────────────────────────

describe("detectMimeType", () => {
	it("detects PNG", async () => {
		const buf = await loadAndResize(FIXTURE_SVG, 16);
		expect(detectMimeType(buf)).toBe("image/png");
	});

	it("detects SVG", () => {
		const svg = Buffer.from(
			"<svg xmlns='http://www.w3.org/2000/svg'/>",
			"utf-8",
		);
		expect(detectMimeType(svg)).toBe("image/svg+xml");
	});

	it("detects ICO", async () => {
		const png = await loadAndResize(FIXTURE_SVG, 16);
		const ico = encodeIco([png]);
		expect(detectMimeType(ico)).toBe("image/x-icon");
	});

	it("throws on unknown magic bytes", () => {
		const unknown = Buffer.from([0xff, 0xfe, 0xfd, 0xfc]);
		expect(() => detectMimeType(unknown)).toThrow(/Unknown image MIME type/);
	});
});

// ─── Unit: buildFaviconSvg ────────────────────────────────────────────────────

describe("buildFaviconSvg", () => {
	it("returns a string starting with <svg", () => {
		const svg = buildFaviconSvg();
		expect(svg.trim()).toMatch(/^<svg/);
	});

	it("contains prefers-color-scheme media query", () => {
		const svg = buildFaviconSvg();
		expect(svg).toContain("prefers-color-scheme: dark");
	});

	it("contains both light and dark accent colours", () => {
		const svg = buildFaviconSvg();
		expect(svg).toContain("#097098"); // light accent
		expect(svg).toContain("#69C3FF"); // dark accent
	});

	it("is deterministic (same string on every call)", () => {
		expect(buildFaviconSvg()).toBe(buildFaviconSvg());
	});

	it("contains the Terminal icon paths", () => {
		const svg = buildFaviconSvg();
		expect(svg).toContain("polyline");
		expect(svg).toContain("line");
	});

	it("detects as image/svg+xml via detectMimeType", () => {
		const svg = buildFaviconSvg();
		const buf = Buffer.from(svg, "utf-8");
		expect(detectMimeType(buf)).toBe("image/svg+xml");
	});
});

// ─── Integration: bun run favicons ───────────────────────────────────────────

describe("bun run favicons (integration)", () => {
	// Generated file cleanup list — only files we know we're creating.
	// We do NOT clean up before the suite; on a fresh checkout these don't exist.
	const GENERATED = [
		"favicon.ico",
		"favicon.svg",
		"apple-touch-icon.png",
		"icon-192.png",
		"icon-512.png",
	] as const;

	beforeAll(() => {
		// Run the favicons script synchronously (blocks test runner).
		// Timeout 60 s — sharp can take a few seconds on first SVG rasterisation.
		execSync("bun run favicons", {
			cwd: ROOT,
			stdio: "pipe",
			timeout: 60_000,
		});
	});

	afterAll(() => {
		// Re-run to restore generated files; do not delete them — they're committed.
		// (Integration test does not modify committed assets.)
	});

	it("exits 0 and writes all five expected files", () => {
		for (const file of GENERATED) {
			expect(existsSync(path.join(PUBLIC, file))).toBe(true);
		}
	});

	it("favicon.ico has ICO magic bytes", () => {
		const ico = readFileSync(path.join(PUBLIC, "favicon.ico"));
		expect(ico[0]).toBe(0x00);
		expect(ico[1]).toBe(0x00);
		expect(ico[2]).toBe(0x01);
		expect(ico[3]).toBe(0x00);
	});

	it("favicon.ico contains 3 entries (16/32/48 px)", () => {
		const ico = readFileSync(path.join(PUBLIC, "favicon.ico"));
		const count = ico.readUInt16LE(4);
		expect(count).toBe(3);

		const HEADER = 6;
		const ENTRY = 16;
		const expectedSizes = [16, 32, 48];
		for (let i = 0; i < count; i++) {
			const w = ico.readUInt8(HEADER + i * ENTRY);
			const h = ico.readUInt8(HEADER + i * ENTRY + 1);
			expect(w).toBe(expectedSizes[i]);
			expect(h).toBe(expectedSizes[i]);
		}
	});

	it("apple-touch-icon.png is 180×180", () => {
		const buf = readFileSync(path.join(PUBLIC, "apple-touch-icon.png"));
		expect(buf.readUInt32BE(16)).toBe(180);
		expect(buf.readUInt32BE(20)).toBe(180);
	});

	it("icon-192.png is 192×192", () => {
		const buf = readFileSync(path.join(PUBLIC, "icon-192.png"));
		expect(buf.readUInt32BE(16)).toBe(192);
		expect(buf.readUInt32BE(20)).toBe(192);
	});

	it("icon-512.png is 512×512", () => {
		const buf = readFileSync(path.join(PUBLIC, "icon-512.png"));
		expect(buf.readUInt32BE(16)).toBe(512);
		expect(buf.readUInt32BE(20)).toBe(512);
	});

	it("favicon.svg contains prefers-color-scheme media query", () => {
		const svg = readFileSync(path.join(PUBLIC, "favicon.svg"), "utf-8");
		expect(svg).toContain("prefers-color-scheme: dark");
	});

	it("re-running favicons produces byte-identical output (determinism)", () => {
		// Read existing outputs.
		const before = GENERATED.map((f) => readFileSync(path.join(PUBLIC, f)));

		// Run again.
		execSync("bun run favicons", { cwd: ROOT, stdio: "pipe", timeout: 60_000 });

		// Compare byte-for-byte.
		const after = GENERATED.map((f) => readFileSync(path.join(PUBLIC, f)));
		for (let i = 0; i < GENERATED.length; i++) {
			expect(after[i]).toEqual(before[i]);
		}
	});
});

// ─── Integration: og-image.jpg ───────────────────────────────────────────────

describe("og-image.jpg", () => {
	it("exists and is under 300 KB", () => {
		const ogPath = path.join(PUBLIC, "og-image.jpg");
		expect(existsSync(ogPath), "og-image.jpg must exist in public/").toBe(true);
		const { size } = statSync(ogPath);
		expect(size, `og-image.jpg is ${size} bytes (max 307200)`).toBeLessThan(
			300 * 1024,
		);
	});

	it("has JPEG magic bytes (FFD8FF)", () => {
		const ogPath = path.join(PUBLIC, "og-image.jpg");
		const buf = readFileSync(ogPath);
		expect(buf[0]).toBe(0xff);
		expect(buf[1]).toBe(0xd8);
		expect(buf[2]).toBe(0xff);
	});
});
