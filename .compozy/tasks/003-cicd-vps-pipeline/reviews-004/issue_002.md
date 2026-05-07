---
provider: manual
pr:
round: 4
round_created_at: 2026-05-06T18:01:12Z
status: pending
file: app/tests/deploy-sh.test.ts
line: 54
severity: low
author: claude-code
provider_ref:
---

# Issue 002: No test verifies DEPLOY_PATH with spaces is correctly quoted in SSH call

## Review Comment

Round 1 (issue 002) fixed `scripts/deploy.sh` to quote `$DEPLOY_PATH` in the SSH command: `cd '$DEPLOY_PATH'`. No test verifies this fix or guards against a regression that removes the quotes.

The existing `makeWorkspace()` pattern makes this straightforward to test. A path with a space (`/home/deploy/my blog`) should appear as `cd '/home/deploy/my blog'` in the SSH log — a single token to `cd`, not two tokens `cd /home/deploy/my` followed by an error.

**Fix**: Add a test after the existing ordering test:

```typescript
it("DEPLOY_PATH with spaces is quoted in SSH call", () => {
    const { binDir, logPath } = makeWorkspace();
    spawnSync("bash", [deployScript], {
        env: {
            ...baseEnv,
            ...requiredVars,
            DEPLOY_PATH: "/home/deploy/my blog",
            PATH: `${binDir}:${baseEnv.PATH}`,
        },
        encoding: "utf8",
    });
    const log = readFileSync(logPath, "utf8");
    expect(log).toContain("cd '/home/deploy/my blog'");
});
```

## Triage

- Decision: `UNREVIEWED`
- Notes:
