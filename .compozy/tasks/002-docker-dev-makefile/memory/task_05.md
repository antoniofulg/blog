# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

DONE. Added and verified the ops Makefile targets. Current run expanded Makefile target tests, fixed DB reset repeatability, and kept `make test && make lint && make format && make check` green.

## Important Decisions

- `make check` → `bunx tsc --noEmit` NOT `bun run check` (bun run check runs Biome)
- `db-reset` requires DB running; uses `docker compose exec db psql`
- `deploy` stub: `@test -f scripts/deploy.sh && bash scripts/deploy.sh || echo "No deploy script found..."`
- `db-reset` drops both `public` and Drizzle's migration-history schema (`drizzle`) before rerunning migrations and seed; dropping only `public` leaves stale migration history and skips table recreation.
- `app/tests/docker-compose.test.ts` destructive lifecycle integration is gated behind `RUN_DOCKER_COMPOSE_INTEGRATION=1` so a default full test run does not stop the DB while other integration tests are running.
- Fixed 3 pre-existing TS errors (required for `make check` deliverable):
  - `vite.config.ts`: `import from "vite"` → `import from "vitest/config"` (test property not in vite types)
  - `admin-routes.test.ts`: chain type `Record<string, unknown> & { _resolve(val: unknown): unknown }` (unknown intersection preserves callable type)
  - `drizzle-schema.test.ts`: `(posts as unknown as Record<symbol, unknown>)[Symbol.for(...)]` for Symbol indexing

## Learnings

- `biome format` (bun run format) runs in CHECK mode only — `bunx biome format --write .` to actually reformat
- Changing long type annotations may cause Biome to reformat surrounding code; always run format --write after TS fixes
- TS intersection `unknown & (fn: T): T` — accessing a specific property through `Record<string, unknown> & { p: T }` gives `T` (not `unknown`)
- Bun auto-loads root `.env`; CLI tests that assert missing env vars need `bun --no-env-file`.

## Files / Surfaces

- `Makefile` — 13 ops targets added in 5 sections (Build & Preview, Quality Gates, Database, Container Lifecycle, Deploy)
- `app/tests/makefile.test.ts` — 6 new tests + bunx fake binary added to makeSetupWorkspace
- `app/tests/seed.test.ts` — isolated seed CLI env-validation assertions from Bun's automatic `.env` loading
- `app/tests/docker-compose.test.ts` — gated destructive compose lifecycle integration behind explicit env var
- `vite.config.ts`, `app/tests/admin-routes.test.ts`, `app/tests/drizzle-schema.test.ts` — TS error fixes

## Ready for Next Run

task_06: CONTRIBUTING.md. All 19 Makefile targets complete and verified. Evidence from current run: `make help`, `make test && make lint && make format && make check`, `make build`, `make preview` + `curl localhost:3000` HTTP 200, deploy absent/present checks, `make db-reset`, db target checks, and `make stop`.
