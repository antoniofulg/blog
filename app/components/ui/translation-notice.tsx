import { Info } from "lucide-react";
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
		`This content is not yet available in English. Showing the ${availableName} version.`,
	"pt-br": (availableName) =>
		`Este conteúdo ainda não está disponível em Português. Exibindo a versão em ${availableName}.`,
};

export function TranslationNotice({ requestedLang, availableLang }: Props) {
	const message = messages[requestedLang](localeNames[availableLang]);
	return (
		<div
			role="note"
			className="flex items-start gap-3 rounded-lg bg-callout-info p-4 text-sm text-foreground-secondary"
		>
			<Info
				className="mt-0.5 h-4 w-4 shrink-0 text-accent"
				aria-hidden="true"
			/>
			<span>{message}</span>
		</div>
	);
}
