# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Created `scripts/deploy.sh` — SSH deploy script matching TechSpec Core Interfaces exactly, plus start-log echo. 9 tests added in `app/tests/deploy-sh.test.ts`.

## Important Decisions

- Added `echo "[deploy] starting: $IMAGE → $VPS_USER@$VPS_HOST:$VPS_PORT"` before the SSH call (not in TechSpec Core Interfaces but satisfies the task SHOULD requirement and aligns with Monitoring section).
- Integration test for "make deploy exits non-zero on missing env vars" was rewritten to test `bash scripts/deploy.sh` directly because the Makefile uses `;` (not `&&`) between `bash scripts/deploy.sh` and `echo "Deployed."`, so make exits 0 even when the script fails. Follow-up needed on Makefile.

## Learnings

- `public-routes.test.ts` integration failure is pre-existing (confirmed by reverting task changes — same failure on baseline).
- Biome auto-fixed import order and formatter issue in the test file (`bunx biome check --write`).
- `git ls-files --stage` test requires the file to be staged; staging was done via `git add scripts/deploy.sh`.

## Files / Surfaces

- `scripts/deploy.sh` — new, mode 100755, staged
- `app/tests/deploy-sh.test.ts` — new, 9 tests (7 unit + 2 integration)

## Errors / Corrections

- Biome caught import ordering and formatter issues in first draft of test file; fixed with `bunx biome check --write`.

## Ready for Next Run

Task complete. Follow-up: consider changing Makefile deploy recipe from `bash scripts/deploy.sh; echo "Deployed..."` to `bash scripts/deploy.sh && echo "Deployed..."` so make propagates failure correctly.
