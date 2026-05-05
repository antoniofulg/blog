---
provider: manual
pr:
round: 4
round_created_at: 2026-05-05T17:27:46Z
status: resolved
file: docker-compose.yml
line: 2
severity: low
author: claude-code
provider_ref:
---

# Issue 001: docker-compose.yml header comment shows superseded manual workflow

## Review Comment

The header comment at the top of `docker-compose.yml` still shows the pre-Makefile two-command workflow:

```yaml
# Start the database, then run the app locally:
#   docker compose up -d && bun dev
```

`docker compose up -d` starts ALL services (db + app), which is not the intended native dev path. The correct native dev flow is now `make setup && make dev`. A contributor who opens `docker-compose.yml` directly — common when debugging container issues — sees this comment and may follow the old manual flow instead of the Makefile targets.

Additionally, `docker compose up -d` without `--wait` or a `pg_isready` poll could start `bun dev` before Postgres is healthy, causing a race condition that `make setup` was specifically designed to prevent.

**Fix**: Update the header comment to reference the Makefile:

```yaml
# Developer workflow — use the Makefile targets, not these compose commands directly:
#   make setup    First-clone: copy .env, start DB, run migrations
#   make dev      Native Bun dev server (default)
#   make dev-docker   Fully containerized dev stack
# Run `make help` for the full list of targets.
```

## Triage

- Decision: `valid`
- Notes: Header comment at line 1-2 referenced old manual `docker compose up -d && bun dev` flow. This predates Makefile targets and misleads contributors debugging container issues. Root cause: comment not updated when Makefile was introduced. Fixed by replacing with Makefile-oriented comment matching the suggested fix in the review comment.
