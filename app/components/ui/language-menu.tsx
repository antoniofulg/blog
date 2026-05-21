import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Check, ChevronDown, Languages } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { DEFAULT_LOCALE, LOCALES, type Locale, useLocale } from "#/lib/locale";

const localeLabel: Record<Locale, string> = {
	en: "English",
	"pt-br": "Português",
};

const localeCode: Record<Locale, string> = {
	en: "EN",
	"pt-br": "PT",
};

const triggerLabelByLocale: Record<Locale, string> = {
	en: "Change language",
	"pt-br": "Trocar idioma",
};

const sectionLabelByLocale: Record<Locale, string> = {
	en: "Language",
	"pt-br": "Idioma",
};

type Variant = "dropdown" | "list";

type Props = {
	variant?: Variant;
	onAfterChange?: () => void;
};

function useSwitchLocale() {
	const { setLocale } = useLocale();
	const navigate = useNavigate();
	const pathname = useRouterState({ select: (s) => s.location.pathname });

	const currentLocale: Locale =
		(LOCALES.find((l) => pathname.startsWith(`/${l}/`)) as
			| Locale
			| undefined) ?? DEFAULT_LOCALE;

	function switchTo(target: Locale) {
		if (target === currentLocale) return;
		setLocale(target);
		const prefix = `/${currentLocale}/`;
		const localeParam = target === DEFAULT_LOCALE ? undefined : target;
		if (pathname.startsWith(prefix)) {
			const rest = pathname.slice(prefix.length).replace(/\/$/, "");
			if (rest === "" || rest === "blog") {
				navigate({ to: "/{-$locale}/", params: { locale: localeParam } });
			} else if (rest === "about") {
				navigate({
					to: "/{-$locale}/about/",
					params: { locale: localeParam },
				});
			} else {
				navigate({
					to: "/{-$locale}/$slug/",
					params: { locale: localeParam, slug: rest },
				});
			}
		} else if (pathname === "/about") {
			navigate({
				to: "/{-$locale}/about/",
				params: { locale: localeParam },
			});
		} else {
			navigate({ to: "/{-$locale}/", params: { locale: localeParam } });
		}
	}

	return { currentLocale, switchTo };
}

export function LanguageMenu({ variant = "dropdown", onAfterChange }: Props) {
	const { currentLocale, switchTo } = useSwitchLocale();

	function handleSelect(locale: Locale) {
		switchTo(locale);
		onAfterChange?.();
	}

	if (variant === "list") {
		return (
			<div className="flex flex-col">
				<span
					id={`lang-section-${currentLocale}`}
					className="px-5 pt-6 pb-2 text-xs font-semibold uppercase tracking-[0.18em] text-foreground-muted"
				>
					{sectionLabelByLocale[currentLocale]}
				</span>
				<ul
					aria-labelledby={`lang-section-${currentLocale}`}
					className="flex flex-col px-5"
				>
					{LOCALES.map((locale) => {
						const isActive = locale === currentLocale;
						return (
							<li key={locale}>
								<button
									type="button"
									onClick={() => handleSelect(locale)}
									aria-current={isActive ? "true" : undefined}
									className={`flex h-13 w-full items-center justify-between border-b border-border text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
										isActive
											? "text-foreground"
											: "text-foreground-secondary hover:text-foreground"
									}`}
								>
									<span>{localeLabel[locale]}</span>
									{isActive && (
										<Check className="h-5 w-5 text-accent" aria-hidden="true" />
									)}
								</button>
							</li>
						);
					})}
				</ul>
			</div>
		);
	}

	return (
		<LanguageDropdown currentLocale={currentLocale} onSelect={handleSelect} />
	);
}

