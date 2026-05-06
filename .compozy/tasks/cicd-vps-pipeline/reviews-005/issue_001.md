---
provider: manual
pr:
round: 5
round_created_at: 2026-05-06T19:52:54Z
status: resolved
file: docker-compose.yml
line: 30
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: docker compose up restarts dev build, not the pulled GHCR image

## Review Comment

The deploy script pulls the production GHCR image and then restarts the app service via `docker compose up -d --no-deps app`. But `docker-compose.yml` defines the `app` service with `build:` and no `image:` field:

```yaml
  app:
    build:
      context: .
      target: dev         # ← dev stage, not the runner stage
    command: bun dev --port 3000
```

When no `image:` name is specified in the Compose service definition, Docker does not associate the pulled image with the service. `docker compose up -d --no-deps app` rebuilds from the local Dockerfile (`target: dev`) or uses whatever image Compose last built locally — it does not use `ghcr.io/.../blog:latest` that was just pulled.

The result: every CD run successfully pushes a production image to GHCR, SSHes into the VPS, pulls the image, then immediately discards it and starts the dev server from source. The VPS has never run the production image.

**Fix**: Add a production Compose file (e.g., `docker-compose.prod.yml`) that specifies the GHCR image and production command, and invoke it in `deploy.sh`:

```yaml
# docker-compose.prod.yml
services:
  app:
    image: ghcr.io/${GHCR_OWNER}/${GHCR_REPO}:latest
    restart: unless-stopped
    env_file: .env
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy
    networks: [blog]
```

Then in `deploy.sh`:

```bash
docker pull $IMAGE && \
cd '$DEPLOY_PATH' && \
make db-migrate && \
GHCR_OWNER=$GHCR_OWNER GHCR_REPO=$GHCR_REPO \
  docker compose -f docker-compose.prod.yml up -d --no-deps app
```

Alternatively, replace `docker compose up` with a direct `docker run` or `docker container` command that explicitly names the GHCR image.

## Triage

- Decision: `valid`
- Notes: Confirmed. `docker-compose.yml` `app` service has `build: target: dev` and no `image:` field. `docker compose up -d --no-deps app` ignores the pulled GHCR image and rebuilds from dev Dockerfile. Fix: create `docker-compose.prod.yml` with `image: ghcr.io/${GHCR_OWNER}/${GHCR_REPO}:${IMAGE_TAG:-latest}` and update `deploy.sh` to use `-f docker-compose.prod.yml`. Combined with issue 002 fix (run migrations inside image via `docker run --rm`) and issue 003 fix (SHA tag via `IMAGE_TAG`).
