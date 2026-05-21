import { Check, ChevronDown, Languages } from "lucide-react";
import {
	forwardRef,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
} from "react";
import { LOCALES, type Locale } from "#/lib/locale";

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

const NOT_AVAILABLE_HINT: Record<Locale, string> = {
	en: "(not available)",
	"pt-br": "(indisponível)",
};

export type LanguageMenuItemConfig = {
	locale: Locale;
	label?: string;
	available?: boolean;
	onClick?: () => void;
};

type Variant = "dropdown" | "list";

export type LanguageMenuProps = {
	variant?: Variant;
	items: LanguageMenuItemConfig[];
	currentLocale: Locale;
};

function getItemFor(
	items: LanguageMenuItemConfig[],
	locale: Locale,
): LanguageMenuItemConfig | undefined {
	return items.find((i) => i.locale === locale);
}

export const LanguageMenu = forwardRef<HTMLButtonElement, LanguageMenuProps>(
	function LanguageMenu({ variant = "dropdown", items, currentLocale }, ref) {
		if (variant === "list") {
			return <LanguageList items={items} currentLocale={currentLocale} />;
		}
		return (
			<LanguageDropdown ref={ref} items={items} currentLocale={currentLocale} />
		);
	},
);

function LanguageList({
	items,
	currentLocale,
}: {
	items: LanguageMenuItemConfig[];
	currentLocale: Locale;
}) {
	const hint = NOT_AVAILABLE_HINT[currentLocale];
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
					const item = getItemFor(items, locale);
					const isAvailable = isActive || item?.available !== false;
					const label = item?.label ?? localeLabel[locale];
					const accessibleLabel = !isAvailable ? `${label} ${hint}` : label;
					return (
						<li key={locale}>
							<button
								type="button"
								onClick={isActive ? undefined : item?.onClick}
								onKeyDown={(e) => {
									if (isActive) return;
									if (e.key === "Enter" || e.key === " ") {
										e.preventDefault();
										item?.onClick?.();
									}
								}}
								aria-current={isActive ? "true" : undefined}
								aria-disabled={!isAvailable ? "true" : undefined}
								aria-label={accessibleLabel}
								className={`flex h-13 w-full items-center justify-between border-b border-border text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
									isActive
										? "text-foreground"
										: isAvailable
											? "text-foreground-secondary hover:text-foreground"
											: "text-foreground-muted hover:text-foreground-secondary"
								}`}
							>
								<span>
									<span>{label}</span>
									{!isActive && !isAvailable && (
										<span
											aria-hidden="true"
											className="ml-1.5 text-xs text-foreground-muted"
										>
											{hint}
										</span>
									)}
								</span>
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

const LanguageDropdown = forwardRef<
	HTMLButtonElement,
	{
		items: LanguageMenuItemConfig[];
		currentLocale: Locale;
	}
>(function LanguageDropdown({ items, currentLocale }, ref) {
	const [open, setOpen] = useState(false);
	const triggerRef = useRef<HTMLButtonElement>(null);
	const menuRef = useRef<HTMLDivElement>(null);
	const menuId = useId();
	const hint = NOT_AVAILABLE_HINT[currentLocale];

	// Ref callback: sets both internal and parent ref synchronously during commit,
	// and clears the parent ref on unmount (React calls with null).
	const setTriggerRef = useCallback(
		(node: HTMLButtonElement | null) => {
			triggerRef.current = node;
			if (typeof ref === "function") ref(node);
			else if (ref)
				(ref as React.MutableRefObject<HTMLButtonElement | null>).current =
					node;
		},
		[ref],
	);

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
		const elements = menuRef.current?.querySelectorAll<HTMLButtonElement>(
			'[role="menuitemradio"]',
		);
		if (!elements || elements.length === 0) return;
		const active = Array.from(elements).find(
			(el) => el.getAttribute("aria-checked") === "true",
		);
		(active ?? elements[0])?.focus();
	}, [open]);

	function handleItemClick(locale: Locale) {
		const isActive = locale === currentLocale;
		if (isActive) {
			setOpen(false);
			triggerRef.current?.focus();
			return;
		}
		const item = getItemFor(items, locale);
		item?.onClick?.();
		setOpen(false);
		triggerRef.current?.focus();
	}

	function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
		const elements = menuRef.current?.querySelectorAll<HTMLButtonElement>(
			'[role="menuitemradio"]',
		);
		if (!elements || elements.length === 0) return;
		const activeEl = document.activeElement as HTMLElement | null;
		const idx = Array.from(elements).indexOf(activeEl as HTMLButtonElement);

		if (event.key === "ArrowDown") {
			event.preventDefault();
			const next = (idx + 1 + elements.length) % elements.length;
			elements[next]?.focus();
		} else if (event.key === "ArrowUp") {
			event.preventDefault();
			const prev = (idx - 1 + elements.length) % elements.length;
			elements[prev]?.focus();
		} else if (event.key === "Home") {
			event.preventDefault();
			elements[0]?.focus();
		} else if (event.key === "End") {
			event.preventDefault();
			elements[elements.length - 1]?.focus();
		}
	}

	return (
		<div className="relative">
			<button
				ref={setTriggerRef}
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
							const item = getItemFor(items, locale);
							const isAvailable = isActive || item?.available !== false;
							const label = item?.label ?? localeLabel[locale];
							const accessibleLabel = !isAvailable ? `${label} ${hint}` : label;
							return (
								<li key={locale} role="none">
									<button
										type="button"
										role="menuitemradio"
										aria-checked={isActive}
										aria-disabled={!isAvailable ? "true" : undefined}
										aria-label={accessibleLabel}
										onClick={() => handleItemClick(locale)}
										onKeyDown={(e) => {
											if (e.key === "Enter" || e.key === " ") {
												e.preventDefault();
												handleItemClick(locale);
											}
										}}
										className={`flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm transition-colors hover:bg-surface focus-visible:bg-surface focus-visible:outline-none ${
											isActive
												? "font-medium text-foreground"
												: isAvailable
													? "text-foreground-secondary"
													: "text-foreground-muted"
										}`}
									>
										<span>
											<span>{label}</span>
											{!isActive && !isAvailable && (
												<span
													aria-hidden="true"
													className="ml-1.5 text-xs text-foreground-muted"
												>
													{hint}
												</span>
											)}
										</span>
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
});
