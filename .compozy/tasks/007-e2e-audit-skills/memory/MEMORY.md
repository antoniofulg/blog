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

- task_02 can start: all Phase 1-3 deps are installed.
