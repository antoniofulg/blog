import { Link, useRouterState } from "@tanstack/react-router";
import { Menu, Moon, Sun, Terminal, X } from "lucide-react";
import { useState } from "react";
import { LanguageMenu } from "#/components/ui/language-menu";
import { DEFAULT_LOCALE, type Locale, useCurrentLocale } from "#/lib/locale";
import { useTheme } from "#/lib/theme";

const NAV_LABELS: Record<Locale, readonly { label: string; to: string }[]> = {
	en: [
		{ label: "Home", to: "/" },
		{ label: "About", to: "/en/about" },
	],
	"pt-br": [
		{ label: "Home", to: "/" },
		{ label: "Sobre", to: "/pt-br/about" },
	],
};

const HEADER_STRINGS: Record<
	Locale,
	{ closeMenu: string; openMenu: string; toggleTheme: string }
> = {
	en: {
		closeMenu: "Close menu",
		openMenu: "Open menu",
		toggleTheme: "Toggle theme",
	},
	"pt-br": {
		closeMenu: "Fechar menu",
		openMenu: "Abrir menu",
		toggleTheme: "Alternar tema",
	},
};

function isActiveLink(to: string, pathname: string): boolean {
	if (to === "/") {
		return pathname === "/" || pathname === "/en/" || pathname === "/pt-br/";
	}
	return pathname.startsWith(to);
}

function usePathname() {
	return useRouterState({ select: (s) => s.location.pathname });
}

export function Header() {
	const { theme, toggle } = useTheme();
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const currentLocale = useCurrentLocale();
	const pathname = usePathname();
	const navLinks = NAV_LABELS[currentLocale];
	const headerStrings = HEADER_STRINGS[currentLocale];

	return (
		<>
			<header className="animate-fade-down sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background px-6 lg:px-20">
				<Link
					to="/{-$locale}/"
					params={{
						locale:
							currentLocale === DEFAULT_LOCALE ? undefined : currentLocale,
					}}
					aria-label="Antonio Fulgencio — home"
					className="flex items-center gap-2 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background"
				>
					<Terminal className="h-6 w-6 text-accent" aria-hidden="true" />
					<span
						className="font-heading text-lg font-bold text-foreground"
						aria-hidden="true"
					>
						Antonio Fulgencio
					</span>
				</Link>

				<nav className="hidden items-center gap-8 lg:flex">
					{navLinks.map((link) => {
						const active = isActiveLink(link.to, pathname);
						return (
							<Link
								key={link.to}
								to={link.to}
								aria-current={active ? "page" : undefined}
								className={`rounded-sm text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-4 focus-visible:ring-offset-background ${
									active
										? "text-accent"
										: "text-foreground-secondary hover:text-accent"
								}`}
							>
								{link.label}
							</Link>
						);
					})}
				</nav>

				<div className="flex items-center gap-2">
					<LanguageMenu variant="dropdown" />
					<button
						type="button"
						onClick={toggle}
						aria-label={headerStrings.toggleTheme}
						aria-pressed={theme === "dark"}
						className="flex h-11 w-11 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
					>
						{theme === "dark" ? (
							<Sun className="h-5 w-5" aria-hidden="true" />
						) : (
							<Moon className="h-5 w-5" aria-hidden="true" />
						)}
					</button>
					<button
						type="button"
						onClick={() => setMobileMenuOpen(true)}
						aria-label={headerStrings.openMenu}
						aria-expanded={mobileMenuOpen}
						aria-controls="mobile-menu"
						className="flex h-11 w-11 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background lg:hidden"
					>
						<Menu className="h-5 w-5" aria-hidden="true" />
					</button>
				</div>
			</header>

			{mobileMenuOpen && (
				<MobileMenu
					locale={currentLocale}
					onClose={() => setMobileMenuOpen(false)}
				/>
			)}
		</>
	);
}

function MobileMenu({
	locale,
	onClose,
}: {
	locale: Locale;
	onClose: () => void;
}) {
	const { theme, toggle } = useTheme();
	const pathname = usePathname();
	const navLinks = NAV_LABELS[locale];
	const headerStrings = HEADER_STRINGS[locale];

	return (
		<div
			id="mobile-menu"
			role="dialog"
			aria-modal="true"
			aria-label={headerStrings.openMenu}
			className="fixed inset-0 z-50 bg-background lg:hidden"
		>
			<div className="flex h-16 items-center justify-between border-b border-border px-5">
				<span className="font-heading text-base font-bold text-foreground">
					Antonio Fulgencio
				</span>
				<button
					type="button"
					onClick={onClose}
					aria-label={headerStrings.closeMenu}
					className="flex h-11 w-11 items-center justify-center rounded-md text-foreground-secondary transition-colors hover:bg-surface hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					<X className="h-5 w-5" aria-hidden="true" />
				</button>
			</div>

			<nav aria-label="Primary" className="flex flex-col px-5 py-2">
				{navLinks.map((link) => {
					const active = isActiveLink(link.to, pathname);
					return (
						<Link
							key={link.to}
							to={link.to}
							onClick={onClose}
							aria-current={active ? "page" : undefined}
							className={`flex h-13 items-center border-b border-border text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
								active
									? "text-accent"
									: "text-foreground-secondary hover:text-foreground"
							}`}
						>
							{link.label}
						</Link>
					);
				})}
			</nav>

			<LanguageMenu variant="list" onAfterChange={onClose} />

			<div className="mt-6 flex items-center gap-3 px-5">
				<button
					type="button"
					onClick={toggle}
					aria-label={headerStrings.toggleTheme}
					aria-pressed={theme === "dark"}
					className="flex h-11 w-11 items-center justify-center rounded-md bg-surface text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
				>
					{theme === "dark" ? (
						<Sun className="h-5 w-5" aria-hidden="true" />
					) : (
						<Moon className="h-5 w-5" aria-hidden="true" />
					)}
				</button>
				<span className="text-sm text-foreground-secondary">
					{headerStrings.toggleTheme}
				</span>
			</div>
		</div>
	);
}
