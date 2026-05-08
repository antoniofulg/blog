import {
	createContext,
	useCallback,
	useContext,
	useEffect,
	useState,
} from "react";

export type Locale = "en" | "pt-br";

export const LOCALES: Locale[] = ["en", "pt-br"];
export const DEFAULT_LOCALE: Locale = "en";

const BCP47_MAP: Record<Locale, string> = { en: "en", "pt-br": "pt-BR" };
export function toBcp47(locale: Locale): string {
	return BCP47_MAP[locale] ?? locale;
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

export function detectLocaleFromRequest(request: Request): Locale {
	const acceptLang = request.headers.get("Accept-Language") ?? "";
	return /\bpt\b/i.test(acceptLang) ? "pt-br" : DEFAULT_LOCALE;
}
