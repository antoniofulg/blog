---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T16:57:09Z
status: resolved
file: Dockerfile
line: 5
severity: high
author: claude-code
provider_ref:
---

# Issue 001: dev Dockerfile stage still missing drizzle/ — make dev-docker still broken

## Review Comment

Round 1 issue_002 fixed `make dev-docker` by removing `drizzle` from `.dockerignore`, with the intent that "the initial image build includes migration files." However, the fix is incomplete: removing a file from `.dockerignore` puts it in the build **context**, but it is not automatically included in the image — the Dockerfile must explicitly `COPY` it.

The `dev` stage only copies `package.json` and `bun.lock`:

```dockerfile
FROM oven/bun:1 AS dev
WORKDIR /app
COPY package.json bun.lock ./   # ← only these two files
RUN bun install --frozen-lockfile
CMD ["bun", "dev", "--port", "3000"]
```

The `builder` stage (`FROM dev AS builder; COPY . .`) would include `drizzle/`, but the docker-compose `app` service builds from `target: dev`, not `builder`. When `make dev-docker` starts the app container and `bun dev` fires the `configureServer` hook:

```typescript
execFileSync("bun", ["run", "db:migrate"], { stdio: "inherit" });
```

`drizzle-kit migrate` reads from `./drizzle/` (per `drizzle.config.ts`). That directory does not exist in the `dev` stage image. `drizzle-kit` exits non-zero, `execFileSync` throws, and the dev server aborts. `make dev-docker` is still broken.

**Fix**: Add an explicit `COPY` of the migration directory to the `dev` stage:

```dockerfile
FROM oven/bun:1 AS dev
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY drizzle/ ./drizzle/
CMD ["bun", "dev", "--port", "3000"]
```

Also add a `./drizzle` sync block to `docker-compose.yml` so live migration file changes propagate without a full image rebuild:

```yaml
develop:
  watch:
    - action: sync
      path: ./app
      target: /app/app
    - action: sync
      path: ./content
      target: /app/content
    - action: sync
      path: ./drizzle
      target: /app/drizzle
    - action: rebuild
      path: package.json
    - action: rebuild
      path: bun.lock
```

## Triage

- Decision: `valid`
- Notes: Confirmed — `docker-compose.yml` uses `target: dev`. The `dev` stage in Dockerfile only `COPY package.json bun.lock ./`; `COPY . .` (which includes `drizzle/`) is in the `builder` stage. When `make dev-docker` starts the app container and the `configureServer` hook calls `bun run db:migrate`, `drizzle-kit` cannot find `./drizzle/` and exits non-zero, aborting the dev server.

  **Fix applied:**
  1. `Dockerfile` — added `COPY drizzle/ ./drizzle/` after `RUN bun install --frozen-lockfile` in the `dev` stage (line 7).
  2. `docker-compose.yml` — added `sync` watch block for `./drizzle → /app/drizzle` so live migration file edits propagate without a full image rebuild.
