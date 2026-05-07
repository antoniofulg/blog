---
provider: manual
pr:
round: 1
round_created_at: 2026-05-05T15:55:14Z
status: resolved
file: .dockerignore
line: 7
severity: high
author: claude-code
provider_ref:
---

# Issue 002: make dev-docker fails — drizzle/ migration files absent in container

## Review Comment

The `app` service in `docker-compose.yml` builds from the `dev` Dockerfile stage, which only copies `package.json` and `bun.lock` and runs `bun install`. It does NOT copy the `drizzle/` directory. Additionally, `.dockerignore` explicitly excludes `drizzle`:

```
drizzle
```

The `develop: watch:` blocks only sync `./app` and `./content` into the container; `./drizzle` is not in the watch list. So when `docker compose watch` starts the app service and runs `bun dev`, the `configureServer` hook in `vite.config.ts` immediately calls:

```typescript
execFileSync("bun", ["run", "db:migrate"], { stdio: "inherit" });
```

`drizzle-kit migrate` reads migration files from `./drizzle/` (configured in `drizzle.config.ts`). Inside the container, `./drizzle/` does not exist. `drizzle-kit` cannot apply the schema, `execFileSync` throws, the `configureServer` hook aborts, and the dev server fails to start.

**Fix**: Add `./drizzle` to the `develop: watch:` sync blocks in `docker-compose.yml`:

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

Also remove `drizzle` from `.dockerignore` so that the initial image build includes the migration files (before the first sync fires). Alternatively, keep `.dockerignore` as-is and rely solely on the `develop: watch:` sync to bring migration files into the container — but the sync fires after the container starts, and `configureServer` runs immediately on startup, so the sync-only approach has a race condition. The safest fix is to include `drizzle/` in the `dev` image and keep it in the watch list.

## Triage

- Decision: `VALID`
- Root cause: `.dockerignore` line 9 excludes the `drizzle/` directory from the build context. The `dev` Dockerfile stage only copies `package.json` and `bun.lock`. When `configureServer` runs `execFileSync("bun", ["run", "db:migrate"])` at startup, drizzle-kit cannot find migration files and throws, aborting the dev server.
- Fix in scope: Remove `drizzle` from `.dockerignore` so the initial image build includes migration files.
- Out-of-scope note: `docker-compose.yml` watch blocks also lack a `./drizzle` sync entry, meaning live migration file changes won't sync after initial start. That file is not in this batch's scope; documented here for follow-up.
