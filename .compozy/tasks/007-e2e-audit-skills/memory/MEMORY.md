# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

- task_01 complete: 7 dev deps installed (pinned exact), Chromium ready, 5 .gitignore entries added.

## Shared Decisions

- `drizzle-orm` is already a prod dep at 0.45.2 with `/pglite` subpath confirmed; do not re-add as devDep.
- All `package.json` devDep versions must be pinned exactly (no `^` or `~`) — enforced by `app/tests/biome.test.ts`.

## Shared Learnings

- macOS Playwright browser cache: `~/Library/Caches/ms-playwright/` (not `~/.cache/`); CI uses Linux path.
- `app/tests/docker-compose.test.ts` has 1 pre-existing failure (env var mismatch in `DATABASE_URL`); do not count it as a regression.

## Open Risks

- PGLite@0.4.5 is a fast-moving package; downstream tasks (task_05 createTestDb) should confirm API compatibility with drizzle-orm/pglite before implementing.

## Handoffs

- task_02 complete: site-model module, vite stub, drift test all done. 28 tests pass, 95.45% branch coverage.
- task_03 complete: PGLite harness done. 18 tests pass, 94%+ statement coverage. State file at `os.tmpdir()/pglite-e2e-state.json`. TCP proxy built from `net.Server` + `PGlite.execProtocolRaw()`.
- task_04 can start: `E2E_STATE_FILE`, `getActiveTestDb()`, `clearActiveTestDb()` exported from `tests/e2e/global-setup.ts`.
