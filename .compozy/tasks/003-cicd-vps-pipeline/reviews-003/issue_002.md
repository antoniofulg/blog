---
provider: manual
pr:
round: 3
round_created_at: 2026-05-06T17:46:11Z
status: resolved
file: app/tests/deploy-sh.test.ts
line: 69
severity: low
author: claude-code
provider_ref:
---

# Issue 002: No tests verify ConnectTimeout and ServerAliveInterval SSH flags

## Review Comment

Three SSH timeout options were added to `scripts/deploy.sh` (round 2, issue 004 fix):

```bash
  -o ConnectTimeout=30 \
  -o ServerAliveInterval=15 \
  -o ServerAliveCountMax=3 \
```

The existing test at line 69 verifies `StrictHostKeyChecking=accept-new`, establishing the pattern for testing SSH flags. No equivalent test covers the new timeout options. If a future edit accidentally removes or changes them, no test catches the regression.

**Fix**: Add a test following the existing `StrictHostKeyChecking` pattern:

```typescript
it("SSH call includes ConnectTimeout and ServerAlive options", () => {
    const { binDir, logPath } = makeWorkspace();
    spawnSync("bash", [deployScript], {
        env: {
            ...baseEnv,
            ...requiredVars,
            PATH: `${binDir}:${baseEnv.PATH}`,
        },
        encoding: "utf8",
    });
    const log = readFileSync(logPath, "utf8");
    expect(log).toContain("ConnectTimeout=30");
    expect(log).toContain("ServerAliveInterval=15");
    expect(log).toContain("ServerAliveCountMax=3");
});
```

## Triage

- Decision: `VALID`
- Notes: Confirmed `ConnectTimeout=30`, `ServerAliveInterval=15`, `ServerAliveCountMax=3` present in `scripts/deploy.sh` (lines 14-16) with no corresponding test. Added test "SSH call includes ConnectTimeout and ServerAlive options" after the existing `StrictHostKeyChecking` test, using the same `makeWorkspace` + fake `ssh` stub pattern.
