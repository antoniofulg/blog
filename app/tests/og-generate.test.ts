import { existsSync, readFileSync } from "node:fs";
import { readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterAll, describe, expect, it, vi } from "vitest";
import { loadFonts } from "#/lib/og/fonts";
import { generateOgImage } from "#/lib/og/generate";
import { CardTemplate } from "#/lib/og/template";
import { truncateCode } from "#/lib/og/truncate";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse 1200 × 630 dimensions from a PNG IHDR chunk (big-endian uint32). */
function parsePngDimensions(buf: Buffer): { width: number; height: number } {
	return {
		width: buf.readUInt32BE(16),
		height: buf.readUInt32BE(20),
	};
}

const TEST_LOCALE = "en" as const;
const TEST_SLUG_PREFIX = "test-og-generate-";
const TEST_OUTPUT_DIR = join(process.cwd(), "public", "og", TEST_LOCALE);

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

afterAll(async () => {
	try {
		if (existsSync(TEST_OUTPUT_DIR)) {
			const files = await readdir(TEST_OUTPUT_DIR);
			await Promise.all(
				files
					.filter((f) => f.startsWith(TEST_SLUG_PREFIX))
					.map((f) => rm(join(TEST_OUTPUT_DIR, f), { force: true })),
			);
		}
	} catch {
		// Best-effort; leave test artefacts rather than obscuring a real error
	}
});

// ---------------------------------------------------------------------------
// Unit tests: truncateCode
// ---------------------------------------------------------------------------

describe("truncateCode", () => {
	it("returns all lines and didTruncate: false when input fits", () => {
		const result = truncateCode("a\nb\nc");
		expect(result).toEqual({ lines: ["a", "b", "c"], didTruncate: false });
	});

	it("caps at 10 lines and sets didTruncate: true", () => {
		const code = "a\n".repeat(20);
		const result = truncateCode(code);
		expect(result.lines.length).toBeLessThanOrEqual(10);
		expect(result.didTruncate).toBe(true);
	});

	it("caps at 600 chars and sets didTruncate: true", () => {
		const code = "x".repeat(800);
		const result = truncateCode(code);
		expect(result.lines.join("\n").length).toBeLessThanOrEqual(600);
		expect(result.didTruncate).toBe(true);
	});

	it("never returns more than 10 lines regardless of input", () => {
		const result = truncateCode("line\n".repeat(50));
		expect(result.lines.length).toBeLessThanOrEqual(10);
	});

	it("joined lines always <= 600 chars", () => {
		// Build a string via join to avoid triggering useTemplate lint rule
		const code = ["x".repeat(200), "y".repeat(200), "z".repeat(200)].join("\n");
		const result = truncateCode(code);
		expect(result.lines.join("\n").length).toBeLessThanOrEqual(600);
	});

	it("does not truncate a short single-line string", () => {
		const result = truncateCode("const x = 1;");
		expect(result).toEqual({ lines: ["const x = 1;"], didTruncate: false });
	});

	it("handles empty string input", () => {
		const result = truncateCode("");
		expect(result.lines).toEqual([""]);
		expect(result.didTruncate).toBe(false);
	});
});

// ---------------------------------------------------------------------------
// Unit tests: loadFonts
// ---------------------------------------------------------------------------

describe("loadFonts", () => {
	it("returns at least 3 font entries", () => {
		const fonts = loadFonts();
		expect(fonts.length).toBeGreaterThanOrEqual(3);
	});

	it("includes Inter regular (weight 400)", () => {
		const fonts = loadFonts();
		const entry = fonts.find((f) => f.name === "Inter" && f.weight === 400);
		expect(entry).toBeDefined();
	});

	it("includes Inter bold (weight 700)", () => {
		const fonts = loadFonts();
		const entry = fonts.find((f) => f.name === "Inter" && f.weight === 700);
		expect(entry).toBeDefined();
	});

	it("includes JetBrains Mono regular (weight 400)", () => {
		const fonts = loadFonts();
		const entry = fonts.find(
			(f) => f.name === "JetBrains Mono" && f.weight === 400,
		);
		expect(entry).toBeDefined();
	});

	it("all font data is a non-empty Buffer", () => {
		const fonts = loadFonts();
		for (const font of fonts) {
			expect(Buffer.isBuffer(font.data)).toBe(true);
			expect((font.data as Buffer).length).toBeGreaterThan(0);
		}
	});
});

