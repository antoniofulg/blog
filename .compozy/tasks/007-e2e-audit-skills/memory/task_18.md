---
name: task-18-memory
description: Task-local execution context for task_18 — app-audit checks orchestrator + reporter + SUMMARY migration + vite stub
metadata:
  type: project
---

# Task Memory: task_18 — COMMITTED

## Objective Snapshot

Implemented `runAppAudit()` orchestrator (checks.server.ts), `writeReport()` + `initSummary()` reporter (reporter.server.ts), 5-entry vite stub addition, 25 unit/integration tests. Committed at 4160c49.

## Important Decisions

- `runAppAudit(opts: { lighthouse: boolean; baseUrl?: string })` — added optional `baseUrl` (defaults to `process.env.AUDIT_BASE_URL ?? "http://localhost:3000"`).
- Lighthouse runs ONCE per route×locale (not per auth-state) — avoids duplicate calls on same URL.
- Admin storageState: try `readFile(tests/e2e/.auth/admin.json)` — silently fallback to anon context if absent.
- New page per inspection (route×locale×authState) to avoid listener accumulation from sweepRoute's `page.on()` calls.
- `AppAuditCategory` + `AppAuditFinding` re-exported from `checks.server.ts` (defined in browser-sweep.server.ts).
- `initSummary()` migration: regex-based replace, atomic write via rename.
- Idempotency check: `content.includes("| Type")` is sufficient.

## Files / Surfaces

- NEW: `app/lib/app-audit/checks.server.ts`
- NEW: `app/lib/app-audit/reporter.server.ts`
- MODIFIED: `vite.config.ts` (5 new IDs + stub exports for runAppAudit, initSummary, sweepRoute, analyzeA11y, runLighthouse, lighthouseToFindings)
- NEW: `app/tests/app-audit-checks.test.ts` (11 tests)
- NEW: `app/tests/app-audit-reporter.test.ts` (14 tests)

## SUMMARY.md Note

Integration tests append rows to SUMMARY.md — restore via `git checkout -- docs/audits/SUMMARY.md` before committing. Same pattern as task_13.

## Learnings

- `vi.spyOn(module, "fn")` fails on ESM node:fs/promises — use behavioral test instead.
- biome `lint/style/useTemplate` on string concat must be fixed manually (unsafe fix).

## Ready for Next Run

task_18 DONE and COMMITTED (4160c49). task_19 (CLI + workflow) is next.
