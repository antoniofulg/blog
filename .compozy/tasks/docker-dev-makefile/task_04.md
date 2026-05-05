---
status: pending
title: "Makefile: core targets (`help`, `setup`, `dev`, `dev-docker`)"
type: infra
complexity: medium
dependencies:
  - task_02
  - task_03
---

# Task 4: Makefile: core targets (`help`, `setup`, `dev`, `dev-docker`)

## Overview

Create the `Makefile` at the project root with the skeleton (`.DEFAULT_GOAL`, `.PHONY`, variables) and the four highest-value targets: `help`, `setup`, `dev`, and `dev-docker`. These targets define the contributor onboarding flow and the two development paths. Ops targets (quality gates, build, db, lifecycle, deploy) are added in task_05.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST set `.DEFAULT_GOAL := help` so bare `make` prints help
- MUST declare all targets (from both task_04 and task_05) in a single `.PHONY` list at the top
- MUST implement `help` using `awk` to scrape `##` comments from `$(MAKEFILE_LIST)` — output must be formatted with color (`\033[36m`)
- MUST implement `setup` with: `.env` copy guard, `DATABASE_URL` default-value guard (exit 1 with clear message), `docker compose pull db`, `docker compose up db -d`, `pg_isready` poll loop, `bun run db:migrate`
- MUST implement `dev` as: `docker compose up db -d && bun dev`
- MUST implement `dev-docker` as: `docker compose watch`
- MUST annotate every target with a `##` comment (used by `make help` scraper)
- MUST NOT contain logic already present in `package.json` scripts — delegate only
</requirements>

## Subtasks

- [ ] 4.1 Write Makefile skeleton: `.DEFAULT_GOAL`, `.PHONY` (all 17 targets), `IMAGE_NAME` and `CONTAINER_APP` variables
- [ ] 4.2 Implement `help` target with awk `##`-comment scraper and ANSI color formatting
- [ ] 4.3 Implement `setup` target: `.env` copy guard, `DATABASE_URL` default check, `docker compose pull db`, `docker compose up db -d`, `pg_isready` poll, `bun run db:migrate`
- [ ] 4.4 Implement `dev` target: `docker compose up db -d` then `bun dev`
- [ ] 4.5 Implement `dev-docker` target: `docker compose watch` with `##` comment noting macOS HMR caveat
- [ ] 4.6 Run `make help` and verify all four targets appear with correct descriptions
- [ ] 4.7 Run `make setup` on a machine with `.env` absent — verify `.env` is created, DB starts, migrations run

## Implementation Details

See TechSpec "Implementation Design → Makefile — All Targets" section for the exact implementation of each target, including the `awk` help scraper pattern and `pg_isready` poll loop.

**`make setup` `.env` guard:** Uses `test -f .env || cp .env.example .env` — idempotent, safe to re-run.

**`make setup` `DATABASE_URL` guard:** Uses `grep -q 'DATABASE_URL=postgres://blog:blog@localhost' .env && echo "ERROR: ..." && exit 1 || true`. Checks for the default value from `.env.example` — fails early with a clear message if contributor hasn't customized credentials.

**`make dev` does NOT poll for DB healthcheck** — unlike `make setup`. Bun's dev server starts immediately; Drizzle handles connection retry. Keeping `make dev` fast for repeat use is the deliberate trade-off (see TechSpec "Technical Considerations → Key Decisions").

**`make dev-docker` = `docker compose watch`** — not `docker compose up`. The `watch` subcommand activates `develop: watch:` file sync. `docker compose up` starts services without watch mode.

### Relevant Files

- `Dockerfile` (task_02) — `dev` and `dev-docker` targets depend on the Dockerfile being correct
- `docker-compose.yml` (task_03) — `dev` targets call `docker compose` commands defined in this file
- `.env.example` — `make setup` copies this to `.env`; the `DATABASE_URL` guard checks against its default value
- `package.json` — `make dev` calls `bun dev` which invokes the `dev` script (`vite dev --port 3000`)
- `vite.config.ts` — `configureServer` hook runs `db:migrate` and `db:seed` on dev start; Makefile does not need to replicate this

### Dependent Files

- `task_05.md` — task_05 adds ops targets to the same `Makefile`; this task must be complete first so the skeleton and `.PHONY` list exist

### Related ADRs

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — `make dev` = native default; `make dev-docker` = opt-in (this directly implements that decision)
- [ADR-002: Full V1 Scope](adrs/adr-002.md) — `.PHONY` list declares all 17 targets upfront even though ops targets are added in task_05

## Deliverables

- `Makefile` with skeleton + `help`, `setup`, `dev`, `dev-docker` targets
- `make help` output lists all four targets with descriptions
- `make setup` completes on a fresh clone (no prior `.env`) in under 3 minutes

## Tests

- Unit tests:
  - [ ] `make help` exits 0 and prints `setup`, `dev`, `dev-docker` in output
  - [ ] `make help` output is ANSI-colored (contains `\033[36m` escape in raw output)
  - [ ] `make setup` with no `.env` file creates `.env` from `.env.example`
  - [ ] `make setup` with `.env` containing default `DATABASE_URL` exits 1 with "ERROR:" message
  - [ ] `make setup` with `.env` containing a non-default `DATABASE_URL` proceeds past the guard
- Integration tests:
  - [ ] `make setup` (from clean state with Docker Desktop running) exits 0 and `docker compose ps db` shows healthy
  - [ ] `make dev` starts Bun dev server and browser opens at `localhost:3000`
  - [ ] `make dev-docker` starts both services via `docker compose watch` and `localhost:3000` is accessible
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `make setup && make dev` completes first-clone flow in under 3 minutes on a machine with Docker Desktop
- `make help` shows all targets; bare `make` also shows help (`.DEFAULT_GOAL := help`)
- `make setup` exits 1 with a clear error when `DATABASE_URL` is the default placeholder
