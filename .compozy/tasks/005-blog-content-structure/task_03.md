---
status: completed
title: Indexer & Queries Update
type: backend
complexity: medium
dependencies:
    - task_01
    - task_02
---

# Task 03: Indexer & Queries Update

## Overview

Update `app/db/indexer.ts` to derive the `lang` value from the file path directory name and read the new frontmatter fields (`category`, `series`, `seriesPart`, `draft`) into the DB. Update `app/db/queries.ts` to accept a `lang` parameter and filter out draft posts. Re-index all content to update stale `filePath` values after the task_02 file move.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `parseFrontmatterBlock` to read `category`, `series`, `seriesPart` (as integer), and `draft` (as boolean) from frontmatter
- MUST update `upsertPost` to derive `lang` from the parent directory name of `filePath` (e.g., `content/en/file.mdx` → `lang = 'en'`; `content/pt-br/file.mdx` → `lang = 'pt-br'`)
- MUST include `lang`, `category`, `series`, `seriesPart`, `draft` in the `upsertPost` INSERT and `onConflictDoUpdate` SET clause
- MUST update `getPublishedPostsFn` in `app/db/queries.ts` to accept `lang: string` parameter and add `AND lang = $lang AND draft IS NOT TRUE` to the WHERE clause
- MUST trigger a re-index of all content after code changes (run `syncAll('content/')` or equivalent) so stale `filePath` values from task_02 are corrected in DB
- MUST NOT change the upsert conflict target — it remains `filePath` (already unique per locale file)
- MUST update `app/tests/indexer.test.ts` to cover: lang derivation from path, new fields persisted in upsert, category value passed through
</requirements>

## Subtasks

- [x] 3.1 Update `parseFrontmatterBlock` — add reading of `category`, `series`, `seriesPart`, `draft` fields
- [x] 3.2 Update `upsertPost` — derive `lang` from `dirname(filePath)` last segment; include all new fields in INSERT/UPDATE
- [x] 3.3 Update `getPublishedPostsFn` in `queries.ts` — add `lang` param; filter by `lang` and `draft IS NOT TRUE`
- [x] 3.4 Trigger re-index: start dev server (watcher auto-runs) or manually call `syncAll('content/')` to fix stale filePath values
- [x] 3.5 Update `indexer.test.ts` — add test cases for lang derivation and new field persistence

## Implementation Details

See TechSpec "Core Interfaces → Post query with locale" for the `getPublishedPostsFn` signature and "Development Sequencing → steps 4-6" for the precise change order.

Lang derivation: the second-to-last path segment of `filePath` is the locale directory name. For `content/en/react-suspense.mdx`, `path.dirname(filePath)` gives `content/en`, and `path.basename(path.dirname(filePath))` gives `'en'`.

The `syncAll` cleanup query `like(posts.filePath, '${contentDir}/%')` must receive `content/` (not a locale subdir) to handle posts from all locales. Verify `scripts/watcher.ts` passes `join(process.cwd(), "content")` unchanged.

### Relevant Files

- `app/db/indexer.ts` — primary file to modify; `parseFrontmatterBlock`, `upsertPost`, `syncAll`
- `app/db/queries.ts` — add `lang` param to `getPublishedPostsFn`
- `app/db/schema.ts` — reference for new column names (from task_01)
- `app/tests/indexer.test.ts` — update mocks and add new test cases
- `scripts/watcher.ts` — verify `contentDir` is still `content/` parent (no change needed)

### Dependent Files

- `app/routes/$lang/blog.tsx` — task_06 calls `getPublishedPostsFn(lang)` with the lang param added here
- `app/routes/$lang/$slug.tsx` — task_07 queries posts by `(slug, lang)`; depends on `lang` column being populated
- `app/routes/index.tsx` — task_08 replaces its data fetch call; will no longer call `getPublishedPostsFn` directly
- `app/routes/blog.tsx` — task_08 replaces with redirect; no longer calls `getPublishedPostsFn`

### Related ADRs

- [ADR-003: Expand V1 scope to include locale routing and language switcher](adrs/adr-003.md) — lang derivation from path is the zero-configuration design decision

## Deliverables

- Updated `app/db/indexer.ts` deriving `lang` from file path and persisting all new fields
- Updated `app/db/queries.ts` with `lang` parameter and draft filter
- Re-indexed posts in DB: all 3 posts have `lang='en'` and updated `filePath` values pointing to `content/en/`
- Updated `app/tests/indexer.test.ts` covering new behavior
- `make test` exits 0

## Tests

- Unit tests:
  - [x] `upsertPost('content/en/react-suspense.mdx')` → DB row has `lang = 'en'`
  - [x] `upsertPost('content/pt-br/react-suspense.mdx')` → DB row has `lang = 'pt-br'`
  - [x] `parseFrontmatterBlock` with `category: frontend` in YAML → `category = 'frontend'` persisted
  - [x] `parseFrontmatterBlock` with `series: my-series` and `seriesPart: 2` → both persisted correctly
  - [x] `parseFrontmatterBlock` with `draft: true` → `draft = true` persisted
  - [x] `getPublishedPostsFn('en')` mock verifies `lang = 'en'` and `draft IS NOT TRUE` filters applied
  - [x] `getPublishedPostsFn('pt-br')` mock verifies `lang = 'pt-br'` filter
- Integration tests:
  - [x] After re-index, `SELECT filePath, lang FROM posts` shows `content/en/lorem-ipsum.mdx` with `lang='en'`
  - [x] After re-index, old stale filePaths (`content/lorem-ipsum.mdx`) no longer exist in DB
- Test coverage target: >=80% on modified functions
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- All 3 posts in DB have `filePath` pointing to `content/en/` and `lang = 'en'`
- `getPublishedPostsFn('en')` returns only published, non-draft English posts
- Stale `content/*.mdx` filePaths no longer exist in DB
