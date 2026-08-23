import { describe, expect, test } from "bun:test";
import { strings, uiStringsSchema } from "#/lib/i18n/strings";

// ─── unit: schema validation ─────────────────────────────────────────────────

describe("unit: uiStringsSchema validation success", () => {
	test("parses en strings unchanged", () => {
		const result = uiStringsSchema.parse(strings.en);
		expect(result).toEqual(strings.en);
	});

	test("parses pt-br strings unchanged", () => {
		const result = uiStringsSchema.parse(strings["pt-br"]);
		expect(result).toEqual(strings["pt-br"]);
	});
});

describe("unit: uiStringsSchema validation failure", () => {
	test("throws ZodError for empty object (missing localeSwitcher)", () => {
		expect(() => uiStringsSchema.parse({})).toThrow();
	});

	test("throws ZodError when postMeta is missing", () => {
		expect(() =>
			uiStringsSchema.parse({ localeSwitcher: { label: "English" } }),
		).toThrow();
	});

	test("throws ZodError when notFound.title is missing", () => {
		expect(() =>
			uiStringsSchema.parse({
				localeSwitcher: { label: "English" },
				postMeta: { publishedOn: "Published on", readingTime: "min read" },
				notFound: {},
			}),
		).toThrow();
	});
});

// ─── unit: value contracts ───────────────────────────────────────────────────

describe("unit: value contracts", () => {
	test('strings.en.localeSwitcher.label === "English"', () => {
		expect(strings.en.localeSwitcher.label).toBe("English");
	});

	test('strings["pt-br"].localeSwitcher.label === "Português"', () => {
		expect(strings["pt-br"].localeSwitcher.label).toBe("Português");
	});
});

// ─── integration: module load ─────────────────────────────────────────────────

describe("integration: module load does not throw", () => {
	test("importing strings module succeeds without throwing", async () => {
		await expect(import("#/lib/i18n/strings")).resolves.toBeDefined();
	});
});
