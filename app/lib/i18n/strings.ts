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
	socials: z.object({
		github: z.string(),
		linkedin: z.string(),
		x: z.string(),
		instagram: z.string(),
		rss: z.string(),
		email: z.string(),
	}),
	postShare: z.object({
		share: z.string(),
		chips: z.object({
			twitter: z.string(),
			linkedin: z.string(),
			reddit: z.string(),
			whatsapp: z.string(),
			email: z.string(),
			copy: z.string(),
		}),
		copied: z.string(),
		ariaShareOn: z.string(),
	}),
	admin: z.object({
		sidebar: z.object({
			posts: z.string(),
			analytics: z.string(),
			navLabel: z.string(),
		}),
		dashboard: z.object({
			title: z.string(),
			subtitle: z.string(),
			filter: z.object({
				label: z.string(),
				all: z.string(),
				en: z.string(),
				ptBr: z.string(),
			}),
			table: z.object({
				title: z.string(),
				slug: z.string(),
				lang: z.string(),
				published: z.string(),
				actions: z.string(),
			}),
			unpublished: z.string(),
			actions: z.object({
				view: z.string(),
			}),
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
			topPostsTable: z.object({
				columnTitle: z.string(),
				columnLanguage: z.string(),
				columnVisits: z.string(),
			}),
			a11y: z.object({
				columnDate: z.string(),
				columnSource: z.string(),
				columnDevice: z.string(),
			}),
			filter: z.object({
				activeChip: z.string(),
				clearAll: z.string(),
			}),
			empty: z.object({
				awaitingData: z.string(),
				awaitingDataDescription: z.string(),
				noDataForPost: z.string(),
				noDataForPostDescription: z.string(),
			}),
		}),
	}),
});

export type UIStrings = z.infer<typeof uiStringsSchema>;

export const strings: Record<Locale, UIStrings> = {
	en: {
		localeSwitcher: { label: "English" },
		socials: {
			github: "GitHub",
			linkedin: "LinkedIn",
			x: "X",
			instagram: "Instagram",
			rss: "RSS",
			email: "Email",
		},
		postMeta: {
			publishedOn: "Published on",
			readingTime: "min read",
		},
		postShare: {
			share: "Share",
			chips: {
				twitter: "X",
				linkedin: "LinkedIn",
				reddit: "Reddit",
				whatsapp: "WhatsApp",
				email: "Email",
				copy: "Copy link",
			},
			copied: "Copied!",
			ariaShareOn: "Share on {platform}",
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
				navLabel: "Admin navigation",
			},
			dashboard: {
				title: "Admin Dashboard",
				subtitle: "Manage your articles and publications.",
				filter: {
					label: "Filter by language",
					all: "All",
					en: "EN",
					ptBr: "PT-BR",
				},
				table: {
					title: "Title",
					slug: "Slug",
					lang: "Language",
					published: "Published",
					actions: "Actions",
				},
				unpublished: "Draft",
				actions: {
					view: "View",
				},
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
				topPostsTable: {
					columnTitle: "Title",
					columnLanguage: "Language",
					columnVisits: "Visits",
				},
				a11y: {
					columnDate: "Date",
					columnSource: "Source",
					columnDevice: "Device",
				},
				filter: {
					activeChip: "Filtered by post:",
					clearAll: "Clear filter",
				},
				empty: {
					awaitingData: "No data yet",
					awaitingDataDescription:
						"Analytics data will appear here once visitors start reading posts.",
					noDataForPost: "No data for this post",
					noDataForPostDescription:
						"No events found for the selected post in this time range.",
				},
			},
		},
	},
	"pt-br": {
		localeSwitcher: { label: "Português" },
		socials: {
			github: "GitHub",
			linkedin: "LinkedIn",
			x: "X",
			instagram: "Instagram",
			rss: "RSS",
			email: "E-mail",
		},
		postMeta: {
			publishedOn: "Publicado em",
			readingTime: "min de leitura",
		},
		postShare: {
			share: "Compartilhar",
			chips: {
				twitter: "X",
				linkedin: "LinkedIn",
				reddit: "Reddit",
				whatsapp: "WhatsApp",
				email: "E-mail",
				copy: "Copiar link",
			},
			copied: "Copiado!",
			ariaShareOn: "Compartilhar no {platform}",
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
				navLabel: "Navegação do admin",
			},
			dashboard: {
				title: "Painel Admin",
				subtitle: "Gerencie seus artigos e publicações.",
				filter: {
					label: "Filtrar por idioma",
					all: "Todos",
					en: "EN",
					ptBr: "PT-BR",
				},
				table: {
					title: "Título",
					slug: "Slug",
					lang: "Idioma",
					published: "Publicado",
					actions: "Ações",
				},
				unpublished: "Rascunho",
				actions: {
					view: "Ver",
				},
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
				topPostsTable: {
					columnTitle: "Título",
					columnLanguage: "Idioma",
					columnVisits: "Visitas",
				},
				a11y: {
					columnDate: "Data",
					columnSource: "Origem",
					columnDevice: "Dispositivo",
				},
				filter: {
					activeChip: "Filtrado por post:",
					clearAll: "Limpar filtro",
				},
				empty: {
					awaitingData: "Sem dados ainda",
					awaitingDataDescription:
						"Os dados de analytics aparecerão aqui assim que os visitantes começarem a ler os posts.",
					noDataForPost: "Sem dados para este post",
					noDataForPostDescription:
						"Nenhum evento encontrado para o post selecionado neste período.",
				},
			},
		},
	},
};

for (const locale of LOCALES) uiStringsSchema.parse(strings[locale]);
