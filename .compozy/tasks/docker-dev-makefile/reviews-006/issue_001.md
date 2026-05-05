---
provider: manual
pr:
round: 6
round_created_at: 2026-05-05T17:43:06Z
status: resolved
file: app/tests/makefile.test.ts
line: 63
severity: low
author: claude-code
provider_ref:
---

# Issue 001: make dev and make dev-docker delegation not tested

## Review Comment

Every other target group has a delegation test — quality gates, build/preview, database, container lifecycle, deploy — but `make dev` and `make dev-docker` are only verified to appear in `make help` output and in the `.PHONY` list. There is no test that runs either target and asserts the correct commands are logged.

`make dev` is the primary daily workflow (PRD F3). `make dev-docker` is the containerized opt-in (PRD F5). Both are straightforward single-delegation targets:

```makefile
dev:
    docker compose up db -d
    bun dev

dev-docker:
    docker compose watch
```

Without delegation tests, a typo or accidental change — e.g., `bun run dev` instead of `bun dev`, or `docker compose up` instead of `docker compose watch` — would not be caught by the test suite. The fake binary infrastructure is already in place and these targets are fully testable with it.

**Fix**: Add delegation tests following the existing pattern:

```typescript
it("dev and dev-docker targets delegate to the expected commands", () => {
    const { binDir, logPath, workspace } = makeSetupWorkspace(
        "postgres://blog:custom@localhost:5432/blog",
    );

    runMake(["dev"], workspace, {
        FAKE_COMMAND_LOG: logPath,
        PATH: `${binDir}:${process.env.PATH}`,
    });
    runMake(["dev-docker"], workspace, {
        FAKE_COMMAND_LOG: logPath,
        PATH: `${binDir}:${process.env.PATH}`,
    });

    const commands = readFileSync(logPath, "utf8");
    expect(commands).toContain("docker compose up db -d");
    expect(commands).toContain("bun dev");
    expect(commands).toContain("docker compose watch");
    // verify dev does NOT start all services
    expect(commands).not.toContain("docker compose up -d\n");
});
```

## Triage

- Decision: `valid`
- Root cause: `dev` and `dev-docker` had no delegation tests despite fake binary infrastructure already in place for all other target groups.
- Fix: Added `"dev and dev-docker targets delegate to the expected commands"` test in `app/tests/makefile.test.ts` following the existing pattern. Test runs both targets against fake binaries, asserts `docker compose up db -d`, `bun dev`, and `docker compose watch` appear in the log, and asserts `docker compose up -d` does not (guards against accidentally delegating to the full service start).
- Verification: `bun run test app/tests/makefile.test.ts` — 13 tests passed (was 12).