function LanguageDropdown({
	currentLocale,
	onSelect,
}: {
	currentLocale: Locale;
	onSelect: (locale: Locale) => void;
}) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const menuId = useId();

	// Close on outside pointer down.
	useEffect(() => {
		if (!open) return;
		function handle(event: MouseEvent) {
			const target = event.target as Node;
			if (
				!triggerRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handle);
		return () => document.removeEventListener("mousedown", handle);
	}, [open]);

	// Close on focus leaving the disclosure (Tab-out).
	useEffect(() => {
		if (!open) return;
		function handle(event: FocusEvent) {
			const target = event.target as Node;
			if (
				!triggerRef.current?.contains(target) &&
				!menuRef.current?.contains(target)
			) {
				setOpen(false);
			}
		}
		document.addEventListener("focusin", handle);
		return () => document.removeEventListener("focusin", handle);
	}, [open]);

	// Close on Escape, return focus to trigger.
	useEffect(() => {
		if (!open) return;
		function handle(event: KeyboardEvent) {
			if (event.key === "Escape") {
				setOpen(false);
				triggerRef.current?.focus();
			}
		}
		document.addEventListener("keydown", handle);
		return () => document.removeEventListener("keydown", handle);
	}, [open]);

	// Focus the active item when the menu opens.
	useEffect(() => {
		if (!open) return;
		const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
			'[role="menuitemradio"]',
		);
		if (!items || items.length === 0) return;
		const active = Array.from(items).find(
			(el) => el.getAttribute("aria-checked") === "true",
		);
		(active ?? items[0])?.focus();
	}, [open]);

	function handleSelect(locale: Locale) {
		onSelect(locale);
		setOpen(false);
		triggerRef.current?.focus();
	}

	function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		const items = menuRef.current?.querySelectorAll<HTMLButtonElement>(
			'[role="menuitemradio"]',
		);
		if (!items || items.length === 0) return;
		const active = document.activeElement as HTMLElement | null;
		const idx = Array.from(items).indexOf(active as HTMLButtonElement);

		if (event.key === "ArrowDown") {
			event.preventDefault();
			const next = (idx + 1 + items.length) % items.length;
			items[next]?.focus();
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			const prev = (idx - 1 + items.length) % items.length;
			items[prev]?.focus();
		} else if (event.key === "Home") {
			event.preventDefault();
			items[0]?.focus();
		} else if (event.key === "End") {
			event.preventDefault();
			items[items.length - 1]?.focus();
		}
	}

	return (
		<div className="relative">
			<button
				ref={triggerRef}
				type="button"
				aria-haspopup="menu"
				aria-expanded={open}
				aria-controls={menuId}
				aria-label={triggerLabelByLocale[currentLocale]}
				onClick={() => setOpen((o) => !o)}
				className="flex h-11 items-center gap-1.5 rounded-md bg-surface px-2.5 text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background"
			>
				<Languages className="h-4 w-4" aria-hidden="true" />
				<span className="text-xs font-semibold">
					{localeCode[currentLocale]}
				</span>
				<ChevronDown
					className={`h-3 w-3 text-foreground-muted transition-transform ${open ? "rotate-180" : ""}`}
					aria-hidden="true"
				/>
			</button>

			{open && (
				<div
					ref={menuRef}
					id={menuId}
					role="menu"
					aria-label={triggerLabelByLocale[currentLocale]}
					onKeyDown={handleMenuKeyDown}
					className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-lg border border-border bg-card shadow-md"
				>
					<ul className="py-1">
						{LOCALES.map((locale) => {
							const isActive = locale === currentLocale;
							return (
								<li key={locale} role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={isActive}
										onClick={() => handleSelect(locale)}
										className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none ${
											isActive
												? "font-medium text-foreground"
												: "text-foreground-secondary"
										}`}
									>
										<span>{localeLabel[locale]}</span>
										{isActive && (
											<Check
												className="h-4 w-4 text-accent"
												aria-hidden="true"
											/>
										)}
									</button>
								</li>
							);
						})}
					</ul>
				</div>
			)}
		</div>
	);
}
