import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Menu, Terminal } from "lucide-react";
import { useCallback, useMemo, useRef, useState } from "react";
import {
	LanguageMenu,
	type LanguageMenuItemConfig,
} from "#/components/ui/language-menu";
import { MissingTwinDialog } from "#/components/ui/missing-twin-dialog";
import { ThemeToggle } from "#/components/ui/theme-toggle";
import { strings } from "#/lib/i18n/strings";
import {
	DEFAULT_LOCALE,
	getTwinAvailabilityForCurrentRoute,
	LOCALES,
	type Locale,
	type RouteKind,
	useLocale,
} from "#/lib/locale";

const NAV_LABELS: Record<Locale, readonly { label: string; to: string }[]> = {
	en: [
		{ label: "Home", to: "/" },
		{ label: "About", to: "/en/about" },
	],
	"pt-br": [
		{ label: "Home", to: "/pt-br/" },
		{ label: "Sobre", to: "/pt-br/about" },
	],
};

const MOBILE_STRINGS: Record<
	Locale,
	{ closeMenu: string; openMenu: string; toggleTheme: string; language: string }
> = {
	en: {
		closeMenu: "Close menu",
		openMenu: "Open menu",
		toggleTheme: "Toggle theme",
		language: "Language",
	},
	"pt-br": {
		closeMenu: "Fechar menu",
		openMenu: "Abrir menu",
		toggleTheme: "Alternar tema",
		language: "Idioma",
	},
};

function useLangSwitcher() {
	const { locale: contextLocale, setLocale } = useLocale();
	const navigate = useNavigate();
	const [dialogOpen, setDialogOpen] = useState(false);
	const [dialogTargetLocale, setDialogTargetLocale] = useState<Locale>("pt-br");
	const triggerRef = useRef<HTMLButtonElement>(null);

	// Each selector returns a primitive to avoid re-render loops in useSyncExternalStore.
	const pathname = useRouterState({ select: (s) => s.location.pathname });
	const currentSlug = useRouterState({
		select: (s) => {
			const m = s.matches.find((m) => m.routeId === "/{-$locale}/$slug");
			return m ? ((m.params as { slug?: string }).slug ?? null) : null;
		},
	});
	const loaderKind = useRouterState({
		select: (s) => {
			const m = s.matches.find((m) => m.routeId === "/{-$locale}/$slug");
			return (m?.loaderData as { kind?: string } | undefined)?.kind ?? null;
		},
	});
	const hasTwinFromLoader = useRouterState({
		select: (s) => {
			const m = s.matches.find((m) => m.routeId === "/{-$locale}/$slug");
			const ld = m?.loaderData as
				| {
						kind?: string;
						alternateLang?: string | null;
						availableLang?: string | null;
						requestedLang?: string;
						hasTwin?: boolean;
				  }
				| undefined;
			if (!ld) return null;
			if (ld.kind === "post")
				return (
					(ld.alternateLang !== null && ld.alternateLang !== undefined) ||
					(ld.availableLang !== null &&
						ld.availableLang !== undefined &&
						ld.availableLang !== ld.requestedLang)
				);
			if (ld.kind === "page") return ld.hasTwin ?? null;
			return null;
		},
	});

	const isAdmin = pathname.startsWith("/admin");
	// Admin routes have no locale prefix; fall back to the LocaleProvider
	// context value (cookie/localStorage-backed) so the switcher reflects the
	// admin's actual active locale, not the URL-default.
	const currentLocale: Locale = isAdmin
		? contextLocale
		: ((LOCALES.find((l) => pathname.startsWith(`/${l}/`)) as
				| Locale
				| undefined) ?? DEFAULT_LOCALE);

	const routeKind: RouteKind = useMemo(() => {
		if (isAdmin) return { kind: "admin" };
		if (currentSlug !== null && loaderKind === "post") {
			return {
				kind: "post",
				slug: currentSlug,
				hasTwin: hasTwinFromLoader ?? false,
			};
		}
		if (currentSlug !== null && loaderKind === "page") {
			return {
				kind: "page",
				slug: currentSlug,
				hasTwin: hasTwinFromLoader ?? false,
			};
		}
		return { kind: "structural" };
	}, [isAdmin, currentSlug, loaderKind, hasTwinFromLoader]);

	const targetLocaleForCheck = LOCALES.find(
		(l) => l !== currentLocale,
	) as Locale;
	const { renderSwitcher } = getTwinAvailabilityForCurrentRoute(
		routeKind,
		targetLocaleForCheck,
	);

	const localeItems: LanguageMenuItemConfig[] = useMemo(
		() =>
			LOCALES.filter((l) => l !== currentLocale).map((targetLocale) => {
				const { available } = getTwinAvailabilityForCurrentRoute(
					routeKind,
					targetLocale,
				);
				return {
					locale: targetLocale,
					label: strings[targetLocale].localeSwitcher.label,
					available,
					onClick: () => {
						if (available) {
							setLocale(targetLocale);
							// Admin routes are not locale-prefixed; setLocale alone is
							// enough (LocaleProvider context updates and admin re-renders
							// via the strings[locale] lookups). No URL navigation needed.
							if (routeKind.kind === "admin") return;
							const localeParam =
								targetLocale === DEFAULT_LOCALE ? undefined : targetLocale;
							if (routeKind.kind === "post" || routeKind.kind === "page") {
								navigate({
									to: "/{-$locale}/$slug/",
									params: { locale: localeParam, slug: routeKind.slug },
								});
							} else {
								navigate({
									to: "/{-$locale}/",
									params: { locale: localeParam },
								});
							}
						} else {
							setDialogTargetLocale(targetLocale);
							setDialogOpen(true);
						}
					},
				};
			}),
		[currentLocale, routeKind, navigate, setLocale],
	);

	const handleDialogConfirm = useCallback(() => {
		setLocale(dialogTargetLocale);
		const localeParam =
			dialogTargetLocale === DEFAULT_LOCALE ? undefined : dialogTargetLocale;
		navigate({ to: "/{-$locale}/", params: { locale: localeParam } });
		setDialogOpen(false);
	}, [dialogTargetLocale, navigate, setLocale]);

	const handleDialogCancel = useCallback(() => {
		setDialogOpen(false);
		// Defer focus restoration past Radix Dialog's onCloseAutoFocus phase, which
		// runs after our state flush and would otherwise reset focus to the body
		// (the originating menu item is detached because the dropdown closed first).
		requestAnimationFrame(() => {
			triggerRef.current?.focus();
		});
	}, []);

	return {
		currentLocale,
		renderSwitcher,
		triggerRef,
		localeItems,
		dialogOpen,
		dialogTargetLocale,
		handleDialogConfirm,
		handleDialogCancel,
	};
}

