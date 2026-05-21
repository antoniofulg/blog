import { z } from "zod";
import { LOCALES, type Locale } from "#/lib/locale";

export const uiStringsSchema = z.object({
	localeSwitcher: z.object({
		label: z.string(),
	}),
	postMeta: z.object({
		publishedOn: z.string(),
		readingTime: z.string(),
	}),
	notFound: z.object({
		title: z.string(),
		body: z.string(),
		homeCta: z.string(),
	}),
});

export type UIStrings = z.infer<typeof uiStringsSchema>;

export const strings: Record<Locale, UIStrings> = {
	en: {
		localeSwitcher: { label: "English" },
		postMeta: {
			publishedOn: "Published on",
			readingTime: "min read",
		},
		notFound: {
			title: "Page not found",
			body: "Nothing here. Check the URL or head back to the writing.",
			homeCta: "← Writing",
		},
	},
	"pt-br": {
		localeSwitcher: { label: "Português" },
		postMeta: {
			publishedOn: "Publicado em",
			readingTime: "min de leitura",
		},
		notFound: {
			title: "Página não encontrada",
			body: "Nada aqui. Verifique o URL ou volte para os artigos.",
			homeCta: "← Escrita",
		},
	},
};

for (const locale of LOCALES) uiStringsSchema.parse(strings[locale]);
