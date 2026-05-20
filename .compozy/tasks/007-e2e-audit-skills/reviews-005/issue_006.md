---
provider: manual
pr:
round: 5
round_created_at: 2026-05-20T04:06:44Z
status: pending
file: app/lib/app-audit/lighthouse.server.ts
line: 48
severity: low
author: claude-code
provider_ref:
---

# Issue 006: Lighthouse runner has no timeout or cancellation; can hang the audit indefinitely

## Review Comment

`app/lib/app-audit/lighthouse.server.ts` invokes `@lhci/cli` (or its underlying `lighthouse` runner) via a `runner.run()` call. The runner spawns a child Chromium process that controls Playwright's bundled binary (per ADR-006). No explicit timeout or cancellation wraps the run.

If lhci hangs (network timeout fetching Chrome version, Chromium DevTools protocol stall, infinite redirect on the target URL, lhci internal deadlock), the per-route Lighthouse invocation never resolves. The orchestrator at `checks.server.ts:68-79` wraps each Lighthouse call in a try/catch that emits a `sweep-error` on rejection — but `try/catch` does not enforce a timeout. The audit blocks on a single route indefinitely; CI eventually hits its job-level timeout (~6h on GHA default) and aborts the entire workflow.

Real-world likelihood: low on a personal blog with stable preview server; non-zero on CI runners with transient network blips during Lighthouse's initial perf-runs.

**Suggested fix:** wrap `runner.run(...)` in `Promise.race([runner.run(...), timeout(30_000)])` where `timeout(ms)` returns a rejecting promise after `ms` milliseconds. On timeout, the catch in `checks.server.ts:72-79` emits a `sweep-error` finding for the route. Document the 30s default in `.agents/rules/fe-audit.md` and expose it as a tunable via env var (`APP_AUDIT_LIGHTHOUSE_TIMEOUT_MS`) for users who legitimately need longer runs.

Bonus: ensure the lhci child process is terminated on timeout (call `runner.cancel()` or send SIGTERM to the spawned Chromium PID) so it doesn't leak between iterations. Without this, the next route's Lighthouse invocation may inherit a stale Chrome connection.

## Triage

- Decision: `UNREVIEWED`
- Notes:
