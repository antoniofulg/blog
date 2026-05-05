# Task Memory: task_04.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot
- Implement root Makefile with skeleton (.DEFAULT_GOAL, .PHONY all 19 targets, variables) + 4 core targets: help, setup, dev, dev-docker. Ops targets deferred to task_05.

## Important Decisions
- `dev-docker` uses `docker compose watch` (not `docker compose up`) per TechSpec.
- .PHONY lists all 19 targets upfront (ADR-002), ops targets have no recipes until task_05.
- DATABASE_URL guard: `grep -q 'DATABASE_URL=postgres://blog:blog@localhost' .env && echo "ERROR:..." && exit 1 || true`. Partial match catches .env.example default.
- `exit 1` exits the shell; make sees recipe failure. `|| true` only reached if grep fails (non-default URL).
- Tests use mkdtempSync temp dirs — never touch real .env.

## Learnings
- Root `AGENTS.md` and `CLAUDE.md` not present in checkout.
- Pre-change: `make help` exits 2 with `No rule to make target 'help'` (no Makefile yet).
- When .env is absent, setup copies .env.example (default DATABASE_URL) → guard fires AFTER .env is created. Test for .env creation still passes because file exists before guard exits 1.
- `make` exits non-zero when recipe fails; don't assert specific exit code, assert `!== 0`.
- ANSI escape in awk printf = actual byte 0x1b in stdout; Node test uses `\x1b[36m`.
- Focused Makefile tests pass. Full `bun run test` fails outside this task in `app/tests/seed.test.ts`; `bunx tsc --noEmit` fails outside this task in existing admin route/drizzle/vite config type errors.

## Files / Surfaces
- `/Users/antoniofulg/Projects/blog/Makefile` — created (new)
- `/Users/antoniofulg/Projects/blog/app/tests/makefile.test.ts` — created (new)

## Errors / Corrections
- `make setup` integration with non-default `.env` could not complete: default Docker config stalled at `docker compose pull db`; empty `DOCKER_CONFIG` made `docker compose` unavailable; direct `docker compose up db -d` then failed because port 5432 is already allocated.
- A temporary `.env` edit during integration testing was restored to the original localhost default value.

## Ready for Next Run
- task_05 adds ops targets to same Makefile (build, preview, test, lint, format, check, db-*, stop, restart, logs, shell, deploy)
- `make help` from root shows all 4 core targets. Do not mark task_04 complete until full verification/integration blockers are resolved or explicitly accepted as external.
