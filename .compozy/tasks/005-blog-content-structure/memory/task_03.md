# Task Memory: task_03.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Update indexer to derive `lang` from file path, read new frontmatter fields, update queries with lang param, re-index content.

## Important Decisions

- All implementation was already present from prior runs (indexer.ts, queries.ts, indexer.test.ts all pre-updated)
- Re-index used `bun run sync` (scripts/sync.ts calls syncAll('content/'))
- DB stores absolute filePaths (e.g., `/Users/antoniofulg/Projects/blog/content/en/...`), not relative

## Learnings

- `bun run -e` flag conflicts with `bun run <script>` — use a temp file for inline DB queries
- `scripts/sync.ts` is the canonical re-index entrypoint; passes `resolve('content')` = absolute path to `syncAll`

## Files / Surfaces

- `app/db/indexer.ts` — already updated; `parseFrontmatterBlock`, `deriveLang`, `upsertPost`, `syncAll`
- `app/db/queries.ts` — already updated; `getPublishedPostsFn(lang: string)`
- `app/tests/indexer.test.ts` — already updated; lang derivation, new field persistence, getPublishedPostsFn tests

## Errors / Corrections

None — all code was already in place.

## Ready for Next Run

task_03 complete. DB verified. `make test`, `make lint`, `make check` all pass.