export function Header() {
	const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
	const langSwitcher = useLangSwitcher();
	const {
		currentLocale,
		renderSwitcher,
		triggerRef,
		localeItems,
		dialogOpen,
		dialogTargetLocale,
		handleDialogConfirm,
		handleDialogCancel,
	} = langSwitcher;
	const navLinks = NAV_LABELS[currentLocale];
	const headerStrings = MOBILE_STRINGS[currentLocale];

	return (
		<>
			<header className="sticky top-0 z-50 flex h-16 items-center justify-between border-b border-border bg-background px-6 lg:px-20">
				<Link
					to="/{-$locale}/"
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
					{renderSwitcher && (
						<LanguageMenu
							ref={triggerRef}
							variant="pair"
							items={localeItems}
							currentLocale={currentLocale}
						/>
					)}
					<ThemeToggle locale={currentLocale} />
					<button
						type="button"
						onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
						aria-label={headerStrings.openMenu}
						aria-expanded={mobileMenuOpen}
						aria-controls="mobile-menu"
						className="flex h-10 w-10 items-center justify-center rounded-md text-foreground-secondary lg:hidden"
					>
						<Menu className="h-5 w-5" />
					</button>
				</div>
			</header>

			{mobileMenuOpen && (
				<MobileMenu
					onClose={() => setMobileMenuOpen(false)}
					langSwitcher={langSwitcher}
				/>
			)}

			{renderSwitcher && (
				<MissingTwinDialog
					open={dialogOpen}
					currentLocale={currentLocale}
					targetLocale={dialogTargetLocale}
					onConfirm={handleDialogConfirm}
					onCancel={handleDialogCancel}
				/>
			)}
		</>
	);
}

function MobileMenu({
	onClose,
	langSwitcher,
}: {
	onClose: () => void;
	langSwitcher: ReturnType<typeof useLangSwitcher>;
}) {
	const { currentLocale, renderSwitcher, localeItems } = langSwitcher;
	const navLinks = NAV_LABELS[currentLocale];
	const mobileStrings = MOBILE_STRINGS[currentLocale];

	// Wrap onClick to close the mobile menu before handling locale switch
	const mobileLocaleItems: LanguageMenuItemConfig[] = localeItems.map(
		(item) => ({
			...item,
			onClick: () => {
				onClose();
				item.onClick?.();
			},
		}),
	);

	return (
		<div
			id="mobile-menu"
			className="fixed inset-0 z-50 bg-background lg:hidden"
		>
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
				<ThemeToggle locale={currentLocale} />
				<span className="text-sm text-foreground-secondary">
					{mobileStrings.toggleTheme}
				</span>
				{renderSwitcher && (
					<LanguageMenu
						variant="list"
						items={mobileLocaleItems}
						currentLocale={currentLocale}
					/>
				)}
			</div>
		</div>
	);
}
