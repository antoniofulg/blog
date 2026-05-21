import { createServerFn } from "@tanstack/react-start";
import { LOCALES, type Locale } from "#/lib/locale";

export function validateLocaleFn(lang: string): Locale {
	if (!(LOCALES as readonly string[]).includes(lang)) {
		throw new Error(
			`Invalid locale: "${lang}". Expected one of: ${LOCALES.join(", ")}`,
		);
	}
	return lang as Locale;
}

export async function getLocalePostsFn(lang: Locale) {
	const { listPostsFn } = await import("#/db/queries");
	return listPostsFn(lang);
}

export const getLocalePosts = createServerFn({ method: "GET" })
	.inputValidator(validateLocaleFn)
	.handler(({ data: lang }) => getLocalePostsFn(lang));
