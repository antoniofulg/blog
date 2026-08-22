import { describe, expect, test } from "bun:test";
import { strings, uiStringsSchema } from "#/lib/i18n/strings";
import { LOCALES } from "#/lib/locale";

const localeRows = LOCALES.map((locale) => [locale] as [typeof locale]);

describe("uiStringsSchema — postShare namespace", () => {
	const chipKeys = [
		"twitter",
		"linkedin",
		"reddit",
		"whatsapp",
		"email",
		"copy",
	] as const;
	const chipRows = chipKeys.map((key) => [key] as [typeof key]);

	describe("chips — exactly 6 keys in both locales", () => {
		test("en: postShare.chips has exactly 6 keys (sorted)", () => {
			const keys = Object.keys(strings.en.postShare.chips).sort();
			expect(keys).toEqual([
				"copy",
				"email",
				"linkedin",
				"reddit",
				"twitter",
				"whatsapp",
			]);
		});

		test("pt-br: postShare.chips has exactly 6 keys (sorted)", () => {
			const keys = Object.keys(strings["pt-br"].postShare.chips).sort();
			expect(keys).toEqual([
				"copy",
				"email",
				"linkedin",
				"reddit",
				"twitter",
				"whatsapp",
			]);
		});

		test.each(
			localeRows,
		)("locale %s: all 6 chip keys are non-empty strings", (locale) => {
			for (const key of chipKeys) {
				expect(
					typeof strings[locale].postShare.chips[key],
					`chips.${key}`,
				).toBe("string");
				expect(
					strings[locale].postShare.chips[key].length,
					`chips.${key} length`,
				).toBeGreaterThan(0);
			}
		});
	});

	describe("AC-1 spot-checks — linkedin in both locales", () => {
		test("en: chips.linkedin is non-empty string", () => {
			expect(strings.en.postShare.chips.linkedin.length).toBeGreaterThan(0);
		});
		test("pt-br: chips.linkedin is non-empty string", () => {
			expect(strings["pt-br"].postShare.chips.linkedin.length).toBeGreaterThan(
				0,
			);
		});
	});

	describe("AC-2 — copied in both locales", () => {
		test("en: copied resolves to non-empty string", () => {
			expect(strings.en.postShare.copied.length).toBeGreaterThan(0);
		});
		test("pt-br: copied resolves to non-empty string (e.g. Copiado!)", () => {
			expect(strings["pt-br"].postShare.copied.length).toBeGreaterThan(0);
		});
	});

	describe("AC-3 — all 6 chip keys per locale", () => {
		test.each(chipRows)("en: chips.%s exists", (key) => {
			expect(strings.en.postShare.chips[key]).toBeTruthy();
		});

		test.each(chipRows)("pt-br: chips.%s exists", (key) => {
			expect(strings["pt-br"].postShare.chips[key]).toBeTruthy();
		});
	});

	describe("value spot-checks — en locale", () => {
		test("en: chips.twitter resolves to 'X' (X rebrand label)", () => {
			expect(strings.en.postShare.chips.twitter).toBe("X");
		});
		test("en: chips.linkedin resolves to 'LinkedIn'", () => {
			expect(strings.en.postShare.chips.linkedin).toBe("LinkedIn");
		});
		test("en: chips.reddit resolves to 'Reddit'", () => {
			expect(strings.en.postShare.chips.reddit).toBe("Reddit");
		});
		test("en: chips.whatsapp resolves to 'WhatsApp'", () => {
			expect(strings.en.postShare.chips.whatsapp).toBe("WhatsApp");
		});
		test("en: chips.email resolves to 'Email'", () => {
			expect(strings.en.postShare.chips.email).toBe("Email");
		});
		test("en: chips.copy resolves to 'Copy link'", () => {
			expect(strings.en.postShare.chips.copy).toBe("Copy link");
		});
		test("en: copied resolves to 'Copied!'", () => {
			expect(strings.en.postShare.copied).toBe("Copied!");
		});
		test("en: share resolves to 'Share'", () => {
			expect(strings.en.postShare.share).toBe("Share");
		});
	});

	describe("value spot-checks — pt-br locale", () => {
		test("pt-br: chips.twitter resolves to 'X' (brand name — no translation)", () => {
			expect(strings["pt-br"].postShare.chips.twitter).toBe("X");
		});
		test("pt-br: chips.linkedin resolves to 'LinkedIn' (brand name — no translation)", () => {
			expect(strings["pt-br"].postShare.chips.linkedin).toBe("LinkedIn");
		});
		test("pt-br: chips.whatsapp resolves to 'WhatsApp' (brand name — no translation)", () => {
			expect(strings["pt-br"].postShare.chips.whatsapp).toBe("WhatsApp");
		});
		test("pt-br: chips.email resolves to 'E-mail' (translated generic term)", () => {
			expect(strings["pt-br"].postShare.chips.email).toBe("E-mail");
		});
		test("pt-br: chips.copy resolves to 'Copiar link' (translated generic term)", () => {
			expect(strings["pt-br"].postShare.chips.copy).toBe("Copiar link");
		});
		test("pt-br: copied resolves to 'Copiado!'", () => {
			expect(strings["pt-br"].postShare.copied).toBe("Copiado!");
		});
		test("pt-br: share resolves to 'Compartilhar'", () => {
			expect(strings["pt-br"].postShare.share).toBe("Compartilhar");
		});
	});

	describe("brand-name keys — identical values across locales", () => {
		test("chips.linkedin is the same in en and pt-br", () => {
			expect(strings.en.postShare.chips.linkedin).toBe(
				strings["pt-br"].postShare.chips.linkedin,
			);
		});
		test("chips.whatsapp is the same in en and pt-br", () => {
			expect(strings.en.postShare.chips.whatsapp).toBe(
				strings["pt-br"].postShare.chips.whatsapp,
			);
		});
		test("chips.twitter is the same in en and pt-br", () => {
			expect(strings.en.postShare.chips.twitter).toBe(
				strings["pt-br"].postShare.chips.twitter,
			);
		});
		test("chips.reddit is the same in en and pt-br", () => {
			expect(strings.en.postShare.chips.reddit).toBe(
				strings["pt-br"].postShare.chips.reddit,
			);
		});
	});

	describe("AC-4 — module-load Zod parse succeeds", () => {
		test.each(
			localeRows,
		)("locale %s: uiStringsSchema.parse(strings[locale]) does not throw", (locale) => {
			expect(() => uiStringsSchema.parse(strings[locale])).not.toThrow();
		});
	});
});

