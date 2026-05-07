import type { Locale } from "#/lib/locale";

type Props = {
	requestedLang: Locale;
	availableLang: Locale;
};

const localeNames: Record<Locale, string> = {
	en: "English",
	"pt-br": "Português",
};

const messages: Record<Locale, (availableName: string) => string> = {
	en: (availableName) =>
		`This post is not available in English — showing ${availableName} version`,
	"pt-br": (availableName) =>
		`Este post não está disponível em Português — mostrando versão em ${availableName}`,
};

export function TranslationNotice({ requestedLang, availableLang }: Props) {
	const message = messages[requestedLang](localeNames[availableLang]);
	return (
		<div
			role="note"
			className="rounded-md border border-accent/20 bg-accent/5 px-4 py-3 text-sm text-foreground-secondary"
		>
			{message}
		</div>
	);
}
