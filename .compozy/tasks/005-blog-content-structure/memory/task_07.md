# Task Memory: task_07.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `app/components/ui/translation-notice.tsx` and `app/routes/$lang/$slug.tsx` with a two-query symmetric fallback loader. Add tests in `app/tests/lang-slug-route.test.ts`.

## Important Decisions

- Both queries in the loader end at `.where()` (no explicit `.limit(1)`) so mock chain uses `mockResolvedValueOnce` cleanly without adding a `.limit()` mock node.
- `availableLang` is typed as `Locale | null` — null when `notTranslated: false`, actual lang when `notTranslated: true`. The component guards with `availableLang &&` before rendering `<TranslationNotice>`.
- First query adds `eq(posts.isPublished, true)` so unpublished posts are treated as misses and fall through to the second query.
- Second query (fallback) also adds `eq(posts.isPublished, true)` — only falls back to published posts.
- `PostLoaderResult` type is non-exported (route-local); not in `app/types/` per DB rule (shared types only if used across files).
- `import type { Locale }` required per Biome `useImportType` rule.

## Learnings

- routeTree was already updated before this task ran (dev server or another session) — `LangSlugRoute` was already present; no manual edit needed.
- Biome auto-fix (`bunx biome check --write`) resolves both `useImportType` and formatting issues cleanly.
- `mockResolvedValueOnce` chains work for two sequential `db.select()…where()` calls — first call returns queued value, second call returns next queued value.

## Files / Surfaces

- `app/components/ui/translation-notice.tsx` — NEW
- `app/routes/$lang/$slug.tsx` — NEW (two-query loader, view count, MDX render, head meta)
- `app/tests/lang-slug-route.test.ts` — NEW (14 unit tests + 4 integration tests skipped when ports free)
- `app/routeTree.gen.ts` — already had `$lang/$slug` when task ran

## Errors / Corrections

- Initial import used `import { type Locale }` → Biome requires `import type { Locale }`. Auto-fixed.
- Return object on one line exceeded formatter width → Biome expanded to multi-line. Auto-fixed.
- Test import order was wrong (react before node:*) → Biome reordered. Auto-fixed.
- Chained mock calls were wrapped multiline → Biome inlined to single line. Auto-fixed.

## Ready for Next Run

task_08 (Legacy Route Redirects + Locale Detection) can now proceed. It will convert `app/routes/$slug.tsx` to a redirect and wire `detectLocaleFromRequest` into `index.tsx`, `blog.tsx`, `$slug.tsx`.
