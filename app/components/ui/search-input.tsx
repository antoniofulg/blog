import { Search } from "lucide-react";
import type { Locale } from "#/lib/locale";

const placeholderByLocale: Record<Locale, string> = {
	en: "Search articles...",
	"pt-br": "Buscar artigos...",
};

const ariaLabelByLocale: Record<Locale, string> = {
	en: "Search articles",
	"pt-br": "Buscar artigos",
};

export function SearchInput({
	value,
	onChange,
	locale = "en",
	placeholder,
}: {
	value: string;
	onChange: (value: string) => void;
	locale?: Locale;
	placeholder?: string;
}) {
	return (
		<div className="flex h-11 items-center gap-2 rounded-md border border-border bg-background px-3 transition-colors focus-within:border-border-strong focus-within:ring-2 focus-within:ring-accent focus-within:ring-offset-2 focus-within:ring-offset-background">
			<Search
				className="h-4 w-4 shrink-0 text-foreground-muted"
				aria-hidden="true"
			/>
			<input
				type="search"
				value={value}
				onChange={(e) => onChange(e.target.value)}
				placeholder={placeholder ?? placeholderByLocale[locale]}
				aria-label={ariaLabelByLocale[locale]}
				className="flex-1 bg-transparent text-sm text-foreground placeholder:text-foreground-muted focus:outline-none"
			/>
		</div>
	);
}
