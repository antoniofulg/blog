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
			body: "The page you are looking for does not exist.",
			homeCta: "Go home",
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
			body: "A página que você está procurando não existe.",
			homeCta: "Ir para o início",
		},
	},
};

for (const locale of LOCALES) uiStringsSchema.parse(strings[locale]);
