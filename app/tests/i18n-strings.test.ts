import { describe, expect, it } from "vitest";
import { strings, uiStringsSchema } from "#/lib/i18n/strings";
import { LOCALES } from "#/lib/locale";

describe("uiStringsSchema — admin namespace", () => {
	describe("sidebar keys", () => {
		it.each(
			LOCALES,
		)("locale %s: sidebar.posts is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.sidebar.posts).toBe("string");
			expect(strings[locale].admin.sidebar.posts.length).toBeGreaterThan(0);
		});

		it.each(
			LOCALES,
		)("locale %s: sidebar.analytics is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.sidebar.analytics).toBe("string");
			expect(strings[locale].admin.sidebar.analytics.length).toBeGreaterThan(0);
		});
	});

	describe("analytics.pageTitle", () => {
		it.each(LOCALES)("locale %s: pageTitle is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.analytics.pageTitle).toBe("string");
			expect(strings[locale].admin.analytics.pageTitle.length).toBeGreaterThan(
				0,
			);
		});
	});

	describe("analytics.summary keys", () => {
		const summaryKeys = [
			"totalVisits",
			"uniquePosts",
			"topReferrer",
			"topLanguage",
		] as const;

		it.each(
			LOCALES,
		)("locale %s: all summary keys are non-empty strings", (locale) => {
			for (const key of summaryKeys) {
				expect(
					typeof strings[locale].admin.analytics.summary[key],
					`summary.${key}`,
				).toBe("string");
				expect(
					strings[locale].admin.analytics.summary[key].length,
					`summary.${key} length`,
				).toBeGreaterThan(0);
			}
		});
	});

	describe("analytics.widgets keys", () => {
		const widgetKeys = [
			"dailyTrend",
			"referrerSources",
			"topPosts",
			"deviceSplit",
		] as const;

		it.each(
			LOCALES,
		)("locale %s: all widget labels are non-empty strings", (locale) => {
			for (const key of widgetKeys) {
				expect(
					typeof strings[locale].admin.analytics.widgets[key],
					`widgets.${key}`,
				).toBe("string");
				expect(
					strings[locale].admin.analytics.widgets[key].length,
					`widgets.${key} length`,
				).toBeGreaterThan(0);
			}
		});
	});

	describe("analytics.range keys (AC-4)", () => {
		const rangeKeys = ["7d", "30d", "90d", "mtd", "ytd", "all"] as const;

		it.each(
			LOCALES,
		)("locale %s: all 6 range-preset keys are non-empty strings", (locale) => {
			for (const key of rangeKeys) {
				expect(
					typeof strings[locale].admin.analytics.range[key],
					`range.${key}`,
				).toBe("string");
				expect(
					strings[locale].admin.analytics.range[key].length,
					`range.${key} length`,
				).toBeGreaterThan(0);
			}
		});
	});

	describe("analytics.filter keys", () => {
		it.each(
			LOCALES,
		)("locale %s: filter.activeChip is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.analytics.filter.activeChip).toBe(
				"string",
			);
			expect(
				strings[locale].admin.analytics.filter.activeChip.length,
			).toBeGreaterThan(0);
		});

		it.each(
			LOCALES,
		)("locale %s: filter.clearAll is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.analytics.filter.clearAll).toBe(
				"string",
			);
			expect(
				strings[locale].admin.analytics.filter.clearAll.length,
			).toBeGreaterThan(0);
		});
	});

	describe("analytics.empty keys", () => {
		it.each(
			LOCALES,
		)("locale %s: empty.awaitingData is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.analytics.empty.awaitingData).toBe(
				"string",
			);
			expect(
				strings[locale].admin.analytics.empty.awaitingData.length,
			).toBeGreaterThan(0);
		});

		it.each(
			LOCALES,
		)("locale %s: empty.awaitingDataDescription is non-empty string", (locale) => {
			expect(
				typeof strings[locale].admin.analytics.empty.awaitingDataDescription,
			).toBe("string");
			expect(
				strings[locale].admin.analytics.empty.awaitingDataDescription.length,
			).toBeGreaterThan(0);
		});
	});

	describe("boot-time Zod parse (AC-2)", () => {
		it.each(
			LOCALES,
		)("locale %s: uiStringsSchema.parse(strings[locale]) does not throw", (locale) => {
			expect(() => uiStringsSchema.parse(strings[locale])).not.toThrow();
		});
	});

	describe("AC-1 spot-checks", () => {
		it("en: sidebar.analytics resolves to non-empty string", () => {
			expect(strings.en.admin.sidebar.analytics).toBeTruthy();
		});

		it("pt-br: sidebar.analytics resolves to non-empty string", () => {
			expect(strings["pt-br"].admin.sidebar.analytics).toBeTruthy();
		});
	});

	describe("AC-5 regression — existing public keys unchanged", () => {
		it("en: localeSwitcher.label still 'English'", () => {
			expect(strings.en.localeSwitcher.label).toBe("English");
		});

		it("pt-br: localeSwitcher.label still 'Português'", () => {
			expect(strings["pt-br"].localeSwitcher.label).toBe("Português");
		});

		it("en: notFound.title still 'Page not found'", () => {
			expect(strings.en.notFound.title).toBe("Page not found");
		});

		it("en: postMeta.publishedOn still 'Published on'", () => {
			expect(strings.en.postMeta.publishedOn).toBe("Published on");
		});

		it("pt-br: notFound.homeCta still '← Posts'", () => {
			expect(strings["pt-br"].notFound.homeCta).toBe("← Posts");
		});
	});
});
