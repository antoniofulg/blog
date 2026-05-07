---
provider: manual
pr:
round: 3
round_created_at: 2026-05-05T17:17:52Z
status: resolved
file: app/tests/makefile.test.ts
line: 181
severity: low
author: claude-code
provider_ref:
---

# Issue 001: make restart-all has no test — new target unverified by CI

## Review Comment

`restart-all` was added in round 1 as a fix for issue_005. The container lifecycle test only covers `stop`, `restart`, `logs`, and `shell`:

```typescript
it("container lifecycle targets delegate to docker compose", () => {
    for (const target of ["stop", "restart", "logs", "shell"]) {
        runMake([target], workspace, { ... });
    }
    const commands = readFileSync(logPath, "utf8");
    expect(commands).toContain("docker compose down");
    expect(commands).toContain("docker compose restart db");
    expect(commands).toContain("docker compose logs -f app");
    expect(commands).toContain("docker compose exec app sh");
});
```

`restart-all` is not exercised, and its expected command (`docker compose down && docker compose up -d`) is not asserted. If `restart-all` regresses (e.g., delegates to the wrong command, or is silently removed from `.PHONY`), the test suite does not catch it.

Additionally, the `.PHONY` test also omits `restart-all` from its target list (line 97), so no test verifies it is declared `.PHONY` either.

**Fix**: Add `restart-all` to both tests:

```typescript
// In the lifecycle test
for (const target of ["stop", "restart", "restart-all", "logs", "shell"]) {
    runMake([target], workspace, { ... });
}
expect(commands).toContain("docker compose restart db");
expect(commands).toContain("docker compose down");
expect(commands).toContain("docker compose up -d");

// In the .PHONY test
for (const target of [
    ...,
    "stop", "restart", "restart-all", "logs", "shell", "deploy",
]) { ... }
```

## Triage

- Decision: `valid`
- Notes: `restart-all` exists in Makefile (line 98) and `.PHONY` (line 5) but is omitted from three test locations: the help output check, the `.PHONY` content check, and the lifecycle iteration. The lifecycle test also lacks an assertion for `docker compose up -d`, which is the second half of the `restart-all` recipe. Fix: add `restart-all` to all three test lists and add the `up -d` assertion.
