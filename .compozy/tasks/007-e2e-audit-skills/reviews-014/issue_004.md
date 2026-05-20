---
provider: manual
pr:
round: 14
round_created_at: 2026-05-20T22:56:13Z
status: resolved
file: tests/e2e/db.ts
line: 46
severity: high
author: claude-code
provider_ref:
---

# Issue 004: PGLite proxy `08P01` bind mismatch resurfaces on CI — round-9 fix incomplete under Linux concurrency

## Review Comment

PR #18 `quality (e2e)` job (https://github.com/antoniofulg/blog/actions/runs/26194697324/job/77071318482) reports:

```
[WebServer] PostgresError: bind message supplies 1 parameters, but prepared statement "" requires 2
    at ErrorResponse (/home/runner/work/blog/blog/.output/server/_libs/drizzle-orm+postgres.mjs:3552:27)

auth-flow.spec.ts > unauth login round-trip → redirect and session cookie set
    Error: expect(locator).toBeVisible() failed — element(s) not found
    Error: expect(received).toBe(expected) // Object.is equality
```

This is the **same `08P01` SQLSTATE** that round-9 issue 001 documented and that commit `f6c9b8d` was supposed to fix via the per-connection pipeline buffer in `tests/e2e/db.ts:46-135`. Local runs against macOS pass; CI Linux runs reproduce the bug.

The round-9 fix flushed the buffered messages atomically only when a pipeline-end marker (`Sync 0x53`, `SimpleQuery 0x51`, `Flush 0x48`) arrived on the socket. The hypothesis was that interleaving between TCP connections corrupted PGLite's unnamed prepared-statement slot. Two ways the fix could still be incomplete:

1. **Pipeline-end marker set incomplete.** The Postgres extended-query protocol has additional terminators that should release the unnamed statement slot, but the current detection only watches three byte values. Notably, `Close 0x43` and `CloseComplete` flows can also affect statement-slot state. Worth re-reading the extended-query protocol spec section against the implementation.
2. **Cross-connection state leak persists.** Even with per-connection buffering, the `pglite.execProtocolRaw` call is serialized through a single `enqueue` queue. The PGLite instance itself is shared across connections. PGLite may not actually maintain per-session unnamed-statement state — if it stores the unnamed statement on the singleton, two connections' Parse messages still alias the same slot, just flushed atomically. Atomicity does NOT equal isolation.
3. **Linux vs macOS event-loop scheduling.** GHA `ubuntu-latest` runners are smaller and busier than the operator's local machine. Tighter race windows for messages crossing the proxy.

Hypothesis 2 is the most likely. The round-9 fix solved the interleaving-within-a-pipeline problem but not the underlying single-statement-slot problem when two connections issue concurrent extended-query pipelines.

## Why this matters

- **Auth-flow PR-gate is the foundational regression net.** `auth-flow.spec.ts` is the single test that exercises Better Auth's login round-trip end-to-end. Red on every CI run means no admin-route work can ship until this clears.
- **Round-9 issue 001 was marked resolved.** That status is now stale. Re-opening or referencing it explicitly avoids the "resolved means done" trap that bit round-10 issues 001 + 002 (also surfaced as round-12 follow-ups when the resolution proved incomplete).
- **The audit's E2E gate cascades.** `app-audit.yml` walks admin routes via storageState which depends on the same login flow succeeding. Without auth-flow, admin audit findings are inaccessible.

## Suggested fix paths

### Path A — per-connection PGLite session (original round-9 Path A, re-attempt)

PGLite's API exposes `pglite.startSession?.()` (verify name against the pinned version) which creates an isolated wire-protocol context. Spawn one PGLite session per TCP connection in `startPgProxy` and route each socket's bytes through that session. Per-connection isolation, not just per-pipeline atomicity.

```ts
// In startPgProxy, per net.createServer callback:
const session = await pglite.startSession();   // isolated unnamed-statement slot
socket.on("data", (chunk) => {
    // existing buffer logic, then:
    enqueue(() => session.execProtocolRaw(batch));
});
```

The original round-9 triage explicitly mentioned this as the recommended Path A and was deferred because the round-9 fix (per-connection pipeline buffer) appeared sufficient at the time. Empirical CI evidence now invalidates that assumption.

### Path B — testcontainers Postgres for e2e (round-9 Path C)

Drop PGLite. Spin up `postgres:16-alpine` via `testcontainers` for the e2e suite. Real Postgres = correct extended-query semantics by definition. Trade-off: ~5s cold-start vs PGLite's <1s, Docker dependency.

ADR-001 chose PGLite over testcontainers. Reversal would need a new ADR superseding 001/004.

### Path C — `@flaky` quarantine the auth-flow spec (stop-gap)

Tag `auth-flow.spec.ts` with `@flaky 2026-05-20 reason: PGLite proxy 08P01 under CI concurrency; tracking reviews-014/issue_004` per `.agents/rules/testing.md` 48-hour SLA. Unblocks the PR while the real fix lands. NOT a real fix — tracked as a stop-gap, must clear within 48 h.

## Recommendation

Path A first, time-boxed to 2 hours. If PGLite's session API has changed between the pinned version and current docs, escalate to Path B (with an ADR). Path C only if the PR has a deadline pressure that cannot accommodate either A or B.

## Acceptance criteria

1. `quality (e2e)` matrix entry passes on CI for three consecutive runs (proves the fix is concurrency-stable, not lucky).
2. `[WebServer]` stdout shows zero `PostgresError: bind message supplies` occurrences during the spec run.
3. `app/tests/pglite-extended-query.test.ts` gains a new test simulating the high-concurrency scenario: ≥4 parallel TCP connections each issuing Parse+Bind+Execute against the same unnamed-statement slot — assert all 4 succeed without 08P01.
4. ADR-004 (or a new ADR) documents the chosen fix path + rationale (especially if reversing to testcontainers).
5. Round-9 issue 001 is annotated with a "regressed under CI concurrency; reopened as reviews-014/issue_004" note to break the "resolved means done" trap.

## Triage

- Decision: `valid`
- Notes: PGLite 0.4.5 (installed version) has no `startSession` API — confirmed by grepping the type definitions. Root cause: when Connection A sends Parse+Sync as pipeline 1, then B sends Parse+Sync interleaved (queue becomes [A_p1, B_p1, A_p2]), B's Parse overwrites the unnamed "" prepared statement slot before A's Bind pipeline runs. The per-connection pipeline buffer prevents within-pipeline interleaving but NOT cross-pipeline interleaving from different connections. Fix: connection-level serialization — one TCP connection holds exclusive PGLite access until Terminate ('X') or socket close, so all of A's pipelines run before any of B's. This replaces the global `enqueue` with a per-connection queue + a connection-level lock. PGLite 0.4.5 `runExclusive` is per-call, not per-session, so it doesn't help. New test added for ≥4 concurrent connections with split Parse/Bind pipelines.
