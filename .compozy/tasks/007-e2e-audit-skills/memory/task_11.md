# Task Memory: task_11.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Build `app/lib/content-audit/link-parser.server.ts` — AST-based MDX link extractor using `unified` + `remark-parse` + `remark-mdx` + `unist-util-visit`. Expose `extractLinks(filePath): Promise<Link[]>`.

## Important Decisions

- `vite.config.ts` stub already had `#/lib/content-audit/link-parser.server` and `extractLinks=null` before this task started — no vite.config change needed.
- Import order: `node:fs/promises` first, then type imports (`mdast-util-mdx-jsx`), then value imports sorted alphabetically (biome organizeImports requirement).
- `nodeStart` function signature must be multi-line to satisfy biome formatter (long inline signature fails format check).
- Dynamic expression hrefs (`href={someVar}`) emit `console.warn` and return `null` — caller receives no link entry.
- Literal template/quoted expressions (`href={"/foo"}`, `href={'bar'}`) are extracted via regex `^["'\`]([^"'\`]*)["'\`]$`.

## Learnings

- `mdast-util-mdx-jsx` provides `MdxJsxAttribute`, `MdxJsxFlowElement`, `MdxJsxTextElement` types — already a transitive dep of `@mdx-js/mdx`.
- Boolean href (`<a href>`) has `hrefAttr.value === null` — falls through to `return null` path naturally.
- `glob` from `node:fs/promises` is experimental in Node — triggers ExperimentalWarning in tests; non-blocking.
- `close timed out after 10000ms` at end of vitest runs — pre-existing Vite issue, not a failure.
- `afterEach`/`beforeEach` imported but unused in test file — biome `noUnusedImports` error; removed.

## Files / Surfaces

- NEW: `app/lib/content-audit/link-parser.server.ts`
- NEW: `app/tests/link-parser.test.ts`
- NEW: `app/tests/fixtures/link-parser/` (7 fixture files: empty, expression-attr, jsx-a, jsx-link, markdown-links, mixed, no-href)
- NOT MODIFIED: `vite.config.ts` (stub already present)

## Errors / Corrections

- Biome `organizeImports`: type imports must come before value imports — fixed by reordering.
- Biome formatter: `nodeStart` signature too long on one line — split to multi-line.
- Biome `noUnusedImports`: `afterEach`/`beforeEach` unused — removed from test imports.

## Ready for Next Run

- task_12 (`checks.server.ts`) can start: `extractLinks()` exported and tested.
- `extractLinks` accepts absolute file path, returns `Link[]` with `href`, `line`, `column`, `kind`.
- No follow-up risks for this task.
