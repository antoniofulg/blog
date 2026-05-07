---
provider: manual
pr:
round: 5
round_created_at: 2026-05-06T19:52:54Z
status: resolved
file: scripts/deploy.sh
line: 19
severity: high
author: claude-code
provider_ref:
---

# Issue 002: VPS filesystem not updated before migrations; new files never applied

## Review Comment

The deploy script runs `make db-migrate` against the VPS working directory at `$DEPLOY_PATH`:

```bash
cd '$DEPLOY_PATH' && \
make db-migrate && \          # reads ./drizzle/*.sql from VPS filesystem
docker compose up -d --no-deps app
```

`make db-migrate` runs `bun run db:migrate` → `drizzle-kit migrate`, which reads migration files from the local `./drizzle/` directory on the VPS. The deploy script never fetches the new commit onto the VPS before running this command.

When a main commit adds a new Drizzle migration file, the sequence is:
1. New image is built with the new migration inside the image
2. VPS pulls the new image ✓
3. `make db-migrate` runs — but `./drizzle/` on the VPS still has the old files
4. The new migration is never applied
5. Container restarts with new app code that expects a schema the DB doesn't have yet

This is the scenario the migration-first ordering (PRD F6) was designed to prevent, but the stale filesystem undermines it.

**Fix option A — git pull before migrate** (simplest):

```bash
cd '$DEPLOY_PATH' && \
git pull --ff-only origin main && \
make db-migrate && \
docker compose up -d --no-deps app
```

Requires the VPS user to have git and network access to the repo. For a private repo, also requires deploy SSH key or PAT configured on VPS.

**Fix option B — run migrations from inside the new image** (no git required on VPS):

```bash
docker pull $IMAGE && \
docker run --rm --env-file '$DEPLOY_PATH/.env' $IMAGE \
  bun run db:migrate && \
docker compose -f '$DEPLOY_PATH/docker-compose.prod.yml' up -d --no-deps app
```

The new image already contains all migration files, so this is always in sync with the deployed version.

Option B is more robust: it eliminates the dependency on git being configured on the VPS and ensures the migration runner is always the exact version matching the deployed image.

## Triage

- Decision: `valid`
- Notes: Confirmed. `make db-migrate` on VPS reads `./drizzle/*.sql` from the VPS filesystem, which is never updated by the deploy script (no `git pull`). New migration files are inside the Docker image but not on the VPS filesystem. Fix: Option B — run `docker run --rm --env-file $DEPLOY_PATH/.env --network blog $IMAGE bun run db:migrate` using the newly pulled image, which contains the up-to-date migration files. No git required on VPS. Combined with issue 001 fix (`docker-compose.prod.yml`) and issue 003 fix (SHA tag).