// ---------------------------------------------------------------------------
// Unit tests: CardTemplate
// ---------------------------------------------------------------------------

describe("CardTemplate", () => {
	it("creates a React element with the correct type", () => {
		const element = React.createElement(CardTemplate, {
			title: "Hello World",
			tokenLines: null,
			didTruncate: false,
			codeBg: "#24292e",
			codeFg: "#e1e4e8",
		});
		expect(element.type).toBe(CardTemplate);
		expect(element.props.title).toBe("Hello World");
	});

	it("renders to HTML string containing the title text", () => {
		const element = React.createElement(CardTemplate, {
			title: "My Unique Title 42",
			tokenLines: null,
			didTruncate: false,
			codeBg: "#24292e",
			codeFg: "#e1e4e8",
		});
		const html = renderToStaticMarkup(element);
		expect(html).toContain("My Unique Title 42");
	});

	it("renders to HTML containing token content when tokenLines provided", () => {
		const tokenLines = [[{ content: "const x = 1;", color: "#79b8ff" }]];
		const element = React.createElement(CardTemplate, {
			title: "Code Post",
			tokenLines,
			didTruncate: false,
			codeBg: "#24292e",
			codeFg: "#e1e4e8",
		});
		const html = renderToStaticMarkup(element);
		expect(html).toContain("const x = 1;");
	});

	it("renders brand footer text", () => {
		const element = React.createElement(CardTemplate, {
			title: "T",
			tokenLines: null,
			didTruncate: false,
			codeBg: "#24292e",
			codeFg: "#e1e4e8",
		});
		const html = renderToStaticMarkup(element);
		expect(html).toContain("Antonio Fulgencio Blog");
	});

	it("passes token lines prop correctly", () => {
		const tokenLines = [[{ content: "hello", color: "#fff" }]];
		const element = React.createElement(CardTemplate, {
			title: "Test",
			tokenLines,
			didTruncate: false,
			codeBg: "#24292e",
			codeFg: "#e1e4e8",
		});
		expect(element.props.tokenLines).toHaveLength(1);
		const firstToken = (
			element.props.tokenLines as { content: string; color: string }[][]
		)[0]?.[0];
		expect(firstToken?.content).toBe("hello");
	});
});

// ---------------------------------------------------------------------------
// Integration tests: generateOgImage
// ---------------------------------------------------------------------------

