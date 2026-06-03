import { compile, run } from "@mdx-js/mdx";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { MDXContent } from "mdx/types";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { strings } from "#/lib/i18n/strings";
import type { Locale } from "#/lib/locale";
import { copyButtonTransformer } from "#/lib/mdx/copy-button.transformer";

/**
 * Build the shiki transformer pipeline for one render (ADR-003). The copy-button
 * transformer stashes raw source on each `<pre>`, injects the copy button, and
 * bakes the localized static `aria-label` into the SSR markup so the pre-JS /
 * no-JS button is named in the reader's language (issue 002); the click handler is
 * wired client-side (task_04). Built per render because the static label is
 * locale-specific — the transformer is otherwise stateless config (its `pre` hook
 * reads per-block `this.source`).
 */
export function buildShikiTransformers(copyLabel: string) {
	return [copyButtonTransformer(copyLabel)];
}

/**
 * Default (English) pipeline. Exported so a unit test can assert the copy-button
 * transformer is registered; `renderMdx` builds a locale-specific pipeline per call.
 */
export const shikiTransformers = buildShikiTransformers(
	strings.en.codeCopy.copy,
);

let highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null;

function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [
				import("@shikijs/themes/github-light"),
				import("@shikijs/themes/github-dark"),
			],
			langs: [
				import("@shikijs/langs/typescript"),
				import("@shikijs/langs/javascript"),
				import("@shikijs/langs/jsx"),
				import("@shikijs/langs/tsx"),
				import("@shikijs/langs/json"),
				import("@shikijs/langs/bash"),
				import("@shikijs/langs/markdown"),
				import("@shikijs/langs/css"),
				import("@shikijs/langs/html"),
				import("@shikijs/langs/yaml"),
				import("@shikijs/langs/python"),
			],
			engine: createJavaScriptRegexEngine(),
		});
	}
	return highlighterPromise;
}

/**
 * Compile an MDX **body** (no frontmatter) into a React component.
 *
 * The caller is responsible for stripping frontmatter before calling — pass
 * the `content` field from `gray-matter`, not the raw file source. Passing a
 * source that still begins with a `---\n…\n---` block will cause `@mdx-js/mdx`
 * to parse it as a setext H1 and render the raw YAML.
 *
 * See `loadStaticPage` and `getPostBySlugWithLangFn` for the two call sites
 * that perform the strip.
 *
 * `lang` localizes the compile-time enhancement markup (the copy button's static
 * `aria-label`) so the SSR HTML is bilingual before client JS runs (issue 002).
 * The caller passes the language of the body being rendered; defaults to `en`.
 */
export async function renderMdx(
	body: string,
	lang: Locale = "en",
): Promise<MDXContent> {
	const highlighter = await getHighlighter();
	const transformers = buildShikiTransformers(strings[lang].codeCopy.copy);
	const compiled = await compile(body, {
		outputFormat: "function-body",
		remarkPlugins: [remarkGfm],
		rehypePlugins: [
			() =>
				rehypeShikiFromHighlighter(highlighter, {
					themes: { light: "github-light", dark: "github-dark" },
					transformers,
				}),
		],
	});
	const { default: Content } = await run(compiled, {
		...runtime,
		baseUrl: import.meta.url,
	});
	return Content as MDXContent;
}
