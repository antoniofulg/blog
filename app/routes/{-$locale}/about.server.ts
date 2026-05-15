import { createServerFn } from "@tanstack/react-start";
import { LOCALES, type Locale } from "#/lib/locale";
import { loadAbout } from "#/lib/mdx/about.server";

export type { AboutContent } from "#/lib/mdx/about.server";

function validateLocale(data: string): Locale {
	if (!(LOCALES as readonly string[]).includes(data)) {
		throw new Error(
			`Invalid locale: "${data}". Expected one of: ${LOCALES.join(", ")}`,
		);
	}
	return data as Locale;
}

export const loadAboutFn = createServerFn({ method: "GET" })
	.inputValidator(validateLocale)
	.handler(async ({ data: locale }) => loadAbout(locale));
