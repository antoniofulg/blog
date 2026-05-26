import * as Popover from "@radix-ui/react-popover";
import { Gamepad2, Moon, Sun } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import type { Locale } from "#/lib/locale";
import { type Theme, type ThemeSource, useTheme } from "#/lib/theme";

const LONG_PRESS_MS = 500;

type Labels = {
	toggle: string;
	menu: string;
	light: string;
	dark: string;
	cs16: string;
	hint: string;
};

const labelsByLocale: Record<Locale, Labels> = {
	en: {
		toggle: "Toggle theme",
		menu: "Pick a theme",
		light: "Light",
		dark: "Dark",
		cs16: "CS 1.6",
		hint: "Long-press for more themes",
	},
	"pt-br": {
		toggle: "Alternar tema",
		menu: "Escolha um tema",
		light: "Claro",
		dark: "Escuro",
		cs16: "CS 1.6",
		hint: "Pressione e segure para mais temas",
	},
};

const themeIcon: Record<Theme, typeof Sun> = {
	light: Sun,
	dark: Moon,
	cs16: Gamepad2,
};

export function ThemeToggle({ locale = "en" }: { locale?: Locale }) {
	const { theme, toggle, setTheme } = useTheme();
	const [open, setOpen] = useState(false);
	const timerRef = useRef<number | null>(null);
	const longPressed = useRef(false);
	/**
	 * Tracks how the popover was last opened so `pickTheme` forwards the
	 * correct `source` to `setTheme`. Defaults to `'long-press'` (the original
	 * path) so any residual call without an explicit open event is attributed
	 * correctly. Per ADR-002: only cs16 activations are telemetry-recorded.
	 */
	const sourceRef = useRef<ThemeSource>("long-press");
	const labels = labelsByLocale[locale];
	const Icon = themeIcon[theme] ?? Moon;

	const clearTimer = useCallback(() => {
		if (timerRef.current !== null) {
			window.clearTimeout(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const handlePointerDown = useCallback(() => {
		longPressed.current = false;
		clearTimer();
		timerRef.current = window.setTimeout(() => {
			sourceRef.current = "long-press";
			longPressed.current = true;
			setOpen(true);
		}, LONG_PRESS_MS);
	}, [clearTimer]);

	const handlePointerUp = useCallback(() => {
		clearTimer();
	}, [clearTimer]);

	const handleClick = useCallback(
		(event: React.MouseEvent<HTMLButtonElement>) => {
			if (longPressed.current) {
				event.preventDefault();
				longPressed.current = false;
				return;
			}
			toggle();
		},
		[toggle],
	);

	/**
	 * Keyboard handler for WCAG 2.5.1 / ARIA menu-button pattern.
	 * `ArrowDown` and `Space` open the theme popover. Both call `preventDefault`
	 * so the browser does not scroll (ArrowDown) or trigger native form submit
	 * (Space). The `source` ref is set to `'keyboard'` before opening so that
	 * any subsequent theme pick in `pickTheme` carries the correct attribution.
	 */
	const handleKeyDown = useCallback(
		(event: React.KeyboardEvent<HTMLButtonElement>) => {
			if (event.key === "ArrowDown" || event.key === " ") {
				event.preventDefault();
				sourceRef.current = "keyboard";
				setOpen(true);
			}
		},
		[],
	);

	const pickTheme = useCallback(
		(next: Theme) => {
			setTheme(next, sourceRef.current);
			setOpen(false);
		},
		[setTheme],
	);

	return (
		<Popover.Root open={open} onOpenChange={setOpen}>
			<Popover.Anchor asChild>
				<button
					type="button"
					onPointerDown={handlePointerDown}
					onPointerUp={handlePointerUp}
					onPointerLeave={handlePointerUp}
					onPointerCancel={handlePointerUp}
					onClick={handleClick}
					onKeyDown={handleKeyDown}
					onContextMenu={(e) => e.preventDefault()}
					aria-label={labels.toggle}
					aria-haspopup="menu"
					aria-expanded={open}
					aria-keyshortcuts="ArrowDown Space"
					title={labels.hint}
					className="flex h-10 w-10 select-none items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<Icon className="h-5 w-5" aria-hidden="true" />
				</button>
			</Popover.Anchor>
			<Popover.Portal forceMount>
				<Popover.Content
					hidden={!open}
					align="end"
					sideOffset={8}
					role="menu"
					aria-label={labels.menu}
					className="z-50 min-w-[10rem] rounded-md border border-border bg-card p-1 text-foreground shadow-lg outline-none"
				>
					<ThemeOption
						active={theme === "light"}
						label={labels.light}
						icon={Sun}
						onSelect={() => pickTheme("light")}
					/>
					<ThemeOption
						active={theme === "dark"}
						label={labels.dark}
						icon={Moon}
						onSelect={() => pickTheme("dark")}
					/>
					<ThemeOption
						active={theme === "cs16"}
						label={labels.cs16}
						icon={Gamepad2}
						onSelect={() => pickTheme("cs16")}
					/>
				</Popover.Content>
			</Popover.Portal>
		</Popover.Root>
	);
}

function ThemeOption({
	active,
	label,
	icon: Icon,
	onSelect,
}: {
	active: boolean;
	label: string;
	icon: typeof Sun;
	onSelect: () => void;
}) {
	return (
		<button
			type="button"
			role="menuitemradio"
			aria-checked={active}
			onClick={onSelect}
			className={`flex w-full items-center gap-2 rounded px-3 py-2 text-left text-sm transition-colors hover:bg-muted focus-visible:bg-muted focus-visible:outline-none ${
				active ? "bg-muted font-semibold" : ""
			}`}
		>
			<Icon className="h-4 w-4" aria-hidden="true" />
			<span>{label}</span>
		</button>
	);
}
