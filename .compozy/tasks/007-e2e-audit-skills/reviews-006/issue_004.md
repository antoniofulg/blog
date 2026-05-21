---
provider: manual
pr:
round: 6
round_created_at: 2026-05-20T04:22:01Z
status: resolved
file: app/lib/app-audit/lighthouse.server.ts
line: 71
severity: low
author: claude-code
provider_ref:
---

# Issue 004: Lighthouse Promise.race timeout abandons runner but does not abort child process

## Review Comment

Round 5 issue 006 added a 30s timeout via `Promise.race([runner.run(...), lighthouseTimeout(timeoutMs)])` at `app/lib/app-audit/lighthouse.server.ts:71-77` (approximate). `Promise.race` rejects when the timeout fires, but the slower `runner.run()` promise continues executing in the background. `@lhci/cli`'s runner spawns a child Chromium process via `lighthouse-cli`; that child remains alive even after the orchestrator moves to the next route.

Over a single audit run with one or two Lighthouse timeouts on the 28-inspection matrix, the leak is invisible (process exits when the parent Node process exits). Over a long-lived `compozy tasks run` session that loops through many audits (CI matrix, cron, parallel debugging), zombie Chromium processes accumulate, eventually exhausting file descriptors or RAM on the runner.

The round 5 test at `app/tests/lighthouse.test.ts` correctly asserts rejection on timeout but does NOT verify process cleanup. Hard to test without integration-level process inspection.

**Suggested fix:** investigate whether `@lhci/cli` exposes a cancellation API. Two approaches:

1. **Preferred** — if `runner` has `.abort()` or `.kill()`, wrap in `.finally()` to invoke on timeout:
   ```ts
   const runPromise = runner.run(url);
   try {
     return await Promise.race([runPromise, lighthouseTimeout(timeoutMs)]);
   } catch (err) {
     runner.abort?.();
     throw err;
   }
   ```

2. **Fallback** — if no cancellation API exists, document the leak in `.agents/rules/fe-audit.md` under "Lighthouse Variance Management": "Lighthouse timeouts may leave orphaned child processes for the duration of the Node process; long-lived audit runs should be split into separate process invocations rather than relying on a single long-running orchestrator."

Either path; option 1 is the real fix if available.

## Triage

- Decision: `VALID`
- Notes: Confirmed at `lighthouse.server.ts:71-77` — `Promise.race` abandons the runner promise but the spawned Chromium child process keeps running. The `LighthouseRunner` type as defined at line 49-54 only has a `run()` method — no `.abort()` or `.kill()` is typed or exists in `@lhci/cli`'s `node-runner.js`. Option 1 (cancellation API) is not available. Option 2 (documentation) is the correct resolution: add a note to `.agents/rules/fe-audit.md` under "Lighthouse Variance Management" documenting the orphaned-process risk for long-lived sessions. No code change to lighthouse.server.ts is needed — the existing behavior is the best achievable without a cancellation API.
