import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, Terminal } from "lucide-react";
import { useState } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale, useLocale } from "#/lib/locale";
import { useTheme } from "#/lib/theme";

const NAV_LABELS: Record<Locale, readonly { label: string; to: string }[]> = {
	en: [
		{ label: "Home", to: "/" },
		{ label: "Blog", to: "/blog" },
		{ label: "About", to: "/about" },
	],
	"pt-br": [
		{ label: "Home", to: "/" },
		{ label: "Blog", to: "/blog" },
		{ label: "Sobre", to: "/about" },
	],
};

const MOBILE_STRINGS: Record<
	Locale,
	{ closeMenu: string; toggleTheme: string; language: string }
> = {
	en: {
		closeMenu: "Close menu",
		toggleTheme: "Toggle theme",
		language: "Language",
	},
	"pt-br": {
		closeMenu: "Fechar menu",
		toggleTheme: "Alternar tema",
		language: "Idioma",
	},
};

function useLangSwitcher() {
	const { setLocale } = useLocale();
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const currentLocale: Locale =
		(LOCALES.find((l) => pathname.startsWith(`/${l}/`)) as
			| Locale
			| undefined) ?? DEFAULT_LOCALE;
	const targetLocale = LOCALES.find((l) => l !== currentLocale) as Locale;
	const label = targetLocale === "pt-br" ? "PT" : "EN";

	function switchLang() {
		setLocale(targetLocale);
		const prefix = `/${currentLocale}/`;
		const localeParam =
			targetLocale === DEFAULT_LOCALE ? undefined : targetLocale;
		if (pathname.startsWith(prefix)) {
			const rest = pathname.slice(prefix.length).replace(/\/$/, "");
			if (rest === "" || rest === "blog") {
				navigate({ to: "/{-$locale}", params: { locale: localeParam } });
			} else {
				navigate({
					to: "/{-$locale}/$slug",
					params: { locale: localeParam, slug: rest },
				});
			}
		} else {
			navigate({ to: "/{-$locale}", params: { locale: localeParam } });
		}
	}

	return { label, switchLang, currentLocale };
}

export function Header() {
	const { theme, toggle } = useTheme();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const { label, switchLang, currentLocale } = useLangSwitcher();
	const navLinks = NAV_LABELS[currentLocale];

	return (
		<>
			<header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background px-6 lg:px-20">
				<Link
					to="/{-$locale}"
					params={{
						locale:
							currentLocale === DEFAULT_LOCALE ? undefined : currentLocale,
					}}
					className="flex items-center gap-2"
				>
					<Terminal className="h-6 w-6 text-accent" />
					<span className="font-heading text-lg font-bold text-foreground">
						Antonio Fulgencio
					</span>
				</Link>

				<nav className="hidden items-center gap-8 lg:flex">
					{navLinks.map((link) => (
						<Link
							key={link.to}
							to={link.to}
							className="text-sm font-medium text-foreground-secondary transition-colors hover:text-accent"
						>
							{link.label}
						</Link>
					))}
				</nav>

				<div className="flex items-center gap-3">
					<button
						type="button"
						onClick={switchLang}
						aria-label="Switch language"
						className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted"
					>
						<span className="text-xs font-semibold">{label}</span>
					</button>
					<button
						type="button"
						onClick={toggle}
						className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted"
					>
						{theme === "dark" ? (
							<Sun className="h-5 w-5" />
						) : (
							<Moon className="h-5 w-5" />
						)}
					</button>
					<button
						type="button"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-secondary lg:hidden"
					>
						<Menu className="h-5 w-5" />
					</button>
				</div>
			</header>

			{mobileMenuOpen && (
				<MobileMenu onClose={() => setMobileMenuOpen(false)} />
			)}
		</>
	);
}

function MobileMenu({ onClose }: { onClose: () => void }) {
	const { theme, toggle } = useTheme();
	const { label, switchLang, currentLocale } = useLangSwitcher();
	const navLinks = NAV_LABELS[currentLocale];
	const mobileStrings = MOBILE_STRINGS[currentLocale];

	function handleLangSwitch() {
		switchLang();
		onClose();
	}

	return (
		<div className="fixed inset-0 z-50 bg-background lg:hidden">
			<div className="flex h-14 items-center justify-between border-b border-border px-5">
				<span className="font-heading text-base font-bold text-foreground">
					AF Blog
				</span>
				<button type="button" onClick={onClose} className="text-foreground">
					<span className="sr-only">{mobileStrings.closeMenu}</span>✕
				</button>
			</div>
			<nav className="flex flex-col px-5 py-2">
				{navLinks.map((link) => (
					<Link
						key={link.to}
						to={link.to}
						onClick={onClose}
						className="flex h-13 items-center border-b border-border text-base font-medium text-foreground-secondary"
					>
						{link.label}
					</Link>
				))}
			</nav>
			<div className="flex items-center gap-3 px-5 py-4">
				<button
					type="button"
					onClick={toggle}
					className="flex h-10 w-10 items-center justify-center rounded-md bg-surface"
				>
					{theme === "dark" ? (
						<Sun className="h-5 w-5 text-foreground" />
					) : (
						<Moon className="h-5 w-5 text-foreground" />
					)}
				</button>
				<span className="text-sm text-foreground-secondary">
					{mobileStrings.toggleTheme}
				</span>
				<button
					type="button"
					onClick={handleLangSwitch}
					aria-label="Switch language"
					className="flex h-10 w-10 items-center justify-center rounded-md bg-surface text-foreground"
				>
					<span className="text-xs font-semibold">{label}</span>
				</button>
				<span className="text-sm text-foreground-secondary">
					{mobileStrings.language}
				</span>
			</div>
		</div>
	);
}
