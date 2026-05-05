---
provider: manual
pr:
round: 1
round_created_at: 2026-05-05T15:55:14Z
status: resolved
file: Makefile
line: 55
severity: low
author: claude-code
provider_ref:
---

# Issue 005: make restart starts app container — unexpected after make dev (db-only)

## Review Comment

`make restart` is defined as:

```makefile
restart: ## Restart all Docker Compose services
	docker compose down && docker compose up -d
```

`docker compose up -d` without specifying services starts ALL services defined in `docker-compose.yml` — both `db` and `app`. A contributor using the native dev path (`make dev`) has only the `db` service running. Running `make restart` to, say, recover from a crashed Postgres container will also start the `app` service (the containerized dev service), which they did not intend. The `app` container then competes with the host's `bun dev` process for port 3000.

**Fix**: Specify only the `db` service in `make restart`, since that is the only container managed when using the native dev path:

```makefile
restart: ## Restart DB container (native dev path)
	docker compose restart db
```

Alternatively, split into two targets:

```makefile
restart: ## Restart DB service
	docker compose restart db

restart-all: ## Restart all Docker Compose services
	docker compose down && docker compose up -d
```

If `make restart` is intended as a general-purpose "restart everything" command for `make dev-docker` users, update the `## comment` to make this explicit so native-dev contributors know to use a different approach.

## Triage

- Decision: `VALID`
- Root cause: `docker compose up -d` without service arguments starts ALL services defined in docker-compose.yml (both `db` and `app`). Contributors on the native dev path (`make dev`) only run `db`. Running `make restart` starts the `app` container unexpectedly, which then competes with the host `bun dev` process for port 3000.
- Fix: Change `restart` to only restart the `db` service (via `docker compose restart db`) and add `restart-all` for the explicit full restart case.
