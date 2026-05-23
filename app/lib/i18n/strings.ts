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
	admin: z.object({
		sidebar: z.object({
			posts: z.string(),
			analytics: z.string(),
		}),
		analytics: z.object({
			pageTitle: z.string(),
			summary: z.object({
				totalVisits: z.string(),
				uniquePosts: z.string(),
				topReferrer: z.string(),
				topLanguage: z.string(),
			}),
			widgets: z.object({
				dailyTrend: z.string(),
				referrerSources: z.string(),
				topPosts: z.string(),
				deviceSplit: z.string(),
			}),
			range: z.object({
				"7d": z.string(),
				"30d": z.string(),
				"90d": z.string(),
				mtd: z.string(),
				ytd: z.string(),
				all: z.string(),
			}),
			filter: z.object({
				activeChip: z.string(),
				clearAll: z.string(),
			}),
			empty: z.object({
				awaitingData: z.string(),
				awaitingDataDescription: z.string(),
			}),
		}),
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
			body: "Nothing here. Check the URL or head back to the posts.",
			homeCta: "← Posts",
		},
		admin: {
			sidebar: {
				posts: "Posts",
				analytics: "Analytics",
			},
			analytics: {
				pageTitle: "Analytics",
				summary: {
					totalVisits: "Total Visits",
					uniquePosts: "Unique Posts",
					topReferrer: "Top Referrer",
					topLanguage: "Top Language",
				},
				widgets: {
					dailyTrend: "Daily Trend",
					referrerSources: "Referrer Sources",
					topPosts: "Top Posts",
					deviceSplit: "Device Split",
				},
				range: {
					"7d": "Last 7 days",
					"30d": "Last 30 days",
					"90d": "Last 90 days",
					mtd: "Month to date",
					ytd: "Year to date",
					all: "All time",
				},
				filter: {
					activeChip: "Filtered by post:",
					clearAll: "Clear filter",
				},
				empty: {
					awaitingData: "No data yet",
					awaitingDataDescription:
						"Analytics data will appear here once visitors start reading posts.",
				},
			},
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
			body: "Nada aqui. Verifique o URL ou volte para os posts.",
			homeCta: "← Posts",
		},
		admin: {
			sidebar: {
				posts: "Posts",
				analytics: "Analytics",
			},
			analytics: {
				pageTitle: "Analytics",
				summary: {
					totalVisits: "Total de visitas",
					uniquePosts: "Posts únicos",
					topReferrer: "Principal origem",
					topLanguage: "Principal idioma",
				},
				widgets: {
					dailyTrend: "Tendência diária",
					referrerSources: "Origens de acesso",
					topPosts: "Posts mais acessados",
					deviceSplit: "Dispositivos",
				},
				range: {
					"7d": "Últimos 7 dias",
					"30d": "Últimos 30 dias",
					"90d": "Últimos 90 dias",
					mtd: "Mês atual",
					ytd: "Ano atual",
					all: "Tudo",
				},
				filter: {
					activeChip: "Filtrado por post:",
					clearAll: "Limpar filtro",
				},
				empty: {
					awaitingData: "Sem dados ainda",
					awaitingDataDescription:
						"Os dados de analytics aparecerão aqui assim que os visitantes começarem a ler os posts.",
				},
			},
		},
	},
};

for (const locale of LOCALES) uiStringsSchema.parse(strings[locale]);
