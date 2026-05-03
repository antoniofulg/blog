# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Implement `app/db/indexer.ts` with `upsertPost`, `removePost`, `syncAll`. All 11 tests passing. Status: **completed**.

## Important Decisions

- Lightweight regex frontmatter parser (no `gray-matter` dep, no task_08 yet) defined locally in `parseFrontmatterBlock`
- Node.js `readdir({ withFileTypes: true })` recursive walk for `findMdxFiles` — no external glob dep
- `like(posts.filePath, \`${contentDir}/%\`)` for orphan scoping in `syncAll`
- Split unit/integration tests into two files — `vi.mock` at module scope blocked real db in integration tests

## Files / Surfaces

- `app/db/indexer.ts` — new, all three exports
- `app/tests/task-05-indexer.test.ts` — unit tests (8), mocks `#/db/client`
- `app/tests/task-05-indexer-integ.test.ts` — integration tests (5), uses real db
- `app/tests/fixtures/hello.mdx` — fixture with slug field
- `app/tests/fixtures/no-slug.mdx` — fixture without slug field
- `content/` — created (empty), referenced in project structure

## Learnings

- Vitest `vi.mock` at module scope mocks the module for ALL tests in the file — must split unit/integ into separate files if integ needs real module
- Use `let sql!: Type` (definite assignment assertion) instead of `| undefined` + postfix `!` to avoid Biome `noNonNullAssertion` lint warnings
- Biome `biome-ignore` suppression comment must be on the line immediately before the violating code; when biome wraps a long line, the comment may no longer be adjacent

## Ready for Next Run

Task 06 (File Watcher) can start — depends on `upsertPost` and `removePost` from `app/db/indexer.ts`.
Task 07 (Manual Sync Script) can start — depends on `syncAll` from `app/db/indexer.ts`.
