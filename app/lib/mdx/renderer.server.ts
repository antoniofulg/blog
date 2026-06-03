import { compile, run } from "@mdx-js/mdx";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { MDXContent } from "mdx/types";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";
import { copyButtonTransformer } from "#/lib/mdx/copy-button.transformer";

/**
 * Shiki transformers applied to every fenced block (ADR-003). The copy-button
 * transformer stashes raw source on each `<pre>` and injects the copy button;
 * the localized label + click handler are wired client-side (task_04). Created
 * once at module load — the transformer is stateless config (its `pre` hook
 * reads per-block `this.source`), so a single instance is reused across renders.
 * Exported so a unit test can assert it is registered in the shiki pipeline.
 */
export const shikiTransformers = [copyButtonTransformer()];

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
 */
export async function renderMdx(body: string): Promise<MDXContent> {
	const highlighter = await getHighlighter();
	const compiled = await compile(body, {
		outputFormat: "function-body",
		remarkPlugins: [remarkGfm],
		rehypePlugins: [
			() =>
				rehypeShikiFromHighlighter(highlighter, {
					themes: { light: "github-light", dark: "github-dark" },
					transformers: shikiTransformers,
				}),
		],
	});
	const { default: Content } = await run(compiled, {
		...runtime,
		baseUrl: import.meta.url,
	});
	return Content as MDXContent;
}
