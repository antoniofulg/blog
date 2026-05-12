import { getPublishedPostsFn } from "#/db/queries";
import { LOCALES, type Locale } from "#/lib/locale";

export function validateLocaleFn(lang: string): Locale {
	if (!(LOCALES as readonly string[]).includes(lang)) {
		throw new Error(
			`Invalid locale: "${lang}". Expected one of: ${LOCALES.join(", ")}`,
		);
	}
	return lang as Locale;
}

export function getLocalePostsFn(lang: Locale) {
	return getPublishedPostsFn(lang);
}