describe("uiStringsSchema — admin namespace", () => {
	describe("sidebar keys", () => {
		test.each(
			localeRows,
		)("locale %s: sidebar.posts is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.sidebar.posts).toBe("string");
			expect(strings[locale].admin.sidebar.posts.length).toBeGreaterThan(0);
		});

		test.each(
			localeRows,
		)("locale %s: sidebar.analytics is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.sidebar.analytics).toBe("string");
			expect(strings[locale].admin.sidebar.analytics.length).toBeGreaterThan(0);
		});
	});

	describe("analytics.pageTitle", () => {
		test.each(
			localeRows,
		)("locale %s: pageTitle is non-empty string", (locale) => {
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

		test.each(
			localeRows,
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

		test.each(
			localeRows,
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

		test.each(
			localeRows,
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
		test.each(
			localeRows,
		)("locale %s: filter.activeChip is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.analytics.filter.activeChip).toBe(
				"string",
			);
			expect(
				strings[locale].admin.analytics.filter.activeChip.length,
			).toBeGreaterThan(0);
		});

		test.each(
			localeRows,
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
		test.each(
			localeRows,
		)("locale %s: empty.awaitingData is non-empty string", (locale) => {
			expect(typeof strings[locale].admin.analytics.empty.awaitingData).toBe(
				"string",
			);
			expect(
				strings[locale].admin.analytics.empty.awaitingData.length,
			).toBeGreaterThan(0);
		});

		test.each(
			localeRows,
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
		test.each(
			localeRows,
		)("locale %s: uiStringsSchema.parse(strings[locale]) does not throw", (locale) => {
			expect(() => uiStringsSchema.parse(strings[locale])).not.toThrow();
		});
	});

	describe("AC-1 spot-checks", () => {
		test("en: sidebar.analytics resolves to non-empty string", () => {
			expect(strings.en.admin.sidebar.analytics).toBeTruthy();
		});

		test("pt-br: sidebar.analytics resolves to non-empty string", () => {
			expect(strings["pt-br"].admin.sidebar.analytics).toBeTruthy();
		});
	});

	describe("AC-5 regression — existing public keys unchanged", () => {
		test("en: localeSwitcher.label still 'English'", () => {
			expect(strings.en.localeSwitcher.label).toBe("English");
		});

		test("pt-br: localeSwitcher.label still 'Português'", () => {
			expect(strings["pt-br"].localeSwitcher.label).toBe("Português");
		});

		test("en: notFound.title still 'Page not found'", () => {
			expect(strings.en.notFound.title).toBe("Page not found");
		});

		test("en: postMeta.publishedOn still 'Published on'", () => {
			expect(strings.en.postMeta.publishedOn).toBe("Published on");
		});

		test("pt-br: notFound.homeCta still '← Posts'", () => {
			expect(strings["pt-br"].notFound.homeCta).toBe("← Posts");
		});
	});

	describe("admin.dashboard — AC-1: title non-empty in both locales", () => {
		test.each(
			localeRows,
		)("locale %s: dashboard.title is non-empty", (locale) => {
			expect(strings[locale].admin.dashboard.title.length).toBeGreaterThan(0);
		});
	});

	describe("admin.dashboard — AC-2: subtitle differs across locales", () => {
		test("en.subtitle !== pt-br.subtitle", () => {
			expect(strings.en.admin.dashboard.subtitle).not.toBe(
				strings["pt-br"].admin.dashboard.subtitle,
			);
		});
	});

	describe("admin.dashboard — filter keys", () => {
		test("en: filter.all resolves to 'All'", () => {
			expect(strings.en.admin.dashboard.filter.all).toBe("All");
		});
		test("pt-br: filter.all resolves to 'Todos'", () => {
			expect(strings["pt-br"].admin.dashboard.filter.all).toBe("Todos");
		});
		test("en: filter.label is non-empty", () => {
			expect(strings.en.admin.dashboard.filter.label.length).toBeGreaterThan(0);
		});
		test("pt-br: filter.label is non-empty", () => {
			expect(
				strings["pt-br"].admin.dashboard.filter.label.length,
			).toBeGreaterThan(0);
		});
		test.each(localeRows)("locale %s: filter.en is non-empty", (locale) => {
			expect(strings[locale].admin.dashboard.filter.en.length).toBeGreaterThan(
				0,
			);
		});
		test.each(localeRows)("locale %s: filter.ptBr is non-empty", (locale) => {
			expect(
				strings[locale].admin.dashboard.filter.ptBr.length,
			).toBeGreaterThan(0);
		});
	});

	describe("admin.dashboard — table headers", () => {
		test("en: table.title resolves to 'Title'", () => {
			expect(strings.en.admin.dashboard.table.title).toBe("Title");
		});
		test("pt-br: table.title resolves to 'Título'", () => {
			expect(strings["pt-br"].admin.dashboard.table.title).toBe("Título");
		});
		test("en: table.slug resolves to 'Slug'", () => {
			expect(strings.en.admin.dashboard.table.slug).toBe("Slug");
		});
		test("pt-br: table.slug resolves to 'Slug'", () => {
			expect(strings["pt-br"].admin.dashboard.table.slug).toBe("Slug");
		});
		test("en: table.lang resolves to non-empty", () => {
			expect(strings.en.admin.dashboard.table.lang.length).toBeGreaterThan(0);
		});
		test("pt-br: table.lang resolves to 'Idioma'", () => {
			expect(strings["pt-br"].admin.dashboard.table.lang).toBe("Idioma");
		});
		test("en: table.actions resolves to non-empty", () => {
			expect(strings.en.admin.dashboard.table.actions.length).toBeGreaterThan(
				0,
			);
		});
		test("pt-br: table.actions resolves to 'Ações'", () => {
			expect(strings["pt-br"].admin.dashboard.table.actions).toBe("Ações");
		});
	});

	describe("admin.dashboard — actions", () => {
		test("en: actions.view resolves to 'View'", () => {
			expect(strings.en.admin.dashboard.actions.view).toBe("View");
		});
		test("pt-br: actions.view resolves to 'Ver'", () => {
			expect(strings["pt-br"].admin.dashboard.actions.view).toBe("Ver");
		});
	});

	describe("admin.dashboard — AC-5: module-load parse succeeds", () => {
		test.each(
			localeRows,
		)("locale %s: uiStringsSchema.parse(strings[locale]) does not throw", (locale) => {
			expect(() => uiStringsSchema.parse(strings[locale])).not.toThrow();
		});
	});
});
