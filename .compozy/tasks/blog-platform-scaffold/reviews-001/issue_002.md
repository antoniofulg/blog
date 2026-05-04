---
provider: manual
pr:
round: 1
round_created_at: 2026-05-04T01:09:44Z
status: pending
file: vite.config.ts
line: 23
severity: high
author: claude-code
provider_ref:
---

# Issue 002: F1 zero-config startup broken — bun dev does not run migrations or seed

## Review Comment

PRD F1 states: "Running `docker compose up && bun dev` starts the full local environment: Postgres container, Drizzle schema migrations, Better Auth session table creation, an admin user seed." The acceptance criterion is two commands, zero manual configuration.

The `configureServer` hook in `vite.config.ts` only starts the content watcher. Neither migrations (`bun run db:migrate`) nor the admin seed (`bun run db:seed`) run as part of `bun dev`. On a clean clone the developer must run three commands, not two:

```
docker compose up -d
bun run db:migrate && bun run db:seed
bun dev
```

If they skip the middle step, `bun dev` starts but every route that touches the DB crashes, and the admin login fails with no seeded user.

**Fix**: Wrap `db:migrate` and `db:seed` in the same `configureServer` hook, guarded by `if (process.env.VITEST) return;`. Run them via `execa`/`spawnSync` before starting the watcher:

```typescript
async configureServer() {
  if (process.env.VITEST) return;
  const { execFileSync } = await import("node:child_process");
  execFileSync("bun", ["run", "db:migrate"], { stdio: "inherit" });
  execFileSync("bun", ["run", "db:seed"], { stdio: "inherit" });
  const { startContentWatcher } = await import(...);
  startContentWatcher(join(process.cwd(), "content"));
},
```

Alternatively, add a `predev` npm script in `package.json` that chains migrate → seed → dev.

## Triage

- Decision: `UNREVIEWED`
- Notes:
