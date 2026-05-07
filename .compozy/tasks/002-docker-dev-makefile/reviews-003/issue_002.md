---
provider: manual
pr:
round: 3
round_created_at: 2026-05-05T17:17:52Z
status: resolved
file: app/tests/makefile.test.ts
line: 130
severity: low
author: claude-code
provider_ref:
---

# Issue 002: Stale test name references removed validation guard

## Review Comment

Two tests describe behavior in terms of a validation guard that was removed in round 1 (issue_001 fix):

- Line 130: `"make setup with default DATABASE_URL proceeds without error"`
- Line 145: `"make setup with non-default DATABASE_URL proceeds past the guard"`

The phrase "proceeds past the guard" in the second test refers to the grep check that blocked setup when `DATABASE_URL` matched the local default. That guard no longer exists. A contributor reading this test for the first time will see the description, look for a guard in the Makefile, find none, and be confused about what the test is actually asserting.

Additionally, with the guard gone, both tests now exercise identical Makefile code paths — the only difference is the DATABASE_URL value written to `.env`, which the Makefile no longer reads or inspects. The two tests are semantically redundant.

**Fix**: Merge the two tests into one and update the name to reflect current behavior:

```typescript
it("make setup runs DB startup and migration steps regardless of DATABASE_URL value", () => {
    const { binDir, logPath, workspace } = makeSetupWorkspace(
        "postgres://blog:blog@localhost:5432/blog",
    );
    runMake(["setup"], workspace, {
        FAKE_COMMAND_LOG: logPath,
        PATH: `${binDir}:${process.env.PATH}`,
    });
    const commands = readFileSync(logPath, "utf8");
    expect(commands).toContain("docker compose pull db");
    expect(commands).toContain("docker compose up db -d");
    expect(commands).toContain("docker compose exec db pg_isready -U blog");
    expect(commands).toContain("bun run db:migrate");
});
```

## Triage

- Decision: `valid`
- Notes: The guard that blocked setup when `DATABASE_URL` matched the local default was removed in round 1. Both tests (lines 148 and 164) now exercise identical Makefile code paths — the only difference is the URL value passed to `.env`, which the Makefile no longer inspects. The second test name ("proceeds past the guard") is misleading: the guard is gone. Fix: merge into one test with an accurate name and assert `pg_isready` (which was missing from the first test but is always run by the Makefile).