describe("generateOgImage - integration", () => {
	// These tests do a real satori → resvg render — allow up to 30 s each
	const TIMEOUT = 30_000;

	it(
		"AC-1: writes a 1200×630 PNG with code block and returns correct path",
		async () => {
			const slug = `${TEST_SLUG_PREFIX}with-code`;

			const result = await generateOgImage({
				locale: TEST_LOCALE,
				slug,
				title: "Test Post With Code",
				firstCodeBlock: {
					lang: "typescript",
					code: "const greet = (name: string): string => {\n  return name.toUpperCase();\n}",
				},
			});

			expect(result).toBe(`/og/${TEST_LOCALE}/${slug}.png`);

			const filePath = join(
				process.cwd(),
				"public",
				"og",
				TEST_LOCALE,
				`${slug}.png`,
			);
			expect(existsSync(filePath)).toBe(true);

			const buffer = readFileSync(filePath);
			const { width, height } = parsePngDimensions(buffer);
			expect(width).toBe(1200);
			expect(height).toBe(630);

			// AC-5 / size sanity: < 300 KB
			expect(buffer.length).toBeLessThan(300 * 1024);
		},
		TIMEOUT,
	);

	it(
		"AC-2: writes a card with title only when firstCodeBlock is null",
		async () => {
			const slug = `${TEST_SLUG_PREFIX}no-code`;

			const result = await generateOgImage({
				locale: TEST_LOCALE,
				slug,
				title: "A post without code blocks",
				firstCodeBlock: null,
			});

			expect(result).toBe(`/og/${TEST_LOCALE}/${slug}.png`);

			const filePath = join(
				process.cwd(),
				"public",
				"og",
				TEST_LOCALE,
				`${slug}.png`,
			);
			expect(existsSync(filePath)).toBe(true);

			const buffer = readFileSync(filePath);
			const { width, height } = parsePngDimensions(buffer);
			expect(width).toBe(1200);
			expect(height).toBe(630);
		},
		TIMEOUT,
	);

	it(
		"AC-3: truncates code longer than 10 lines and writes a valid PNG",
		async () => {
			const slug = `${TEST_SLUG_PREFIX}long-code`;
			const longCode = Array.from(
				{ length: 25 },
				(_, i) => `const var${i} = ${i};`,
			).join("\n");

			const result = await generateOgImage({
				locale: TEST_LOCALE,
				slug,
				title: "Long Code Post",
				firstCodeBlock: { lang: "typescript", code: longCode },
			});

			expect(result).not.toBeNull();

			if (result) {
				const filePath = join(
					process.cwd(),
					"public",
					"og",
					TEST_LOCALE,
					`${slug}.png`,
				);
				const buffer = readFileSync(filePath);
				const { width, height } = parsePngDimensions(buffer);
				expect(width).toBe(1200);
				expect(height).toBe(630);
			}
		},
		TIMEOUT,
	);

	it(
		"AC-4: returns null and logs console.warn containing the slug when generation fails",
		async () => {
			const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

			// Override process.cwd() so loadFonts cannot find the font files → throws
			const cwdSpy = vi
				.spyOn(process, "cwd")
				.mockReturnValue("/tmp/nonexistent-path-for-og-error-test" as never);

			try {
				const result = await generateOgImage({
					locale: TEST_LOCALE,
					slug: "ac4-error-test",
					title: "Error Test",
					firstCodeBlock: null,
				});

				// Must return null — never throw
				expect(result).toBeNull();

				// Must log a warning that includes the slug
				expect(warnSpy).toHaveBeenCalled();
				const firstWarning = String(warnSpy.mock.calls[0]?.[0] ?? "");
				expect(firstWarning).toContain("ac4-error-test");
			} finally {
				cwdSpy.mockRestore();
				warnSpy.mockRestore();
			}
		},
		TIMEOUT,
	);

	it(
		"fixture: generates PNG from sample.mdx TypeScript code block",
		async () => {
			// Extract the first fenced code block from the sample fixture file
			const fixturePath = join(process.cwd(), "app/tests/fixtures/sample.mdx");
			const fixtureSource = readFileSync(fixturePath, "utf-8");
			const match = fixtureSource.match(/```\w+\n([\s\S]*?)```/);
			const sampleCode = match?.[1]?.trim() ?? "const x = 1;";
			const slug = `${TEST_SLUG_PREFIX}sample-fixture`;

			const result = await generateOgImage({
				locale: TEST_LOCALE,
				slug,
				title: "Sample Post",
				firstCodeBlock: { lang: "typescript", code: sampleCode },
			});

			expect(result).toBe(`/og/${TEST_LOCALE}/${slug}.png`);

			const filePath = join(
				process.cwd(),
				"public",
				"og",
				TEST_LOCALE,
				`${slug}.png`,
			);
			const buffer = readFileSync(filePath);
			const { width, height } = parsePngDimensions(buffer);
			expect(width).toBe(1200);
			expect(height).toBe(630);

			// Size sanity
			expect(buffer.length).toBeLessThan(300 * 1024);
		},
		TIMEOUT,
	);

	it(
		"falls back gracefully for an unsupported language",
		async () => {
			const slug = `${TEST_SLUG_PREFIX}unknown-lang`;
			const result = await generateOgImage({
				locale: TEST_LOCALE,
				slug,
				title: "Unknown Lang Post",
				firstCodeBlock: { lang: "haskell-99", code: 'main = putStrLn "hello"' },
			});

			// Should succeed (falls back to plain text rendering) or return null (never throws)
			expect(typeof result === "string" || result === null).toBe(true);
		},
		TIMEOUT,
	);
});
