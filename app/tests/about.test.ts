import { createServer } from "node:net";
import { describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mocks = vi.hoisted(() => {
	const readFile = vi.fn().mockResolvedValue("");
	const renderMdx = vi.fn().mockResolvedValue(() => null);
	return { readFile, renderMdx };
});

vi.mock("node:fs/promises", () => ({
	readFile: mocks.readFile,
}));

vi.mock("#/lib/mdx/renderer.server", () => ({
	renderMdx: mocks.renderMdx,
}));

vi.mock("@tanstack/react-start", () => ({
	createServerFn: () => ({
		inputValidator: () => ({
			handler: (fn: unknown) => fn,
		}),
		handler: (fn: unknown) => fn,
	}),
}));

import { aboutFrontmatterSchema, loadAbout } from "#/lib/mdx/about.server";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const EN_MDX = `---
title: About
locale: en
links:
  - label: GitHub
    url: https://github.com/antoniofulg
    kind: github
---

Bio content.
`;

const PT_BR_MDX = `---
title: Sobre
locale: pt-br
links:
  - label: GitHub
    url: https://github.com/antoniofulg
    kind: github
---

Conteúdo.
`;

// ─── Unit: aboutFrontmatterSchema ─────────────────────────────────────────────

describe("unit: aboutFrontmatterSchema", () => {
	it("parses valid en frontmatter", () => {
		const result = aboutFrontmatterSchema.parse({
			title: "About",
			locale: "en",
			links: [
				{ label: "GitHub", url: "https://github.com/test", kind: "github" },
			],
		});
		expect(result.title).toBe("About");
		expect(result.locale).toBe("en");
		expect(result.links).toHaveLength(1);
	});

	it("parses valid pt-br frontmatter", () => {
		const result = aboutFrontmatterSchema.parse({
			title: "Sobre",
			locale: "pt-br",
		});
		expect(result.locale).toBe("pt-br");
		expect(result.links).toEqual([]);
	});

	it("throws ZodError when title is missing", () => {
		expect(() => aboutFrontmatterSchema.parse({ locale: "en" })).toThrow();
	});

	it("throws ZodError when locale is outside LOCALES enum", () => {
		expect(() =>
			aboutFrontmatterSchema.parse({ title: "About", locale: "de" }),
		).toThrow();
	});

	it("allows omitted links and resolves to empty array", () => {
		const result = aboutFrontmatterSchema.parse({
			title: "About",
			locale: "en",
		});
		expect(result.links).toEqual([]);
	});

	it("throws ZodError when link kind is outside enum", () => {
		expect(() =>
			aboutFrontmatterSchema.parse({
				title: "About",
				locale: "en",
				links: [{ label: "X", url: "https://x.com", kind: "twitter" }],
			}),
		).toThrow();
	});
});

// ─── Unit: loadAbout ──────────────────────────────────────────────────────────

describe("unit: loadAbout", () => {
	it('loadAbout("en") returns en content with no fallbackLocale', async () => {
		mocks.readFile.mockResolvedValue(EN_MDX);
		const result = await loadAbout("en");
		expect(result.locale).toBe("en");
		expect(result.frontmatter.title).toBe("About");
		expect(result.frontmatter.locale).toBe("en");
		expect(result.fallbackLocale).toBeUndefined();
	});

	it('loadAbout("en") html is populated', async () => {
		mocks.readFile.mockResolvedValue(EN_MDX);
		const result = await loadAbout("en");
		expect(typeof result.html).toBe("string");
	});

	it('loadAbout("pt-br") returns pt-br content with no fallbackLocale', async () => {
		mocks.readFile.mockResolvedValue(PT_BR_MDX);
		const result = await loadAbout("pt-br");
		expect(result.locale).toBe("pt-br");
		expect(result.frontmatter.title).toBe("Sobre");
		expect(result.fallbackLocale).toBeUndefined();
	});

	it('loadAbout("pt-br") falls back to en and sets fallbackLocale when pt-br file missing', async () => {
		mocks.readFile.mockImplementation(async (path: unknown) => {
			if ((path as string).includes("pt-br")) {
				throw Object.assign(new Error("ENOENT: no such file"), {
					code: "ENOENT",
				});
			}
			return EN_MDX;
		});
		const result = await loadAbout("pt-br");
		expect(result.locale).toBe("en");
		expect(result.fallbackLocale).toBe("en");
		expect(result.frontmatter.title).toBe("About");
	});

	it("loadAbout throws when en file also missing", async () => {
		mocks.readFile.mockRejectedValue(
			Object.assign(new Error("ENOENT: no such file"), { code: "ENOENT" }),
		);
		await expect(loadAbout("en")).rejects.toThrow("about_load_failed");
	});
});

// ─── Integration helpers ──────────────────────────────────────────────────────

function isPortFree(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const srv = createServer();
		srv.listen(port, () => srv.close(() => resolve(true)));
		srv.on("error", () => resolve(false));
	});
}

const port3000Free = await isPortFree(3000);

// ─── Integration: About route SSR ─────────────────────────────────────────────

describe.skipIf(port3000Free)("integration: About route", () => {
	const BASE_URL = "http://localhost:3000";

	it("GET /about returns 200 with en About content, hreflang pairs, lang=en on article", async () => {
		const res = await fetch(`${BASE_URL}/about`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain('hreflang="en"');
		expect(html).toContain('hreflang="pt-BR"');
		expect(html).toContain('lang="en"');
		expect(html).toContain("Antonio Fulgencio");
	});

	it("GET /pt-br/about returns 200 with pt-br About content", async () => {
		const res = await fetch(`${BASE_URL}/pt-br/about`);
		expect(res.status).toBe(200);
		const html = await res.text();
		expect(html).toContain("Sobre");
	});
});
