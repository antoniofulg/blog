import { Moon, Sun } from "lucide-react";
import { useTheme } from "#/lib/theme";

export function ThemeToggle() {
	const { theme, toggle } = useTheme();

	return (
		<button
			type="button"
			onClick={toggle}
			className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted"
			aria-label="Alternar tema"
		>
			{theme === "dark" ? (
				<Sun className="h-5 w-5" />
			) : (
				<Moon className="h-5 w-5" />
			)}
		</button>
	);
}
