---
provider: manual
pr:
round: 8
round_created_at: 2026-05-20T04:53:28Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 1
severity: high
author: claude-code
provider_ref:
---

# Issue 001: Preflight sweep-error severity is major — exit code 0 hides vacuous audit from CI

## Review Comment

Round 7 issue 002 fix added a preflight reachability check that emits a `sweep-error` finding when `baseUrl` is unreachable. The current finding is emitted with `severity: "major"` (inferred from latest report `docs/_reports/app-audit-2026-05-20.md`):

```
**Findings**: 1 (0 blocker / 1 major / 0 minor)

## sweep-error
- **sweep-error** (`preflight`)
  - [app-audit] baseUrl http://localhost:4173 unreachable — start preview server first (bun preview) or pass --baseUrl=<url>
```

`scripts/audit-fe.ts:48` computes `exitCode: blockers > 0 ? 1 : 0`. With zero blockers, the CLI exits 0. The CI workflow + composite `make audit` interpret exit 0 as "audit succeeded." But in this run zero routes were inspected — the audit is vacuous. Anyone consuming exit codes (CI gate logic, downstream `make audit` step, future `[audit-counts]` parser, GH Action conditional steps) sees a successful run with no findings, hiding the real failure (no preview server).

This is the inverse of the round 4 issue 001 concern: a HIGH-severity correctness gap where a missing system condition produces a false-success signal. PR-007 user story for `make audit` explicitly says "verify the full content + runtime quality picture before pushing" — a preflight failure means that picture is empty, which the developer must NOT mistake for "all clean."

A preflight failure is fundamentally different from a per-route probe failure. Per-route sweep-errors as `major` is correct (other routes still got audited; partial coverage). Preflight failure as `major` is wrong (zero coverage; nothing actionable was checked).

**Suggested fix:** classify preflight-failure sweep-errors as `blocker` (not `major`). Two implementation paths:

1. **Severity bump at emission site**: in the preflight code (likely in `checks.server.ts` or a helper), pass `severity: "blocker"` when emitting the unreachable-baseUrl finding.
2. **Dedicated `preflight-error` category** with default `severity: "blocker"`: cleaner semantically (see issue 003 in this round for the case for a separate category) but requires updating the AppAuditCategory union + reporter + `.agents/rules/fe-audit.md`.

Path 1 is minimal-change and ships the right signal immediately. Path 2 is the cleaner long-term shape.

Add a Vitest test: `runAppAudit({ baseUrl: "http://localhost:99999" })` returns findings with at least one entry where `severity === "blocker"` and the orchestrator wrapper in `scripts/audit-fe.ts` would exit with code 1.

## Triage

- Decision: `valid`
- Notes: Confirmed — preflight emission in `checks.server.ts:58-65` used `category: "sweep-error", severity: "major"`. Exit code computed as `blockers > 0 ? 1 : 0`, so major-only exit = 0 = false success. Implemented path 2 (dedicated `preflight-error` category) jointly with issue 003 to avoid future semantic overload. Changed to `category: "preflight-error", severity: "blocker"`. Updated test expectation in `app/tests/app-audit-checks.test.ts` (preflight test now expects `preflight-error`/`blocker`).
