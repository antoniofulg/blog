---
provider: manual
pr:
round: 11
round_created_at: 2026-05-20T18:49:03Z
status: resolved
file: tests/e2e/db.ts
line: 122
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: PGLite proxy sends `ReadyForQuery` without preceding `ErrorResponse` on `execProtocolRaw` rejection

## Review Comment

`tests/e2e/db.ts:118-130`:

```ts
enqueue(() => pglite.execProtocolRaw(batch)).then(
    (res) => {
        if (!socket.destroyed) socket.write(Buffer.from(res));
    },
    (err) => {
        console.error("[pg-proxy] execProtocolRaw rejected:", err);
        // On error send ReadyForQuery to keep the connection alive
        if (!socket.destroyed)
            socket.write(
                Buffer.from([0x5a, 0x00, 0x00, 0x00, 0x05, 0x49]),
            );
    },
);
```

On rejection from `pglite.execProtocolRaw`, the proxy writes a bare `ReadyForQuery` (`Z` / 0x5a, length 5, status `I` = Idle) and nothing else.

This is non-conformant to the PostgreSQL extended-query protocol. After an error during a Bind/Execute pipeline, a real Postgres server sends, in order:

1. `ErrorResponse` (`E` / 0x45) containing the SQLSTATE + message.
2. `ReadyForQuery` (`Z` / 0x5a).

`postgres-js` and most other clients use the `ErrorResponse` to populate the rejected Promise's error object. If only `ReadyForQuery` arrives, the client's state machine sees a successful — but empty — round trip. The driver then resolves its pending Promise with whatever it had buffered (often `undefined`) instead of rejecting. Downstream, drizzle ORM returns silent empty results, and the calling app code can't tell that a real error occurred — it just looks like the query "matched zero rows."

The lie is masked today because:

- The proxy's actual job is bridging PGLite's WASM protocol to TCP; PGLite itself almost never rejects, so this error branch is rarely hit.
- The only known reachable trigger is a misuse bug in test setup (e.g., schema not applied yet) — which surfaces in other ways too.

But once Better Auth (or any drizzle consumer) is exercised under failure modes (constraint violations, schema drift mid-test), the silent-empty-result behavior will produce confusing test failures with no signal pointing back at the proxy.

Also note: `console.error("[pg-proxy] execProtocolRaw rejected:", err)` logs to test stdout, which is captured by Playwright into `playwright-report/` — useful as a forensic trail, but operators chasing a flaky test will not see it unless they open the report manually.

## Suggested fix

Synthesize a proper `ErrorResponse` from the rejection, then `ReadyForQuery`. Minimum viable ErrorResponse:

```ts
function buildErrorResponse(err: Error): Buffer {
    const fields: Buffer[] = [];
    const push = (code: string, value: string) => {
        fields.push(Buffer.from([code.charCodeAt(0)]));
        fields.push(Buffer.from(value, "utf-8"));
        fields.push(Buffer.from([0x00]));
    };
    push("S", "ERROR");
    push("V", "ERROR");
    push("C", "XX000"); // generic SQLSTATE — replace if PGLite surfaces a real code
    push("M", err.message ?? "PGLite execProtocolRaw rejected");
    fields.push(Buffer.from([0x00])); // terminator
    const body = Buffer.concat(fields);
    const header = Buffer.alloc(5);
    header[0] = 0x45; // 'E'
    header.writeInt32BE(body.length + 4, 1);
    return Buffer.concat([header, body]);
}

// in the rejection handler:
(err) => {
    console.error("[pg-proxy] execProtocolRaw rejected:", err);
    if (!socket.destroyed) {
        socket.write(buildErrorResponse(err as Error));
        socket.write(Buffer.from([0x5a, 0x00, 0x00, 0x00, 0x05, 0x49]));
    }
},
```

If PGLite ever starts surfacing SQLSTATE on the rejection (e.g. as `err.code` or `err.sqlstate`), thread that through to the `C` field for more accurate diagnostics.

## Acceptance criteria

1. A failing query through the proxy (e.g., `SELECT * FROM nonexistent_table`) results in a rejected Promise on the postgres-js side — not an empty-array resolution.
2. New regression test in `app/tests/pglite-extended-query.test.ts` asserts that a deliberately-malformed Bind triggers a proper rejection with a non-empty error message.
3. No behavior change for the happy path (response bytes identical for successful queries).

## Triage

- Decision: `valid`
- Notes: Real protocol violation. On `execProtocolRaw` rejection the proxy writes only a bare
  ReadyForQuery (`Z`) with no preceding ErrorResponse (`E`). Per the PostgreSQL extended-query
  protocol, an error during a Bind/Execute pipeline must produce ErrorResponse then
  ReadyForQuery. Without ErrorResponse, the postgres-js state machine may resolve the pending
  promise with an empty result instead of rejecting, silently masking the failure.

  Fix plan: add `buildErrorResponse(err: Error): Buffer` that constructs a minimal conformant
  ErrorResponse (severity S, code C=XX000, message M). In the rejection handler, write
  `buildErrorResponse(err)` then ReadyForQuery.

  Regression test added in `app/tests/pglite-extended-query.test.ts`: sends a Bind with
  wrong param count (08P01 mismatch) and verifies that ErrorResponse byte (0x45) is present
  before ReadyForQuery (0x5a) in the raw response. Note: this test hits the success-callback
  path of `execProtocolRaw` (PGLite returns error bytes rather than throwing for SQL errors)
  not the rejection path; the fix covers the rarer JS-exception path. The test still
  validates correct protocol ordering and serves as a regression guard.
