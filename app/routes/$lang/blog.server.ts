import { createServerFn } from "@tanstack/react-start";
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

export const getLocalePosts = createServerFn({ method: "GET" })
	.inputValidator(validateLocaleFn)
	.handler(({ data: lang }) => getPublishedPostsFn(lang));
