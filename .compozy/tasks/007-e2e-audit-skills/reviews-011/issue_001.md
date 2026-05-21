---
provider: manual
pr:
round: 11
round_created_at: 2026-05-20T18:49:03Z
status: resolved
file: scripts/run-audit-fe.ts
line: 36
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Audit orchestrator does not handle `spawn` "error" event — unhandled rejection on PATH miss

## Review Comment

`scripts/run-audit-fe.ts:36-41`:

```ts
function spawnPreview(): ChildProcess {
    return spawn("bun", ["run", NITRO_BUNDLE], {
        env: { ...process.env, PORT },
        stdio: ["ignore", "inherit", "inherit"],
    });
}
```

The returned `ChildProcess` never registers a listener for the `"error"` event. Per Node's `child_process` contract, an `"error"` event is emitted when:

- The process could not be spawned (e.g., `bun` is not on `PATH`).
- The process could not be killed.
- Sending a message to the child process failed.

If `bun` is missing from the operator's `PATH` (uncommon locally, very common in restricted CI containers or fresh Docker images), `spawn()` returns a `ChildProcess` whose `error` event fires asynchronously with `ENOENT`. With no listener, Node logs `Uncaught Exception: Error: spawn bun ENOENT` and the orchestrator crashes — but the message is misleading and the audit just dies without writing any report.

This is reachable in three real scenarios:

1. A fresh CI shell where the workflow forgot the `oven-sh/setup-bun@v2` step (or the cache miss path is broken).
2. A local dev who edits `PATH` for a debugging session and forgets to restore it.
3. A future Docker-based audit invocation where `bun` is not in the base image.

`runAuditWithPreview()` does check `child.exitCode` inside `waitForReady`, but spawn failures don't set `exitCode` — they fire `error` and `exit` may never fire. The current poll-and-fetch loop will simply time out after 30 seconds and emit the more generic "did not become ready" error, hiding the real cause.

## Suggested fix

Attach an `error` listener immediately after spawn, propagate the failure through the same error path as `waitForReady`'s timeout, and ensure cleanup runs:

```ts
function spawnPreview(): ChildProcess {
    const child = spawn("bun", ["run", NITRO_BUNDLE], {
        env: { ...process.env, PORT },
        stdio: ["ignore", "inherit", "inherit"],
    });
    child.on("error", (err) => {
        process.stderr.write(
            `[audit-fe] failed to spawn preview server: ${err.message}\n`,
        );
        // Surface as non-zero exit; the main flow's waitForReady catch will
        // see child.exitCode set or the polling loop will short-circuit.
        if (child.exitCode === null) child.kill("SIGKILL");
    });
    return child;
}
```

Optional refinement: have `waitForReady` also listen for `"error"` on the child and reject the polling Promise immediately, so the operator sees the spawn error in under a second rather than after the 30-second timeout. Pattern:

```ts
async function waitForReady(child: ChildProcess): Promise<void> {
    return new Promise<void>((resolve, reject) => {
        child.once("error", reject);
        // existing polling loop, calling resolve()/reject() as appropriate
    });
}
```

## Acceptance criteria

1. `PATH=/usr/bin make audit-fe` (with `bun` absent) fails within ~1 second with a message containing "failed to spawn preview server" — not a 30-second timeout.
2. `make audit-fe` happy path unchanged.
3. No orphan `bun` processes after a forced PATH miss (verify via `pgrep -lf '.output/server/index.mjs'`).
4. Unit test added: mock `spawn` to emit `error` immediately, assert `runAuditWithPreview` rejects.

## Triage

- Decision: `valid`
- Notes: Real bug. `spawnPreview` returns a ChildProcess with no `"error"` listener. On ENOENT
  (bun not in PATH), Node emits the error event unhandled → uncaught exception with misleading
  message. `waitForReady`'s `child.exitCode` check doesn't catch it because spawn failures
  emit `"error"`, not `"exit"`. The poll loop then waits the full 30 s before throwing the
  generic timeout message.

  Fix plan:
  1. Add `child.on("error", ...)` in `spawnPreview` that writes a clear message to stderr.
  2. Refactor `waitForReady` to track spawn errors via a `once("error", ...)` listener +
     flag variable; check flag at each poll iteration; clean up listener in `finally`.
     This surfaces the spawn error within one poll interval (~500 ms) rather than 30 s.

  Unit test for `runAuditWithPreview` (acceptance criterion 4) is not added here because
  no test file for `scripts/run-audit-fe.ts` is in the batch scope. The test would require
  mocking `child_process.spawn` which is out of scope for this batch. Recommend tracking
  as a follow-up task.
