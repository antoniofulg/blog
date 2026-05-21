---
provider: manual
pr:
round: 16
round_created_at: 2026-05-21T00:12:48Z
status: resolved
file: tests/e2e/db.ts
line: 158
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: `acquireUnnamedSlotLock` leaks pending `setTimeout` handle on every successful acquire

## Review Comment

Commit `586eebe` (round-015 fix for the lock-acquire-timeout) wraps `prev` in `Promise.race` against a timeout. Implementation in `tests/e2e/db.ts:158-171`:

```ts
return Promise.race([
    prev.then(() => {}),
    new Promise<void>((_, reject) =>
        setTimeout(
            () =>
                reject(
                    new Error(
                        `[pg-proxy] unnamed-slot lock held >${LOCK_ACQUIRE_TIMEOUT_MS}ms; acquire timeout`,
                    ),
                ),
            LOCK_ACQUIRE_TIMEOUT_MS,
        ),
    ),
]);
```

Two problems on the **happy path** (lock acquired within timeout):

1. **Timer leak.** The `setTimeout` returns a handle that is never captured and never cleared. `Promise.race` settles on `prev` resolving, but the timer keeps running until `LOCK_ACQUIRE_TIMEOUT_MS` (default 5 s) elapses. While pending, the timer keeps the Node event loop ref'd, preventing process exit. In a busy e2e suite with hundreds of acquires, hundreds of orphan timers accumulate; under Vitest's per-file process model the worker hangs at the close phase until the last timer fires. Already observed indirectly: the `locale.test.ts` run earlier reported `close timed out after 10000ms / something prevents Vite server from exiting`.

2. **Unhandled promise rejection.** When the orphan timer eventually fires (5 s after a successful acquire), it calls `reject(new Error(...))` on an inner Promise that `Promise.race` already discarded. Node ≥15 emits `UnhandledPromiseRejectionWarning` for every such rejection — and on newer Node defaults (`--unhandled-rejections=throw`) crashes the process. Hundreds of these in a single e2e session would flood stderr at minimum, or kill the worker at worst.

Test coverage for the new lock (`pglite-extended-query.test.ts > PGLite proxy: lock acquire timeout > stall: second connection gets a wire response within 2 s`) covers the timeout-fires path. The happy path with many fast acquires is exactly what produces the leak — not currently exercised.

## Why this matters

- **Vitest close-hang.** The orphan timers prevent the test process from exiting cleanly. Already manifesting as `close timed out after 10000ms` warnings on local runs. On CI with stricter shutdown semantics, this could cause the matrix step to time out at the suite boundary rather than at any individual test.
- **CI flake risk.** Node's `--unhandled-rejections` default flipped to `throw` in Node 15+. If a future runner image escalates the default, every successful acquire crashes the proxy 5 s after the request completes. The bug is dormant until that flip; then it's a full e2e blocker.
- **Resource accumulation.** Long-running headless or watch-mode invocations of the audit could pile up unbounded pending timers. Memory + handle count grows linearly with proxy traffic.

## Suggested fix

Capture the timer handle and `clearTimeout` on resolution. Replace `Promise.race` with a hand-written race that owns both settles:

```ts
return new Promise<void>((resolve, reject) => {
    let settled = false;
    const timer = setTimeout(() => {
        if (settled) return;
        settled = true;
        reject(
            new Error(
                `[pg-proxy] unnamed-slot lock held >${LOCK_ACQUIRE_TIMEOUT_MS}ms; acquire timeout`,
            ),
        );
    }, LOCK_ACQUIRE_TIMEOUT_MS);
    // node 'timer' refcount: keep it ref'd by default; do NOT timer.unref() —
    // we want it visible until cleared so we don't silently lose the timeout
    // semantic during graceful shutdown.
    prev.then(
        () => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            resolve();
        },
        (err) => {
            if (settled) return;
            settled = true;
            clearTimeout(timer);
            reject(err);
        },
    );
});
```

The `settled` flag protects against double-settle (timer fires while `prev` is also settling in the same tick).

## Acceptance criteria

1. A new test exercises 100 sequential acquires-and-releases and asserts the process can exit cleanly via `process._getActiveHandles().length === 0` (or equivalent) after the test completes — no orphan timers.
2. Same test asserts `process.on("unhandledRejection")` does not fire during the 100 acquires + 5 s grace period.
3. The existing stall test (`stall: second connection gets a wire response within 2 s …`) still passes with the rewritten acquire — the timeout path is unchanged.
4. Vitest no longer reports `close timed out after 10000ms` on a clean `bunx vitest run` invocation (regression sentinel for the orphan-timer class).

## Triage

- Decision: `valid`
- Notes: Confirmed. `Promise.race` at line 158–171 races `prev.then(() => {})` against a bare `setTimeout`. On the happy path `prev` resolves as a microtask, `Promise.race` settles, but the `setTimeout` handle is never cleared — it fires after the full `LOCK_ACQUIRE_TIMEOUT_MS` and calls `reject()` on a promise `Promise.race` already discarded, producing an unhandled rejection (Node ≥15 default: throw). Fix: replace with hand-written race that captures the timer handle, `clearTimeout(timer)` on `prev` resolution (both success and failure branches), and uses a `settled` flag to guard double-settle. Requires a minimal change to `tests/e2e/db.ts` only. New test added to `pglite-extended-query.test.ts`: 100 fast acquires with `PGLITE_LOCK_TIMEOUT_MS=50`, grace-period wait, explicit `unhandledRejection` listener asserts count=0.
