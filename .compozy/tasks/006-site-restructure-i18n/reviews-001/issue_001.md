---
provider: manual
pr:
round: 1
round_created_at: 2026-05-15T13:01:46Z
status: resolved
file: Dockerfile
line: 27
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: Dockerfile runner stage missing scripts/sync.ts and content/

## Review Comment

The new deploy step in `scripts/deploy.sh:52` runs `bun run sync` inside the pulled production image:

```
docker run --rm --env-file '$DEPLOY_PATH/.env' --network blog $IMAGE bun run sync
```

`bun run sync` (per `package.json`) executes `bun run scripts/sync.ts`, which then walks `content/` (default `resolve("content")` in `scripts/sync.ts:17`). The runner stage of `Dockerfile` copies only `.output`, `package.json`, `node_modules`, `drizzle/`, `drizzle.config.ts`, `scripts/migrate.ts`, `scripts/seed.ts`, and `app/db`. It does **not** copy:

1. `scripts/sync.ts` — the script being invoked.
2. `content/` — the directory being walked.

On the next CD deploy, the `docker run ... bun run sync` step will fail (either "script not found" or "ENOENT on content/"), and `set -euo pipefail` aborts the deploy before `docker compose up -d --no-deps app` runs. The release is blocked and the new app container is never started.

ADR-003 explicitly calls for this step to populate `posts` on deploy, but the image bake list was not updated.

**Suggested fix**: add to the runner stage of `Dockerfile`:

```
COPY --from=builder /app/scripts/sync.ts ./scripts/sync.ts
COPY --from=builder /app/content ./content
```

Also affects: `app/lib/watcher.server.ts` is referenced by `scripts/watcher.ts`; if that ever runs in production (not currently), the same omission applies. Out of scope for this fix unless the watcher is added to deploy.

After the fix, run a deploy dry-run or boot the image locally (`docker run --rm <image> bun run sync --dir content`) to confirm the script + directory are both present and the indexer succeeds against the baked content.

## Triage

- Decision: `valid`
- Notes: Confirmed `scripts/sync.ts` exists at root and `content/` directory exists with `en/` and `pt-br/` subdirs. Confirmed `scripts/deploy.sh:52` runs `docker run ... bun run sync` inside the runner image. The Dockerfile runner stage only copies `scripts/migrate.ts` and `scripts/seed.ts` — `scripts/sync.ts` and `content/` are absent. The deploy step will fail with ENOENT when `bun run sync` tries to execute. Fix: add two `COPY --from=builder` lines in the runner stage for the missing artifacts.
