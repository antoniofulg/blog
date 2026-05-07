# Task Memory: task_07.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `scripts/sync.ts` CLI wrapping `syncAll`, close DB after, exit 0/1, add `sync` npm script. **Completed.**

## Important Decisions

- Exported `closeDb()` from `app/db/client.ts` (adds `await client.end()`). Seed script uses `process.exit(0)` without closing; sync script must close explicitly per task requirement.
- Exported `parseDir` and `runSync` from script for unit testability (same DI pattern as `scripts/seed.ts`).
- `import.meta.main` block calls `closeDb()` then `process.exit(0/1)`. `runSync` itself does not call `closeDb` — that stays in the main block.

## Learnings

- Integration tests using generic filenames like `a.mdx`/`b.mdx` cause slug uniqueness conflicts when multiple tests run against the same DB. Use test-specific prefixed names (e.g., `t7s2alpha.mdx`).
- `describe.skipIf(portFree)` pattern: tests skip gracefully when DB not running. Port 5432 NOT free = DB running = integration tests execute.

## Files / Surfaces

- `scripts/sync.ts` — created
- `app/db/client.ts` — added `closeDb()` export
- `package.json` — added `"sync": "bun run scripts/sync.ts"`
- `app/tests/task-07-sync.test.ts` — 5 unit tests (7 pass)
- `app/tests/task-07-sync-integ.test.ts` — 4 integration tests (including subprocess exit test)

## Errors / Corrections

- First integration test run: slug conflict on "a"/"b" across tests. Fixed by using unique prefixed basenames per test.

## Ready for Next Run

Task complete. All tests pass (85/85, 4 skipped). `bun run sync` exits 0 cleanly.
