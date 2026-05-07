import { compile, run } from "@mdx-js/mdx";
import rehypeShikiFromHighlighter from "@shikijs/rehype/core";
import type { ComponentType } from "react";
import * as runtime from "react/jsx-runtime";
import remarkGfm from "remark-gfm";
import { createHighlighterCore } from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

let highlighterPromise: ReturnType<typeof createHighlighterCore> | null = null;

function getHighlighter() {
	if (!highlighterPromise) {
		highlighterPromise = createHighlighterCore({
			themes: [import("@shikijs/themes/github-dark")],
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

export async function renderMdx(source: string): Promise<ComponentType> {
	const highlighter = await getHighlighter();
	const compiled = await compile(source, {
		outputFormat: "function-body",
		remarkPlugins: [remarkGfm],
		rehypePlugins: [
			() => rehypeShikiFromHighlighter(highlighter, { theme: "github-dark" }),
		],
	});
	const { default: Content } = await run(compiled, {
		...runtime,
		baseUrl: import.meta.url,
	});
	return Content as ComponentType;
}
