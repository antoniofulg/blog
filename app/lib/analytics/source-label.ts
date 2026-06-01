import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";

/**
 * Resolve a raw `analytics_events.referrer_source` value to its display
 * label for the given locale.
 *
 * The argument is typed `string` rather than `ReferrerSource` on purpose:
 * the analytics queries surface source values as plain strings, and the
 * stacked-bar gap-fill injects a `__gap__` sentinel that is NOT a real
 * bucket. Any value missing from the label map (the sentinel, or a future
 * bucket added to the DB before the i18n table catches up) falls back to
 * the raw value so the UI degrades to the stored string instead of
 * rendering `undefined`.
 */
export function resolveSourceLabel(source: string, locale: Locale): string {
	const labels = strings[locale].admin.analytics.sources as Record<
		string,
		string | undefined
	>;
	return labels[source] ?? source;
}

/**
 * Resolve a raw `analytics_events.lang` value (`en` / `pt-br`) to its display
 * label for the given UI locale (e.g. `en` → "English" / "Inglês"). Falls back
 * to the raw value for any unexpected language code so the UI degrades to the
 * stored string rather than rendering `undefined`.
 */
export function resolveLanguageLabel(lang: string, locale: Locale): string {
	const labels = strings[locale].admin.analytics.languages as Record<
		string,
		string | undefined
	>;
	return labels[lang] ?? lang;
}
