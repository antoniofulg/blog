import { Fragment, forwardRef, useCallback } from "react";
import { LOCALES, type Locale } from "#/lib/locale";

const localeLabel: Record<Locale, string> = {
	en: "English",
	"pt-br": "Português",
};

const localeCode: Record<Locale, string> = {
	en: "EN",
	"pt-br": "PT",
};

const sectionLabelByLocale: Record<Locale, string> = {
	en: "Language",
	"pt-br": "Idioma",
};

// Voice-fragment hint: matches PRODUCT.md's "patient, precise, generous" tone
// without the procedural feel of "(not available)". Reads as the author's
// shorthand: this twin doesn't exist in the visitor's target locale.
const NO_TRANSLATION_HINT: Record<Locale, string> = {
	en: "no translation",
	"pt-br": "sem tradução",
};

const switchActionByLocale: Record<Locale, (target: string) => string> = {
	en: (target) => `Switch to ${target}`,
	"pt-br": (target) => `Mudar para ${target}`,
};

const currentLabelByLocale: Record<Locale, string> = {
	en: "current language",
	"pt-br": "idioma atual",
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
			<LanguagePair ref={ref} items={items} currentLocale={currentLocale} />
		);
	},
);

// ─── Desktop: typographic pair ────────────────────────────────────────────────
// The whole switcher IS the current state. No popup, no chevron, no check
// icon. Active locale is bold foreground, alternate is muted and clickable.
// Click the alternate → navigate (if twin exists) or open modal (if not).
// Distilled from the prior dropdown variant per DESIGN.md "type is the
// architecture; color is a small set of deliberate marks".

const LanguagePair = forwardRef<
	HTMLButtonElement,
	{
		items: LanguageMenuItemConfig[];
		currentLocale: Locale;
	}
>(function LanguagePair({ items, currentLocale }, ref) {
	const hint = NO_TRANSLATION_HINT[currentLocale];
	const switchAction = switchActionByLocale[currentLocale];

	// Ref callback: forward the FIRST non-current button to the parent. That's
	// the button the missing-twin dialog's focus-restore should land on after
	// the user cancels.
	const setRef = useCallback(
		(node: HTMLButtonElement | null) => {
			if (typeof ref === "function") ref(node);
			else if (ref)
				(ref as React.MutableRefObject<HTMLButtonElement | null>).current =
					node;
		},
		[ref],
	);

	let firstAlternateAssigned = false;

	return (
		<div className="inline-flex items-center gap-1.5 text-sm">
			{LOCALES.map((locale, idx) => {
				const isActive = locale === currentLocale;
				const item = getItemFor(items, locale);
				const isAvailable = isActive || item?.available !== false;
				const fullName = item?.label ?? localeLabel[locale];
				const accessibleLabel = isActive
					? `${fullName}, ${currentLabelByLocale[currentLocale]}`
					: isAvailable
						? switchAction(fullName)
						: `${switchAction(fullName)}, ${hint}`;

				const assignRef = !isActive && !firstAlternateAssigned;
				if (assignRef) firstAlternateAssigned = true;

				return (
					<Fragment key={locale}>
						{idx > 0 && (
							<span
								aria-hidden="true"
								className="select-none text-foreground-muted"
							>
								·
							</span>
						)}
						<button
							ref={assignRef ? setRef : undefined}
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
							className={`rounded-sm px-0.5 font-mono text-xs tracking-wide transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
								isActive
									? "font-semibold text-foreground"
									: isAvailable
										? "text-foreground-secondary hover:text-foreground"
										: "text-foreground-muted hover:text-foreground-secondary"
							}`}
						>
							{localeCode[locale]}
						</button>
					</Fragment>
				);
			})}
		</div>
	);
});

// ─── Mobile: stacked list inside the mobile menu drawer ───────────────────────

function LanguageList({
	items,
	currentLocale,
}: {
	items: LanguageMenuItemConfig[];
	currentLocale: Locale;
}) {
	const hint = NO_TRANSLATION_HINT[currentLocale];
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
					const accessibleLabel = !isAvailable ? `${label}, ${hint}` : label;
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
								className={`flex h-13 w-full items-center justify-between border-b border-border text-base transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
									isActive
										? "font-semibold text-foreground"
										: isAvailable
											? "font-medium text-foreground-secondary hover:text-foreground"
											: "font-medium text-foreground-muted hover:text-foreground-secondary"
								}`}
							>
								<span>{label}</span>
								{!isActive && !isAvailable && (
									<span
										aria-hidden="true"
										className="font-normal text-xs text-foreground-muted"
									>
										{hint}
									</span>
								)}
							</button>
						</li>
					);
				})}
			</ul>
		</div>
	);
}
