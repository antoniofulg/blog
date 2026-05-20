---
status: completed
title: App-audit checks orchestrator + reporter + SUMMARY migration + vite stub
type: backend
complexity: medium
dependencies:
  - task_17
  - task_02
feature: audit/app-audit-orchestrator
---

# Task 18: App-audit checks orchestrator + reporter + SUMMARY migration + vite stub

## Overview

Implement the `runAppAudit({ lighthouse })` orchestrator that iterates the 28-inspection matrix (`routes × locales × auth-state`), wires the three probe modules from task_17 together, and aggregates findings into `AppAuditFinding[]`. Implement the reporter that writes per-run markdown reports + appends to `docs/audits/SUMMARY.md` with the new `Type` column (including idempotent migration of pre-Phase-4 rows). Add all 5 app-audit modules to `vite.config.ts:serverOnlyStubPlugin`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/lib/app-audit/checks.server.ts` exporting `runAppAudit(opts: { lighthouse: boolean }): Promise<AppAuditFinding[]>` per TechSpec "Core Interfaces → app-audit/checks.server.ts". Orchestrates the 28-inspection matrix using `getRouteInventory()` × `LOCALES` × `["anon", "admin"]`.
- MUST conditionally skip Lighthouse adapter invocation when `opts.lighthouse === false`; ALL other adapters always run.
- MUST export the `AppAuditCategory` union (12 entries including `sweep-error` per ADR-006) and `AppAuditFinding` type as named exports.
- MUST create `app/lib/app-audit/reporter.server.ts` exporting `writeReport(findings, triggerLabel): Promise<void>` and `initSummary(): Promise<void>`. `writeReport` writes `docs/_reports/app-audit-YYYY-MM-DD.md` + appends a row to `docs/audits/SUMMARY.md` with `Type: app`.
- MUST implement `initSummary()` migration logic per ADR-006: detects pre-Phase-4 SUMMARY format (no `Type` column in header), parses existing rows, inserts `content` value in the new column, writes back atomically (temp file + rename). Idempotent — re-runs on already-migrated files are no-ops.
- MUST import `escapeMarkdownCell` from `app/lib/content-audit/reporter.server.ts` (no duplication) and `formatFingerprint` from `tests/e2e/audit-fingerprint.ts` (task_16's module).
- MUST add all 5 `app/lib/app-audit/*.server.ts` paths to `vite.config.ts:serverOnlyStubPlugin` id list.
- MUST severity-sort findings before picking the "top finding" for SUMMARY row (mirrors round 2 issue 005 fix on content-audit).
</requirements>

## Subtasks

- [x] 18.1 Create `app/lib/app-audit/checks.server.ts` with types + `runAppAudit()` orchestrator wiring browser-sweep + a11y-adapter + (conditional) lighthouse adapter across the 28-inspection matrix.
- [x] 18.2 Create `app/lib/app-audit/reporter.server.ts` with `writeReport()` + `initSummary()` migration logic. Reuse `escapeMarkdownCell` and `formatFingerprint` per requirements.
- [x] 18.3 Update `vite.config.ts:serverOnlyStubPlugin` to add 5 new server-only module ids.
- [x] 18.4 Create `app/tests/app-audit-checks.test.ts` covering matrix iteration + severity classification + Lighthouse-skip path.
- [x] 18.5 Create `app/tests/app-audit-reporter.test.ts` covering report shape + SUMMARY migration idempotency + atomic write.
- [x] 18.6 Verify `bun run build` excludes app-audit modules from client bundle (grep generated bundle for `runAppAudit` — should be absent).

## Implementation Details

See TechSpec "Build Order Phase 4 — steps 47-49" and "Core Interfaces". The orchestrator composes task_17's probes; the reporter mirrors content-audit's reporter pattern (PR-comment delta + SUMMARY append) with the new `Type` column and migration step.

### Relevant Files

- `app/lib/app-audit/browser-sweep.server.ts` (task_17) — probe layer; orchestrator calls per route.
- `app/lib/app-audit/a11y-adapter.server.ts` (task_17) — a11y probe.
- `app/lib/app-audit/lighthouse.server.ts` (task_17) — Lighthouse probe (conditional).
- `app/lib/site-model.server.ts` (task_02) — `getRouteInventory()` source; `LOCALES` import via `#/lib/locale`.
- `app/lib/content-audit/reporter.server.ts` (task_12) — `escapeMarkdownCell` helper to import.
- `tests/e2e/audit-fingerprint.ts` (task_16) — `formatFingerprint("app", ...)` source.
- `docs/audits/SUMMARY.md` — target of migration + append; existing schema is pre-Phase-4 (no Type column).
- `vite.config.ts` — `serverOnlyStubPlugin` config block; existing entries cover content-audit + site-model modules.

### Dependent Files

- `scripts/audit-fe.ts` (task_19) — CLI entry consumes `runAppAudit()` + `writeReport()`.
- `.github/workflows/app-audit.yml` (task_19) — triggers the CLI; verifies report artifact + SUMMARY append.

### Related ADRs

- [ADR-005: Revive app-audit as Phase 4](../adrs/adr-005.md) — defines categories, severities, coverage matrix.
- [ADR-006: TechSpec implementation primitives for Phase 4](../adrs/adr-006.md) — locks SUMMARY `Type` column + migration + atomic write semantics.

## Acceptance Criteria

1. **AC-1**: `runAppAudit({ lighthouse: false })` against a fixture site-model with 2 routes × 2 locales × 2 auth-states returns 8 inspection results; Lighthouse-related categories (`perf-budget-breach`, `seo-score-drop`, `best-practices-fail`) are absent.
2. **AC-2**: `runAppAudit({ lighthouse: true })` against the same fixture invokes the Lighthouse adapter once per route × locale (8 invocations); Lighthouse categories may appear.
3. **AC-3**: `writeReport([...], "manual")` creates `docs/_reports/app-audit-<today>.md` with sections for all 12 categories represented (even if empty); appends one row to `docs/audits/SUMMARY.md` with `Type: app` + severity counts + top finding.
4. **AC-4**: `initSummary()` on a fixture pre-Phase-4 SUMMARY.md (header without `Type` column, 3 existing rows) produces a post-migration file: header includes `Type` column, all 3 existing rows have `content` in the new column.
5. **AC-5**: `initSummary()` invoked twice consecutively is idempotent — second invocation detects the column already exists and is a no-op (no duplicated header, no re-backfilled rows).
6. **AC-6**: Severity-sort: a findings array containing `[blocker, minor, major]` (in that order) produces a SUMMARY row whose "top finding" reflects the blocker entry, not the array's `[0]`.
7. **AC-7**: Client bundle build (`bun run build`) succeeds; output does NOT contain the string `runAppAudit` (server-only stub working).

## Deliverables

- New file `app/lib/app-audit/checks.server.ts`.
- New file `app/lib/app-audit/reporter.server.ts`.
- Modified `vite.config.ts` (5-line addition to stub plugin list).
- New file `app/tests/app-audit-checks.test.ts`.
- New file `app/tests/app-audit-reporter.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for full orchestrator + reporter pipeline **(REQUIRED)**.

## Tests

- Unit tests:
  - [x] Orchestrator: 28-inspection matrix produces 28 result entries on a fully-populated fixture site-model.
  - [x] Orchestrator: Lighthouse adapter called once per route×locale when `lighthouse: true`; zero times when `lighthouse: false`.
  - [x] Orchestrator: per-route `sweep-error` from task_17 is forwarded to the findings array without re-throwing.
  - [x] Reporter: `writeReport` formats Markdown with sections for all 12 categories.
  - [x] Reporter: `formatFingerprint("app", { blocker: 2, major: 5 })` is embedded as an HTML comment in the report header.
  - [x] Reporter: severity-sort picks `blocker` finding as top when array order is `[minor, major, blocker]`.
  - [x] Reporter: `initSummary()` on empty file writes header with `Type` column.
  - [x] Reporter: `initSummary()` on pre-Phase-4 fixture file backfills `content` in existing rows.
  - [x] Reporter: `initSummary()` on post-migration file is a no-op (idempotent).
  - [x] Reporter: atomic write — temp file + rename pattern verified via `fs.rename` mock.
- Integration tests:
  - [x] Full `runAppAudit() + writeReport()` against fixture content-tree produces coherent markdown file readable by `cat`.
  - [x] SUMMARY migration round-trip: pre-migration fixture → `initSummary()` → 3 backfilled rows + new `app` row appended.
  - [x] Client bundle build assertion: `dist/client/**/*.js` does NOT contain `runAppAudit` string.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `checks.server.ts` and `reporter.server.ts`.
- Full audit + report cycle completes in <90s on V1-scale site (28 inspections, no Lighthouse).
- SUMMARY.md migration is byte-for-byte stable across repeated runs.
