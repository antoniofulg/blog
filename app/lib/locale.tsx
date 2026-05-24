import { useRouterState } from "@tanstack/react-router";
import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";
import { getSiteOrigin } from "#/lib/site-origin";

export type Locale = "en" | "pt-br";

export const LOCALES = ["en", "pt-br"] as const satisfies readonly Locale[];
export const DEFAULT_LOCALE: Locale = "en";

const BCP47_MAP: Record<Locale, string> = { en: "en", "pt-br": "pt-BR" };
export function toBcp47(locale: Locale): string {
	return BCP47_MAP[locale] ?? locale;
}

export function collapseDefaultLocalePath(pathname: string): string {
	const defaultPrefix = `/${DEFAULT_LOCALE}/`;
	return pathname.startsWith(defaultPrefix)
		? pathname.slice(defaultPrefix.length - 1) || "/"
		: pathname;
}

export function localeHref(locale: Locale, slug?: string): string {
	if (locale === DEFAULT_LOCALE) {
		return slug ? `/${slug}` : "/";
	}
	return slug ? `/${locale}/${slug}` : `/${locale}/`;
}

const LocaleContext = createContext<{
	locale: Locale;
	setLocale: (locale: Locale) => void;
}>({ locale: DEFAULT_LOCALE, setLocale: () => {} });

export function LocaleProvider({ children }: { children: React.ReactNode }) {
	const [locale, setLocaleState] = useState<Locale>(DEFAULT_LOCALE);

	useEffect(() => {
		const stored = localStorage.getItem("locale") as Locale | null;
		if (stored && LOCALES.includes(stored)) {
			setLocaleState(stored);
		}
	}, []);

	const setLocale = useCallback((l: Locale) => {
		setLocaleState(l);
		localStorage.setItem("locale", l);
		document.cookie = `locale=${l}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Lax`;
	}, []);

	return (
		<LocaleContext.Provider value={{ locale, setLocale }}>
			{children}
		</LocaleContext.Provider>
	);
}

export function useLocale() {
	return useContext(LocaleContext);
}

export function useCurrentLocale(): Locale {
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	return (
		(LOCALES.find((l) => pathname.startsWith(`/${l}/`)) as
			| Locale
			| undefined) ?? DEFAULT_LOCALE
	);
}

function preferredLocale(acceptLang: string): Locale {
	const entries = acceptLang
		.split(",")
		.map((part) => {
			const [tag, ...params] = part.trim().split(";");
			const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
			const weight = q ? Number(q.slice(2)) : 1;
			return {
				tag: tag.toLowerCase(),
				weight: Number.isFinite(weight) ? weight : 1,
			};
		})
		.filter((e) => e.weight > 0)
		.sort((a, b) => b.weight - a.weight);

	for (const { tag } of entries) {
		if (tag.startsWith("pt")) return "pt-br";
		if (tag.startsWith("en")) return "en";
	}
	return DEFAULT_LOCALE;
}

const LOCALE_DESCRIPTIONS: Record<Locale, string> = {
	en: "Articles about web development, React, TypeScript, Bun and international career.",
	"pt-br":
		"Artigos sobre desenvolvimento web, React, TypeScript, Bun e carreira internacional.",
};

const LOCALE_PATHNAME: Record<Locale, string> = {
	en: "/",
	"pt-br": "/pt-br/",
};

const LOCALE_OG_LOCALE: Record<Locale, string> = {
	en: "en_US",
	"pt-br": "pt_BR",
};

export type HreflangDescriptor =
	| { kind: "homepage" }
	| { kind: "has-twin" }
	| { kind: "no-twin" };

export function buildLocaleHead(
	locale: Locale,
	hreflang: HreflangDescriptor = { kind: "no-twin" },
) {
	const siteUrl = getSiteOrigin();
	const canonicalUrl = `${siteUrl}${LOCALE_PATHNAME[locale]}`;
	const description = LOCALE_DESCRIPTIONS[locale];
	// Canonical link is emitted by `__root.tsx` (single source of truth, locale-aware
	// via pathname). Emitting it here too produced duplicate `<link rel="canonical">`
	// tags in the rendered HTML — Playwright's strict-mode `getAttribute` threw on
	// the multi-match, the audit caught and reported missing-meta, and search
	// engines saw conflicting canonical URLs (e.g. `/en/` vs `/`). og:url stays
	// here because it's a meta property, not a link, and does not collide with the
	// root layout's metadata.

	let links: Array<{ rel: string; hrefLang: string; href: string }> = [];

	if (hreflang.kind === "homepage") {
		links = [
			{ rel: "alternate", hrefLang: "x-default", href: `${siteUrl}/` },
			...LOCALES.map((l) => ({
				rel: "alternate",
				hrefLang: toBcp47(l),
				href: `${siteUrl}${localeHref(l)}`,
			})),
		];
	} else if (hreflang.kind === "has-twin") {
		links = LOCALES.map((l) => ({
			rel: "alternate",
			hrefLang: toBcp47(l),
			href: `${siteUrl}${localeHref(l)}`,
		}));
	}

	return {
		meta: [
			{ name: "description", content: description },
			{ property: "og:title", content: "Antonio Fulgencio Blog" },
			{ property: "og:description", content: description },
			{ property: "og:url", content: canonicalUrl },
			{ property: "og:locale", content: LOCALE_OG_LOCALE[locale] },
		],
		links,
	};
}

export type RouteKind =
	| { kind: "post"; slug: string; hasTwin: boolean }
	| { kind: "page"; slug: string; hasTwin: boolean }
	| { kind: "structural" }
	| { kind: "admin" };

export function getTwinAvailabilityForCurrentRoute(
	route: RouteKind,
	_targetLocale: Locale,
): { available: boolean; renderSwitcher: boolean } {
	// Admin routes have no locale-prefixed URL counterpart; the switcher only
	// flips the localStorage/cookie locale via setLocale (no navigation). Both
	// locales are always reachable, so render the switcher and mark available.
	if (route.kind === "admin") return { available: true, renderSwitcher: true };
	if (route.kind === "structural")
		return { available: true, renderSwitcher: true };
	return { available: route.hasTwin, renderSwitcher: true };
}

export function detectLocaleFromRequest(request: Request): Locale {
	const cookieHeader = request.headers.get("Cookie") ?? "";
	const match = cookieHeader.match(/(?:^|;\s*)locale=([^;]+)/);
	const stored = match?.[1]?.trim() as Locale | undefined;
	if (stored && LOCALES.includes(stored)) return stored;

	const acceptLang = request.headers.get("Accept-Language") ?? "";
	return preferredLocale(acceptLang);
}
