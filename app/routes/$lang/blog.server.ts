import { createServerFn } from "@tanstack/react-start";
import { getPublishedPostsFn } from "#/db/queries";
import type { Locale } from "#/lib/locale";

export const getLocalePosts = createServerFn({ method: "GET" })
	.inputValidator((lang: string) => lang)
	.handler(({ data: lang }) => getPublishedPostsFn(lang as Locale));
