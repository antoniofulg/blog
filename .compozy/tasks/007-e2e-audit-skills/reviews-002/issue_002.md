---
provider: manual
pr:
round: 2
round_created_at: 2026-05-19T15:08:24Z
status: resolved
file: tests/e2e/db.ts
line: 53
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: PG proxy enqueue swallows execProtocolRaw errors without logging

## Review Comment

`startPgProxy` builds a per-server promise queue (`tests/e2e/db.ts:50-58`) so PGLite's single-client constraint is honored across multiple TCP sockets. The pattern is:

```ts
let queue: Promise<Uint8Array | undefined> = Promise.resolve(undefined);
const enqueue = (fn: () => Promise<Uint8Array>): Promise<Uint8Array> => {
    const next = queue.then(() => fn()) as Promise<Uint8Array>;
    queue = next.then(() => undefined, () => undefined);  // ← both branches resolve
    return next;
};
```

The `queue` chain intentionally swallows rejections so a failing `execProtocolRaw` call does not poison subsequent enqueues. This part is correct.

The problem is downstream: when `enqueue(...)` rejects (PGLite threw), the caller at L108-113 catches the rejection but only responds to the socket with a bare `ReadyForQuery` (`0x5a, 0x00, 0x00, 0x00, 0x05, 0x49`). The error is never logged, never reported to stderr, never surfaced anywhere a developer or CI consumer can see. From the test's perspective, the spec sees a clean "ready" state with whatever stale data the previous query left. Diagnosing a wire-protocol failure (PGLite version skew, malformed message buffer, race in the proxy) requires reproducing the failure locally with extra instrumentation, which is exactly the situation the proxy was supposed to make easier.

This is the same anti-pattern that round 1 issue 006 flagged in `getPostInventory` (silent catch). The fix there was to write to stderr. The same applies here.

**Suggested fix:** in the rejection handler at L108-113 (the `.then(_, errorCb)` second argument), log the error via `console.error('[pg-proxy] execProtocolRaw rejected:', err)` (or `process.stderr.write(...)` for symmetry with the round 1 site-model fix) before sending `ReadyForQuery`. Add a unit test that injects a forced PGLite error and asserts the stderr output contains the expected diagnostic line.

## Triage

- Decision: `valid`
- Root cause: The `.then(_, errorCb)` rejection handler in `startPgProxy` (db.ts:108-112) sends a bare `ReadyForQuery` on `execProtocolRaw` failure with no logging. Errors silently disappear; a developer or CI consumer has no way to diagnose wire-protocol failures without adding extra instrumentation.
- Fix applied: Added `console.error("[pg-proxy] execProtocolRaw rejected:", err)` as the first statement of the error callback before sending `ReadyForQuery`. The `err` parameter was also named (was anonymous `() =>`).
