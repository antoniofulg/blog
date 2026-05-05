---
provider: manual
pr:
round: 1
round_created_at: 2026-05-05T15:55:14Z
status: resolved
file: CONTRIBUTING.md
line: 11
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: CONTRIBUTING.md falsely states dev data resets on each restart

## Review Comment

CONTRIBUTING.md states:

> Dev data resets on each restart — `vite.config.ts` seeds the DB on every `bun dev` start.

This is incorrect. The `configureServer` hook in `vite.config.ts` runs `bun run db:seed` on each `bun dev` start, but `scripts/seed.ts` is idempotent:

```typescript
const existing = await db.select().from(user).where(eq(user.email, adminEmail)).limit(1);
if (existing.length > 0) {
    return { status: "skipped", message: `Admin user already exists...` };
}
```

If the admin user already exists, the seed skips silently. Post records (view counts, `isPublished` state, `indexedAt` timestamps) are also never dropped — migrations are applied, not rolled back. Data persists across restarts unless `make db-reset` is explicitly called.

The incorrect statement misleads contributors in two ways:
1. They may avoid restarting `make dev` to preserve data they don't need to worry about.
2. They may file issues or ask questions about "data loss on restart" that doesn't actually happen.

**Fix**: Replace the inaccurate statement with an accurate one:

```markdown
`make setup` copies `.env.example` → `.env`, starts Postgres, and runs migrations.
On each `bun dev` start, `vite.config.ts` runs migrations (idempotent) and seeds the
admin user if it does not already exist. Existing posts, view counts, and publish state
are preserved across restarts. To reset all data, run `make db-reset`.
```

## Triage

- Decision: `VALID`
- Root cause: CONTRIBUTING.md line 20 states "Dev data resets on each restart". This is false. `scripts/seed.ts` checks for existing admin user before inserting and returns `skipped` if found. Migrations are applied, never rolled back. Data persists across restarts unless `make db-reset` is called.
- Fix: Replace the inaccurate sentence with accurate description of idempotent behavior and point contributors to `make db-reset` for explicit resets.
