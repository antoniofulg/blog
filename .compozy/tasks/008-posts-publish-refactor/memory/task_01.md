# Task Memory: task_01.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Drop `isPublished` boolean column from `posts` table. ✅ COMPLETE

## Important Decisions

- Integration DB test uses `describe.skipIf(isPortFree(5432))` pattern (see seed.test.ts)
- Migration is `0003_hesitant_cassandra_nova.sql`
- Also updated `drizzle-schema.test.ts` and `indexer-integ.test.ts` to remove direct `is_published` SQL references (schema-layer tests, within task_01 scope)
- Worktree needs a `.env` file; copied from `.env.example` to fix docker-compose tests

## Learnings

- Worktree root: `/Users/antoniofulg/Projects/blog/.claude/worktrees/suspicious-torvalds-c72d30`
- Worktree does NOT have `.env` by default — copy from `.env.example` on first use
- `audit-content-cli.test.ts` 2 tests cascade-fail because `queries.ts:12` still uses `posts.isPublished` → task_02 fixes
- `bun run check` = biome check (no errors, 11 pre-existing warnings)

## Files / Surfaces

- `app/db/schema.ts` — removed `isPublished` line 21 ✅
- `drizzle/0003_hesitant_cassandra_nova.sql` — generated migration ✅
- `drizzle/meta/_journal.json` — updated by drizzle-kit ✅
- `app/tests/schema-migration.test.ts` — new unit + integration tests (8 pass) ✅
- `app/tests/drizzle-schema.test.ts` — removed `is_published` assertions ✅
- `app/tests/indexer-integ.test.ts` — removed `is_published` raw SQL assertions ✅

## Errors / Corrections

## Ready for Next Run

Task_02 must fix:
- `app/db/queries.ts:12` — `eq(posts.isPublished, true)` 
- `app/db/indexer.ts` — references isPublished
- `app/routes/{-$locale}/$slug.server.ts` — isPublished filter references
- `app/lib/site-model.server.ts` — getLatestPublishedSlug rename
- `app/tests/indexer.test.ts`, `lang-slug-route.test.ts`, `site-model.test.ts` — fixture cleanup
