---
provider: manual
pr:
round: 11
round_created_at: 2026-05-20T18:49:03Z
status: resolved
file: app/tests/pglite-extended-query.test.ts
line: 86
severity: low
author: claude-code
provider_ref:
---

# Issue 003: `readUntilReady` test helper hangs indefinitely if `ReadyForQuery` never arrives

## Review Comment

`app/tests/pglite-extended-query.test.ts:86-104`:

```ts
async function readUntilReady(
    socket: net.Socket,
): Promise<{ hasError: boolean; raw: Buffer }> {
    return new Promise((resolve) => {
        let acc = Buffer.alloc(0);
        const onData = (chunk: Buffer) => {
            acc = Buffer.concat([acc, chunk]);
            for (let i = 0; i <= acc.length - 6; i++) {
                if (acc[i] === 0x5a && acc.readInt32BE(i + 1) === 5) {
                    socket.removeListener("data", onData);
                    const hasError = acc.includes(Buffer.from("08P01")); // bind-param mismatch SQLSTATE
                    resolve({ hasError, raw: acc });
                    return;
                }
            }
        };
        socket.on("data", onData);
    });
}
```

The helper assumes the proxy will always send a `ReadyForQuery` (Z / 0x5a) byte sequence. Three failure modes leave the Promise unresolved forever:

1. **Proxy crashes mid-pipeline** — exactly the failure mode the regression test is designed to catch (issue 001 of round 009). If the buffer logic regresses and the proxy panics on the second connection's Bind, no `Z` is ever emitted; the test hangs until vitest's global timeout (default 30s).
2. **Connection closed by proxy** — `socket.on("close")` is not wired up. If the proxy closes the socket on error (current behavior in some code paths), the Promise never resolves.
3. **Connection error mid-stream** — `socket.on("error")` is not wired up. A network-level failure leaves the Promise dangling.

Under any of these, the test fails — but slowly, with a generic "test timed out" message that points at the test rather than the actual proxy fault. Triaging the regression on a future failure takes 5x longer than it should.

A test that's supposed to prove the proxy works should fail loudly and fast when the proxy doesn't.

## Suggested fix

Add `AbortSignal.timeout` (or a manual timer), wire `close` and `error` listeners, and reject with diagnostic context:

```ts
async function readUntilReady(
    socket: net.Socket,
    timeoutMs = 5_000,
): Promise<{ hasError: boolean; raw: Buffer }> {
    return new Promise((resolve, reject) => {
        let acc = Buffer.alloc(0);
        const timer = setTimeout(() => {
            cleanup();
            reject(
                new Error(
                    `[readUntilReady] no ReadyForQuery within ${timeoutMs}ms; accumulated ${acc.length} bytes`,
                ),
            );
        }, timeoutMs);
        const cleanup = () => {
            clearTimeout(timer);
            socket.removeListener("data", onData);
            socket.removeListener("close", onClose);
            socket.removeListener("error", onError);
        };
        const onData = (chunk: Buffer) => {
            acc = Buffer.concat([acc, chunk]);
            for (let i = 0; i <= acc.length - 6; i++) {
                if (acc[i] === 0x5a && acc.readInt32BE(i + 1) === 5) {
                    cleanup();
                    const hasError = acc.includes(Buffer.from("08P01"));
                    resolve({ hasError, raw: acc });
                    return;
                }
            }
        };
        const onClose = () => {
            cleanup();
            reject(
                new Error(
                    `[readUntilReady] socket closed before ReadyForQuery; accumulated ${acc.length} bytes`,
                ),
            );
        };
        const onError = (err: Error) => {
            cleanup();
            reject(new Error(`[readUntilReady] socket error: ${err.message}`));
        };
        socket.on("data", onData);
        socket.on("close", onClose);
        socket.on("error", onError);
    });
}
```

`timeoutMs = 5_000` is intentionally tight — the local PGLite proxy should respond in under a second; anything beyond that points at a real regression.

## Acceptance criteria

1. A deliberate regression that prevents the proxy from emitting `ReadyForQuery` causes the test to fail within ~5 seconds, with a message containing "no ReadyForQuery within 5000ms" — not vitest's 30s timeout.
2. The happy-path test (the existing case) still passes with the same final assertion.
3. Cleanup is idempotent: invoking `cleanup()` twice does not throw.

## Triage

- Decision: `valid`
- Notes: Real defect. `readUntilReady` wraps a Promise that only ever resolves — no timeout,
  no `"close"` handler, no `"error"` handler. If the proxy crashes or closes the socket
  before emitting ReadyForQuery, the test hangs until vitest's global timeout (default 30 s)
  with a generic "test timed out" message that points at the test, not the proxy fault.

  Fix plan: add `setTimeout` (5 000 ms), `onClose`, and `onError` listeners; extract shared
  `cleanup()` that clears the timer and removes all three socket listeners; reject with a
  diagnostic message on timeout, close, or error; clean up on resolve too. Idempotent
  because `clearTimeout` on an already-fired ID is a no-op and `removeListener` on
  already-removed listener is a no-op.
