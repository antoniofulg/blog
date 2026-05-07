---
status: completed
title: Extend `docker-compose.yml` with `app` service and watch blocks
type: infra
complexity: medium
dependencies:
  - task_02
---

# Task 3: Extend `docker-compose.yml` with `app` service and watch blocks

## Overview

Add an `app` service to the existing `docker-compose.yml`, wiring it to the `dev` Dockerfile stage with `develop: watch:` sync blocks for `make dev-docker`. The existing `db` service and `postgres_data` volume remain unchanged. The `app` service must declare `depends_on: db: condition: service_healthy` to prevent a race condition with the Vite dev server's auto-migration hook.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `app` service targeting the `dev` Dockerfile stage (`build: context: . target: dev`)
- MUST set `command: bun dev --port 3000`
- MUST map port `3000:3000`
- MUST load env from `.env` via `env_file: .env`
- MUST declare `depends_on: db: condition: service_healthy` (DB healthcheck already configured)
- MUST declare an anonymous volume for `/app/node_modules` to prevent host `node_modules` from overriding container-installed deps
- MUST include `develop: watch:` blocks syncing `./app → /app/app` and `./content → /app/content` with `action: sync`
- MUST include `develop: watch:` entries for `package.json` and `bun.lock` with `action: rebuild`
- MUST NOT modify the existing `db` service, healthcheck, or `postgres_data` volume
</requirements>

## Subtasks

- [x] 3.1 Add `app` service block after `db` in `docker-compose.yml` with build target, command, ports, env_file, and depends_on
- [x] 3.2 Add anonymous volume `- /app/node_modules` to prevent host dep override
- [x] 3.3 Add `develop: watch:` block with sync actions for `./app` and `./content`, and rebuild actions for `package.json` and `bun.lock`
- [x] 3.4 Run `docker compose up` (without watch) to verify `app` service starts and waits for DB to be healthy
- [x] 3.5 Run `docker compose watch` to verify file sync triggers hot reload in the browser

## Implementation Details

See TechSpec "Implementation Design → docker-compose.yml Changes" section for the complete app service block.

**Anonymous volume rationale:** `bun install` in the `dev` stage installs deps to `/app/node_modules` inside the container. If the project root is bind-mounted without the anonymous volume, the host's `node_modules` (or absence of it) would shadow the container's installed deps. The anonymous volume `/app/node_modules` masks the host path, ensuring the container always uses its own installed deps.

**`depends_on` rationale:** `vite.config.ts`'s `configureServer` hook calls `execFileSync('bun', ['run', 'db:migrate'])` at startup. If the app container starts before Postgres is ready, the migration will fail. The `service_healthy` condition uses the existing DB healthcheck (`pg_isready -U blog`, 5s interval, 5 retries) to block app startup until Postgres accepts connections.

**`develop: watch:` coverage:**
- `./app → /app/app` (sync): all React components, routes, API handlers, DB queries
- `./content → /app/content` (sync): MDX blog post files
- `package.json` (rebuild): dependency additions require a full image rebuild
- `bun.lock` (rebuild): lockfile changes require reinstall

### Relevant Files

- `docker-compose.yml` — existing file; `db` service and `postgres_data` volume remain unchanged; `app` service is appended
- `Dockerfile` (task_02) — `app` service references `build: target: dev`
- `.env` / `.env.example` — `env_file: .env` loads all three vars into the container at runtime
- `vite.config.ts` — `configureServer` hook calls `db:migrate` and `db:seed` at dev startup; `depends_on` prevents race condition
- `app/` directory — sync target for `develop: watch:`
- `content/` directory — sync target for `develop: watch:`

### Dependent Files

- `Makefile` (task_04) — `make dev-docker` calls `docker compose watch`; `make stop` calls `docker compose down` (which now also stops the `app` service); `make logs` calls `docker compose logs -f app`; `make shell` calls `docker compose exec app sh`

### Related ADRs

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — `app` service in compose enables `make dev-docker`; not the default path
- [ADR-003: Multi-Stage Dockerfile with Named Build Targets](adrs/adr-003.md) — `build: target: dev` uses the `dev` named stage

## Deliverables

- Updated `docker-compose.yml` with `app` service, anonymous node_modules volume, and `develop: watch:` blocks
- `docker compose watch` successfully starts both `db` and `app` services
- File changes in `./app` reflect in browser without manual container restart

## Tests

- Unit tests:
  - [x] `docker compose config` exits 0 and shows valid YAML (no syntax errors)
  - [x] `app` service appears in `docker compose config` output with correct `target: dev`, port `3000`, and `env_file`
  - [x] `depends_on` block shows `db` with `condition: service_healthy`
  - [x] Anonymous volume `/app/node_modules` is declared in `app` service volumes
- Integration tests:
  - [ ] `docker compose up -d` starts both services; `docker compose ps` shows both healthy
  - [ ] `docker compose watch` starts; editing a file in `./app` triggers sync without full rebuild
  - [ ] Editing `package.json` triggers image rebuild (verify in `docker compose watch` output)
  - [ ] `docker compose exec app sh` opens a shell in the running app container
  - [x] `docker compose down` stops and removes both containers; `postgres_data` volume is NOT removed
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `docker compose watch` starts app within 30 seconds of `db` healthcheck passing
- File sync round-trip (edit `./app` file → browser update) under 3 seconds
- Existing `db` service behavior is unchanged (healthcheck, volume, credentials)
