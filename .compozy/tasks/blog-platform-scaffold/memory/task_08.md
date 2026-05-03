# Task Memory: task_08.md

## Objective Snapshot

Fix two bugs in `app/lib/mdx.server.ts` (task was marked completed but had failing tests):
1. `parseFrontmatter` returned Date object `.toString()` instead of `"YYYY-MM-DD"`
2. `renderMdx` used `@shikijs/rehype` default (WASM engine) which crashes Vitest

## Important Decisions

- Switched from `@shikijs/rehype` (uses `getSingletonHighlighter` → oniguruma WASM) to `@shikijs/rehype/core` (`rehypeShikiFromHighlighter`) + `createHighlighterCore` from `shiki/core` + `createJavaScriptRegexEngine` from `shiki/engine/javascript`
- JavaScript regex engine avoids WASM entirely; works in Vitest and production
- Bundled 11 specific langs (ts/js/jsx/tsx/json/bash/md/css/html/yaml/python) instead of all langs — reduces startup overhead
- Highlighter cached in module-level `highlighterPromise` (singleton)
- Plugin wired as `() => rehypeShikiFromHighlighter(highlighter, { theme: "github-dark" })` — closure captures awaited highlighter; unified treats return value as Transformer

## Learnings

- `gray-matter` auto-parses YAML date-only fields (e.g., `2026-05-02`) as JS `Date` objects; use `instanceof Date` check and `.toISOString().slice(0, 10)` to get `"YYYY-MM-DD"`
- Shiki 4.x WASM engine (`onig.wasm`) causes `ERR_UNKNOWN_FILE_EXTENSION` in Vitest node environment; JS engine is the correct fix
- `@shikijs/rehype/core` exports `rehypeShikiFromHighlighter(highlighter, options): Transformer` — not a plugin factory; must wrap in `() =>` for unified/MDX `rehypePlugins`
- `shiki/core` exports `createHighlighterCore`; `shiki/engine/javascript` exports `createJavaScriptRegexEngine`; `@shikijs/langs/<name>` and `@shikijs/themes/<name>` are individual imports

## Files / Surfaces

- `app/lib/mdx.server.ts` — rewritten (parseFrontmatter Date fix + JS engine)

## Errors / Corrections

- Pre-existing: `task-09-public-routes.test.ts` has 3 failing tests unrelated to task_08 (createServerFn stripping in mocks, noted in MEMORY.md)

## Ready for Next Run

Task complete. All 9 task-08 tests pass. Biome clean.
