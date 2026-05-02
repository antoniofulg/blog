---
status: pending
title: Docker Compose and Local Database
type: infra
complexity: low
dependencies:
  - task_01
---

# Task 2: Docker Compose and Local Database

## Overview

Create the `docker-compose.yml` that runs a Postgres 16 container for local development, with a health check that ensures the database is ready before the app starts. This task provides the database prerequisite for all subsequent backend tasks — Drizzle migrations (task_03), seeding (task_04), and the indexer (task_05) all depend on a running Postgres instance.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `docker-compose.yml` with a single `db` service using `postgres:16-alpine`
- MUST set `POSTGRES_DB=blog`, `POSTGRES_USER=blog`, `POSTGRES_PASSWORD=blog` as environment variables matching `.env.example` defaults
- MUST add a health check using `pg_isready -U blog` with a 5-second interval and 5 retries
- MUST persist data with a named Docker volume (`postgres_data`) — not a bind-mounted path
- MUST expose port `5432` to localhost for `bun dev` to connect without being inside Docker
- MUST NOT run the Bun app inside Docker — only the database service runs in Docker Compose for dev
- SHOULD document the two-command startup sequence (`docker compose up -d && bun dev`) in a comment at the top of `docker-compose.yml`
</requirements>

## Subtasks

- [ ] 2.1 Write `docker-compose.yml` with the `db` service, environment variables, port mapping, and named volume
- [ ] 2.2 Add a `pg_isready` health check with the correct user flag and retry configuration
- [ ] 2.3 Verify `docker compose up -d` starts Postgres and the health check reaches `healthy` status
- [ ] 2.4 Verify the database is reachable from the host at `postgres://blog:blog@localhost:5432/blog`

## Implementation Details

See TechSpec "Integration Points" section for the Docker Compose specification and environment variable mapping. The `DATABASE_URL` in `.env.example` (from task_01) must match the service configuration here.

### Relevant Files

- `docker-compose.yml` — new file; defines the `db` service
- `.env.example` — created in task_01; `DATABASE_URL` must match this compose config
- `.gitignore` — ensure `docker-compose.override.yml` is ignored if the developer adds local overrides

### Dependent Files

- `app/db/client.ts` (task_03) — reads `DATABASE_URL` from env; must match this compose config
- `scripts/seed.ts` (task_04) — runs against the database started here
- `drizzle.config.ts` (task_03) — uses `DATABASE_URL` to connect for migrations

### Related ADRs

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — Docker Compose baseline must be tested against a clean clone

## Deliverables

- `docker-compose.yml` with Postgres service, health check, and named volume
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for database availability **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] `docker-compose.yml` is valid YAML (parse without error)
  - [ ] Health check command is `pg_isready -U blog` (assert string in config)
  - [ ] Named volume `postgres_data` is declared in the `volumes` top-level key
- Integration tests:
  - [ ] `docker compose up -d` exits 0
  - [ ] `docker compose ps` shows the `db` service as `healthy` within 30 seconds
  - [ ] `psql postgres://blog:blog@localhost:5432/blog -c '\l'` exits 0 (database exists and is reachable)
  - [ ] `docker compose down -v` exits 0 and removes the container (cleanup)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `docker compose up -d` starts Postgres and reaches `healthy` in under 30 seconds
- Database is reachable at the `DATABASE_URL` from `.env.example`
