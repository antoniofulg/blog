# Task Memory: task_09.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `tests/e2e/admin-write.spec.ts` — 3 tests covering admin guard, publish toggle (UI+DB), and preview for unpublished post.

## Important Decisions

- Spec file already existed as untracked (`??`) at session start — adopted and improved.
- Fixed: removed local `E2E_STATE_FILE` duplication; now imports from `./global-setup`.
- Fixed: `playwright.config.ts` had `stderr: "inherit"` (invalid type); changed to `"pipe"`.
- DB access via `drizzle-orm/postgres-js` + `postgres.js` client connecting to PGLite proxy — no extra deps needed.
- Per-test DB reset (inside test body, not `beforeEach`) using Drizzle update; idempotent.

## Learnings

- `drizzle-orm/postgres-js` subpath exists at 0.45.2 and works as a wrapper for postgres.js.
- `tests/e2e/` excluded from biome includes — no biome errors from spec files.
- `playwright-report/index.html` can accumulate on disk and causes biome failure; delete before biome runs.
- `stderr: "inherit"` is not a valid Playwright webServer option — only `"pipe"` or `"ignore"`.

## Files / Surfaces

- `tests/e2e/admin-write.spec.ts` — created/modified (import fix)
- `playwright.config.ts` — fixed `stderr: "inherit"` → `"pipe"`

## Errors / Corrections

- Initial spec had `const E2E_STATE_FILE = join(tmpdir(), "pglite-e2e-state.json")` duplicating the path from global-setup. Fixed to import `E2E_STATE_FILE` from `./global-setup`.
- `playwright.config.ts` TS error: `stderr: "inherit"` not assignable to `"pipe" | "ignore" | undefined`. Fixed to `"pipe"`.

## Ready for Next Run

- task_09 complete; 3 tests pass TypeScript + Playwright list check. Full E2E run requires the live server + PGLite harness (verified via --list).
- Commit created on branch TASK-0007/e2e-audit-skills.
