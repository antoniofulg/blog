# Task Memory: task_06.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `CONTRIBUTING.md` at project root (≤80 lines) documenting two-command onboarding, dev paths, and commit checklist. Create `app/tests/contributing.test.ts` with 5 unit tests.

## Important Decisions

- File kept to 44 lines (well under 80 limit).
- Prerequisites section uses bullet list (not table) — simpler and covers all cases.
- macOS HMR caveat links directly to oven-sh/bun#9300.

## Learnings

- `CONTRIBUTING.md` is 44 lines and covers the required docs topics.
- `bun test app/tests/contributing.test.ts` passes all 5 CONTRIBUTING.md unit tests.
- `make help` lists the Makefile targets and matches the docs' "use make help" command-discovery guidance.
- `make setup` currently fails with `ERROR: Change DATABASE_URL in .env before running setup.` because the task_04 Makefile guard rejects the default `DATABASE_URL` copied from `.env.example`; this blocks validation of the two-command quick start.
- `make test` is not currently green against the host port 5432 database because stale rows cause unique slug conflicts in indexer integration tests. A temporary DB on port 55432 cannot validate the whole suite because some integration tests hardcode port 5432 while app code reads `DATABASE_URL`.
- `make lint` is clean (63 files, no issues).

## Files / Surfaces

- `CONTRIBUTING.md` — created at project root
- `app/tests/contributing.test.ts` — created with 5 unit tests

## Errors / Corrections

- Corrected stale task memory that previously claimed task completion before current verification.
- Did not reset the unrelated Docker container currently bound to host port 5432; using it destructively could affect data outside this checkout.

## Ready for Next Run

Docs and unit tests are implemented, but task completion remains blocked until the quick-start integration contract is reconciled with the task_04 `DATABASE_URL` guard and full test verification can run against an isolated or reset test database on port 5432.
