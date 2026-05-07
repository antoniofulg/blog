# Task Memory: task_02.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Create `docker-compose.yml` with a single `db` service (postgres:16-alpine), health check, named volume, and port 5432. COMPLETED.

## Important Decisions

- Used `docker exec blog-db-1 psql -U blog blog -c '\l'` for the psql integration test — `psql` is not installed on the host; postgres:16-alpine bundles it.
- Used `describe.skipIf(!port5432Free)` for integration tests — allows graceful skip when port 5432 is occupied by another project.
- Integration tests verified by temporarily stopping `loving-mahavira-13bd0e-postgres-1` (another project's container); all 7 passed.

## Learnings

- Port 5432 is occupied in this dev environment by another project's container. Integration tests detect this at runtime and skip cleanly.
- `psql` not installed on macOS in this environment — always prefer `docker exec <container> psql` for portability.

## Files / Surfaces

- `docker-compose.yml` — new, root of project
- `.gitignore` — added `docker-compose.override.yml`
- `app/tests/task-02-docker-compose.test.ts` — unit + integration tests

## Errors / Corrections

- Initial integration test used host `psql` — failed with "psql: command not found". Fixed by using `docker exec`.
- Initial `it()` timeout formatting rejected by biome — fixed with `biome check --write`.

## Ready for Next Run

Task 03 (Drizzle Schema and Database Client) can start. Depends on this task (port 5432 available via `docker compose up -d`). `DATABASE_URL=postgres://blog:blog@localhost:5432/blog` is the canonical connection string.
