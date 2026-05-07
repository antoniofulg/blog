---
provider: manual
pr:
round: 5
round_created_at: 2026-05-05T17:35:16Z
status: resolved
file: app/tests/makefile.test.ts
line: 150
severity: low
author: claude-code
provider_ref:
---

# Issue 001: make setup test missing negative assertion — db:seed must not run

## Review Comment

PRD F2 explicitly states that `make setup` "does NOT seed the database — contributors control seeding via `make db-seed`." The setup test verifies what IS called:

```typescript
expect(commands).toContain("docker compose pull db");
expect(commands).toContain("docker compose up db -d");
expect(commands).toContain("docker compose exec db pg_isready -U blog");
expect(commands).toContain("bun run db:migrate");
```

There is no assertion that `bun run db:seed` is absent. If `make setup` accidentally calls `db:seed` in the future (e.g., a contributor adds it thinking auto-seed is desirable), no test will catch the regression. Since seeding is environment-specific (some contributors don't want auto-seeded data), accidentally calling it from setup would break the non-seeding workflow.

**Fix**: Add a negative assertion to the setup test:

```typescript
it("make setup runs DB startup and migration steps regardless of DATABASE_URL value", () => {
    // ...existing setup...
    const commands = readFileSync(logPath, "utf8");
    expect(commands).toContain("docker compose pull db");
    expect(commands).toContain("docker compose up db -d");
    expect(commands).toContain("docker compose exec db pg_isready -U blog");
    expect(commands).toContain("bun run db:migrate");
    expect(commands).not.toContain("bun run db:seed"); // PRD F2: setup must not seed
});
```

## Triage

- Decision: `valid`
- Notes: PRD F2 guarantees setup must NOT seed. Test only asserts positive presence — no regression guard if someone adds db:seed to setup target. Fix: add `expect(commands).not.toContain("bun run db:seed")` after existing assertions.
