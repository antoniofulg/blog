import { Moon, Sun } from "lucide-react";
import type { Locale } from "#/lib/locale";
import { useTheme } from "#/lib/theme";

const ariaLabelByLocale: Record<Locale, string> = {
	en: "Toggle theme",
	"pt-br": "Alternar tema",
};

export function ThemeToggle({ locale = "en" }: { locale?: Locale }) {
	const { theme, toggle } = useTheme();

	return (
		<button
			type="button"
			onClick={toggle}
			aria-label={ariaLabelByLocale[locale]}
			aria-pressed={theme === "dark"}
			className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
		>
			{theme === "dark" ? (
				<Sun className="h-5 w-5" aria-hidden="true" />
			) : (
				<Moon className="h-5 w-5" aria-hidden="true" />
			)}
		</button>
	);
}
