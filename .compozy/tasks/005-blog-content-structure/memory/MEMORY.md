# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 (DB Schema & Migration): **completed**
- task_02 (Content Folder Restructure): **completed**
- task_04 (Locale System): **completed** — `app/lib/locale.tsx` live with all exports
- task_05 (Root Wrapper + Locale Layout Route): **completed** — `__root.tsx` wraps in `LocaleProvider`; `$lang.tsx` layout route live
- task_06 (Locale Blog Listing Route): **completed** — `$lang/blog.tsx` live; `lang-blog-route.test.ts` live
- task_07 (Locale Post Detail Route): **completed** — `$lang/$slug.tsx` live; `translation-notice.tsx` live; `lang-slug-route.test.ts` live
- task_08 (Legacy Route Redirects): **completed** — `index.tsx`, `blog.tsx`, `$slug.tsx` all strip data-fetch; redirect to `/$lang/blog` or `/$lang/$slug` via `detectLocaleFromRequest(getRequest())` in createServerFn
- task_09 (Language Switcher in Header): **completed** — `app/components/layout/header.tsx` updated; `app/tests/header.test.ts` created
- task_10 (Conventions, CONTENT.md & Frontmatter Lint): **completed**
- task_03 (Indexer & Queries Update): **completed**

## Shared Decisions

- Composite unique constraint `UNIQUE(slug, lang)` named `posts_slug_lang_unique` in DB — the slug column itself no longer has `isUnique: true`

## Shared Learnings

- `app/tests/drizzle-schema.test.ts` contains type-fixture tests and integration tests (column count, constraint checks) that must be updated alongside any `posts` schema change — it is not auto-verified by tsc alone
- Existing DB has 2 posts (not 3 as referenced in task specs) — PRD estimate was off; both rows received `lang='en'` via DEFAULT after migration
- jsdom React component tests: `@testing-library/react` auto-cleanup does NOT fire between tests — call `cleanup()` explicitly in each `afterEach`; also stub `window.matchMedia` when rendering `ThemeProvider`

## Open Risks

- DB re-indexed (task_03): all 3 rows have absolute `filePath` values pointing to `content/en/`, `lang='en'`, stale paths removed

## Handoffs

- task_03 depends on task_01 (schema) and task_02 (file move) — both complete ✓
- task_03: update indexer to derive `lang` from path prefix; run re-index to fix stale `filePath` values
- task_06 complete — `$lang/blog.tsx` nested under `$lang.tsx`; route type system includes `/$lang/blog`; `as never` cast in `$lang.tsx` line 7 can be removed in a cleanup task
- `bunx tsr generate` does NOT work in this project — route tree regenerates only via Vite dev server (`tanstackStart` plugin)
