---
provider: manual
pr:
round: 15
round_created_at: 2026-05-20T23:57:31Z
status: resolved
file: tests/e2e/db.ts
line: 76
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: PGLite unnamed-slot lock has no acquisition timeout — half-open socket can stall all proxy traffic

## Review Comment

Commit `c57f8bf` (round-014 fix for the `08P01` CI regression) introduced a per-connection lock on the PGLite unnamed prepared-statement slot. The lock is acquired when a batch contains `Parse("")` and released when a batch contains `Bind("")`, on connection close, on connection error, or on Terminate (`X`).

Implementation in `tests/e2e/db.ts:76-200` (relevant excerpt):

```ts
let unnamedSlotLock: Promise<void> = Promise.resolve();
// ...
const acquireUnnamedSlotLock = (): Promise<void> => {
    if (lockRelease !== null) return Promise.resolve();
    let resolve!: () => void;
    const mySlot = new Promise<void>((r) => { resolve = r; });
    const prev = unnamedSlotLock;
    unnamedSlotLock = mySlot;
    lockRelease = resolve;
    return prev;
};
```

The lock chain works correctly for the common case (Parse+Bind in one pipeline, or two pipelines on the same connection). It also works when the lock-holding connection cleanly closes or errors out — those paths invoke `releaseUnnamedSlotLock()` in the `close` and `error` socket listeners.

**The gap**: nothing rescues the lock if a connection holds it without sending Bind AND without the socket triggering `close`/`error`.

Real scenarios where this happens:

1. **Half-open TCP connection.** Client process dies between `Parse+Sync` and `Bind+Execute+Sync`. The kernel doesn't notice until TCP keep-alive expires (default on Linux: 2 hours).
2. **Slow client between pipelines.** Drizzle / postgres-js sends `Parse+Sync` in one event-loop tick and `Bind+Execute+Sync` after a `setImmediate` or microtask boundary. Under heavy event-loop pressure on a CI runner, the gap could stretch; another connection's `Parse+Sync` waits on the lock during that window. Probably tens to hundreds of milliseconds in practice — not catastrophic, but worth bounding.
3. **PGLite stall.** If `pglite.execProtocolRaw(parse_batch)` rejects without firing the `error` listener path on the socket, the lock holder finishes its `enqueue` call but the lock is not released (releasesLock=false for Parse-only batches). Today the only error path catches this and calls `releaseUnnamedSlotLock()` — but it's coupled to the enqueue rejection path, not to the lock itself. A future refactor could miss it.

Test coverage for the new lock (`pglite-extended-query.test.ts` "4 connections with separate Parse/Bind pipelines") exercises the happy path, not the stall path. Adding a timeout-and-test combo would tighten the safety net.

## Why this matters

- **Single half-open client stalls the whole proxy.** Every other auth-related query through PGLite — login, route walks, page loads — blocks on the held lock. The e2e suite would see cascading timeouts that look like flaky tests, when the root cause is one stuck pipeline.
- **No observable signal.** The proxy has no logging when a lock is held longer than expected. Operator debugging a flaky e2e run sees `expect(...).toBeVisible() failed` and assumes a UI flake; the real cause is invisible.
- **Production risk is zero, test-environment risk is real.** This proxy only ships for e2e (per ADR-001 + ADR-004). But e2e is the gate that protects production — a stall there blocks merges.

## Suggested fix

Add a configurable acquire-timeout. On timeout, log + force-release + signal the requesting connection with an `ErrorResponse` so the wire-protocol contract stays clean.

```ts
const LOCK_ACQUIRE_TIMEOUT_MS =
    Number(process.env.PGLITE_LOCK_TIMEOUT_MS ?? "5000");

const acquireUnnamedSlotLock = (): Promise<void> => {
    if (lockRelease !== null) return Promise.resolve();
    let resolve!: () => void;
    const mySlot = new Promise<void>((r) => { resolve = r; });
    const prev = unnamedSlotLock;
    unnamedSlotLock = mySlot;
    lockRelease = resolve;

    // Race the previous-holder release against a deadline.
    return Promise.race([
        prev,
        new Promise<void>((_, reject) =>
            setTimeout(
                () => reject(new Error("PGLite unnamed-slot lock acquire timeout")),
                LOCK_ACQUIRE_TIMEOUT_MS,
            ),
        ),
    ]);
};
```

Pair with explicit lock-stuck telemetry in the rejection handler — e.g., `console.error("[pg-proxy] lock held > ${LOCK_ACQUIRE_TIMEOUT_MS}ms; forcing release")` — so operators can see when this fires.

Also consider: a TCP-level socket-inactivity timeout (`socket.setTimeout(60_000)`) so half-open clients are dropped at the connection layer well before TCP keep-alive notices.

## Acceptance criteria

1. New test in `app/tests/pglite-extended-query.test.ts` opens a connection, sends `Parse+Sync`, then deliberately stalls (no Bind, no socket close) — assert that a second connection's `Parse+Sync` either succeeds within the lock timeout OR rejects with the expected timeout error within 6 seconds (not 30 seconds vitest default).
2. `socket.setTimeout(N)` is wired so half-open connections are reaped before TCP keep-alive.
3. The acquire-timeout is configurable via env var (`PGLITE_LOCK_TIMEOUT_MS`) with a 5 s default.
4. Existing happy-path test (`high concurrency: 4 connections with separate Parse/Bind pipelines`) still passes with the timeout in place.

## Triage

- Decision: `valid`
- Notes: `acquireUnnamedSlotLock` returns `prev.then(() => {})` with no timeout. A connection that sends Parse+Sync and then stalls (half-open TCP, crashed client) holds `lockRelease !== null` forever — every subsequent connection's Parse pipeline queues behind it indefinitely. Fix: `Promise.race([prev.then(() => {}), timeout(LOCK_ACQUIRE_TIMEOUT_MS)])` so the waiting connection gets an ErrorResponse instead of hanging. Also add `socket.setTimeout(60_000)` so the stuck socket itself is eventually reaped at the connection layer.
