# Workflow Memory

Keep only durable, cross-task context here. Do not duplicate facts that are obvious from the repository, PRD documents, or git history.

## Current State

## Shared Decisions

## Shared Learnings
- Docker's default credential helper can stall public registry metadata fetches in this checkout; using a temporary `DOCKER_CONFIG` made `oven/bun` pulls and Docker builds proceed normally.
- On this host, an empty temporary `DOCKER_CONFIG` makes `docker compose` unavailable (`docker: unknown command: docker compose`), even though the default Docker config exposes Compose v5. Use care applying the Docker credential workaround to compose commands.
- Drizzle stores migration history in a separate `drizzle` schema. A destructive DB reset must clear that schema as well as `public`, or later migrations may be skipped while app tables are missing.
- `biome format` (bun run format) checks only — `bunx biome format --write .` actually formats. Changing type annotations may trigger Biome reformatting; run write after TS fixes.
- `vite.config.ts` uses `defineConfig` from `vitest/config` (not `vite`) so the Vitest `test` block is type-safe. Do not change this import back to `"vite"`.

## Open Risks
- Root `/` returns HTTP 500 in isolated `docker run` because DB host is unreachable from the container. Task_03 docker-compose must add DB networking so runner can connect. Not a Dockerfile bug.
- Local port 5432 may already be allocated; `docker compose up db -d` fails until the owning service is stopped or the compose port mapping changes.
- The current `make setup` contract is internally inconsistent: it copies `.env.example`, then rejects that same default `DATABASE_URL`, so the documented two-command onboarding flow fails before Docker work unless the guard or `.env.example` default is changed.

## Handoffs
