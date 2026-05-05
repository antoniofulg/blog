---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T16:57:09Z
status: resolved
file: Makefile
line: 37
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: make preview DB connection fails — localhost in .env unreachable inside container

## Review Comment

The `preview` target runs the production image with environment variables from `.env`:

```makefile
preview: ## Run production image locally (validates build before deploy)
	docker run --rm --env-file .env -p 3000:3000 --name $(CONTAINER_APP) $(IMAGE_NAME)
```

`.env` (and `.env.example`) sets `DATABASE_URL=postgres://blog:blog@localhost:5432/blog`. Inside a `docker run` container, `localhost` resolves to the container's own loopback interface (127.0.0.1), not the host machine. The Postgres service is running via `docker compose up db -d`, which maps port 5432 from the `db` container to the host. From the preview container, `localhost:5432` is unreachable — there is no Postgres listening there.

Result: `make build && make preview` produces a running container that immediately fails all database queries (post list, session check, etc.) with a connection refused error. The purpose of `make preview` is to "validate the production build before deploying" (PRD F8), but the default `.env` makes this validation impossible.

**Fix**: Connect the preview container to the Docker Compose network so it can reach the `db` service by hostname:

```makefile
preview: ## Run production image locally (validates build before deploy)
	docker run --rm \
	  --env-file .env \
	  --network blog_default \
	  -e DATABASE_URL=postgres://blog:blog@db:5432/blog \
	  -p 3000:3000 \
	  --name $(CONTAINER_APP) \
	  $(IMAGE_NAME)
```

The compose network name defaults to `<project-directory>_default` (typically `blog_default`). Alternatively, give the compose network an explicit name in `docker-compose.yml`:

```yaml
networks:
  blog:
    name: blog

services:
  db:
    networks: [blog]
  app:
    networks: [blog]
```

Then use `--network blog` in `make preview`.

Document in `make help` and CONTRIBUTING.md that `make preview` requires the DB container to be running (`make dev` or `docker compose up db -d` first).

## Triage

- Decision: `valid`
- Notes: Confirmed — `preview` target passed `--env-file .env` where `.env` contains `DATABASE_URL=postgres://blog:blog@localhost:5432/blog`. Inside a container, `localhost` resolves to the container's own loopback (127.0.0.1), not the host. `make preview` produces a running container with broken DB connectivity.

  **Fix applied:**
  1. `docker-compose.yml` — added explicit named network (`name: blog`) and attached both `db` and `app` services to it, so `make preview` can join the same network by name without relying on the auto-generated `blog_default` name.
  2. `Makefile` `preview` target — added `--network blog` and `-e DATABASE_URL=postgres://blog:blog@db:5432/blog` so the container can reach Postgres via the `db` hostname. Updated help text to document the dependency on the DB container being up.
  3. `app/tests/makefile.test.ts` — updated the `toContain` assertion for `preview` to match the new command format (test was asserting the old single-line form without network args).
