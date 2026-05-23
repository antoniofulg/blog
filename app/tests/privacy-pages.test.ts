/**
 * Tests for bilingual /privacy MDX pages.
 * Covers: frontmatter validity and required topic markers in en + pt-br.
 *
 * Footer Privacy link render tests live in footer.test.ts (jsdom environment).
 */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function readPrivacyMdx(locale: "en" | "pt-br"): Promise<string> {
	const filePath = join(
		process.cwd(),
		"app",
		"content",
		"pages",
		locale,
		"privacy.mdx",
	);
	return readFile(filePath, "utf-8");
}

function parseFrontmatter(raw: string): Record<string, string> {
	const match = raw.match(/^---\n([\s\S]*?)\n---/);
	if (!match) return {};
	const block = match[1];
	const result: Record<string, string> = {};
	for (const line of block.split("\n")) {
		const colonIdx = line.indexOf(":");
		if (colonIdx === -1) continue;
		const key = line.slice(0, colonIdx).trim();
		const value = line.slice(colonIdx + 1).trim();
		result[key] = value;
	}
	return result;
}

// ─── en/privacy.mdx — frontmatter ────────────────────────────────────────────

describe("unit: en/privacy.mdx frontmatter", () => {
	it("file exists and is readable", async () => {
		const content = await readPrivacyMdx("en");
		expect(content.length).toBeGreaterThan(0);
	});

	it("starts with frontmatter delimiter", async () => {
		const content = await readPrivacyMdx("en");
		expect(content.startsWith("---")).toBe(true);
	});

	it("has non-empty title field", async () => {
		const content = await readPrivacyMdx("en");
		const fm = parseFrontmatter(content);
		expect(typeof fm.title).toBe("string");
		expect(fm.title.length).toBeGreaterThan(0);
	});

	it("has description field", async () => {
		const content = await readPrivacyMdx("en");
		const fm = parseFrontmatter(content);
		expect(typeof fm.description).toBe("string");
		expect(fm.description.length).toBeGreaterThan(0);
	});
});

// ─── en/privacy.mdx — required topic markers ─────────────────────────────────

describe("unit: en/privacy.mdx required topic markers", () => {
	it("mentions cookieless tracking", async () => {
		const content = await readPrivacyMdx("en");
		expect(content.toLowerCase()).toContain("cookieless");
	});

	it("mentions no IP storage", async () => {
		const content = await readPrivacyMdx("en");
		const lower = content.toLowerCase();
		expect(lower.includes("no ip") || lower.includes("ip address")).toBe(true);
	});

	it("mentions bot filtering", async () => {
		const content = await readPrivacyMdx("en");
		expect(content.toLowerCase()).toContain("bot");
	});

	it("mentions no cookies", async () => {
		const content = await readPrivacyMdx("en");
		expect(content.toLowerCase()).toContain("no cookies");
	});

	it("mentions fingerprint", async () => {
		const content = await readPrivacyMdx("en");
		expect(content.toLowerCase()).toContain("fingerprint");
	});

	it("mentions public view counter behavior", async () => {
		const content = await readPrivacyMdx("en");
		const lower = content.toLowerCase();
		expect(
			lower.includes("public counter") ||
				lower.includes("view counter") ||
				lower.includes("public view") ||
				lower.includes("public count"),
		).toBe(true);
	});
});

// ─── pt-br/privacy.mdx — frontmatter ─────────────────────────────────────────

describe("unit: pt-br/privacy.mdx frontmatter", () => {
	it("file exists and is readable", async () => {
		const content = await readPrivacyMdx("pt-br");
		expect(content.length).toBeGreaterThan(0);
	});

	it("starts with frontmatter delimiter", async () => {
		const content = await readPrivacyMdx("pt-br");
		expect(content.startsWith("---")).toBe(true);
	});

	it("has non-empty title field", async () => {
		const content = await readPrivacyMdx("pt-br");
		const fm = parseFrontmatter(content);
		expect(typeof fm.title).toBe("string");
		expect(fm.title.length).toBeGreaterThan(0);
	});

	it("has description field", async () => {
		const content = await readPrivacyMdx("pt-br");
		const fm = parseFrontmatter(content);
		expect(typeof fm.description).toBe("string");
		expect(fm.description.length).toBeGreaterThan(0);
	});
});

// ─── pt-br/privacy.mdx — required topic markers ──────────────────────────────

describe("unit: pt-br/privacy.mdx required topic markers", () => {
	it("mentions cookieless or sem cookies", async () => {
		const content = await readPrivacyMdx("pt-br");
		const lower = content.toLowerCase();
		expect(lower.includes("cookieless") || lower.includes("sem cookies")).toBe(
			true,
		);
	});

	it("mentions IP address", async () => {
		const content = await readPrivacyMdx("pt-br");
		const lower = content.toLowerCase();
		expect(
			lower.includes("endereço ip") ||
				lower.includes("ip address") ||
				lower.includes("ip não"),
		).toBe(true);
	});

	it("mentions bot filtering", async () => {
		const content = await readPrivacyMdx("pt-br");
		expect(content.toLowerCase()).toContain("bot");
	});

	it("mentions no cookies (sem cookies)", async () => {
		const content = await readPrivacyMdx("pt-br");
		const lower = content.toLowerCase();
		expect(lower.includes("sem cookies") || lower.includes("no cookies")).toBe(
			true,
		);
	});

	it("mentions fingerprint", async () => {
		const content = await readPrivacyMdx("pt-br");
		expect(content.toLowerCase()).toContain("fingerprint");
	});

	it("mentions public view counter behavior", async () => {
		const content = await readPrivacyMdx("pt-br");
		const lower = content.toLowerCase();
		expect(
			lower.includes("contador público") ||
				lower.includes("contador public") ||
				lower.includes("public counter") ||
				lower.includes("visualizações"),
		).toBe(true);
	});
});

// ─── Translation parity ───────────────────────────────────────────────────────

describe("unit: privacy.mdx translation parity", () => {
	it("both files exist (en and pt-br)", async () => {
		const [en, ptbr] = await Promise.all([
			readPrivacyMdx("en"),
			readPrivacyMdx("pt-br"),
		]);
		expect(en.length).toBeGreaterThan(0);
		expect(ptbr.length).toBeGreaterThan(0);
	});

	it("both files have a non-empty title", async () => {
		const [en, ptbr] = await Promise.all([
			readPrivacyMdx("en"),
			readPrivacyMdx("pt-br"),
		]);
		const fmEn = parseFrontmatter(en);
		const fmPtBr = parseFrontmatter(ptbr);
		expect(fmEn.title.length).toBeGreaterThan(0);
		expect(fmPtBr.title.length).toBeGreaterThan(0);
	});
});
