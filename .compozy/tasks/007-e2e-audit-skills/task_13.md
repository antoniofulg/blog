---
status: completed
title: audit-content.ts entry + scripts + SUMMARY.md initialization
type: infra
complexity: low
dependencies:
  - task_12
feature: audit/cli-entrypoint
---

# Task 13: audit-content.ts entry + scripts + SUMMARY.md initialization

## Overview

Wire the content-audit CLI surface: create `scripts/audit-content.ts` as the entry point that calls `runContentAudit()` + `writeReport()`, add `audit:content` to `package.json` scripts and `audit-content` to `Makefile`, append the gitignore entry for per-run reports, and commit an initial `docs/audits/SUMMARY.md` baseline row from the first local run.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `scripts/audit-content.ts` as a Bun TypeScript script that imports `runContentAudit()` + `writeReport()`, accepts an optional `--trigger=<label>` CLI flag, runs the audit, writes the report, and exits with code 1 if any `blocker` findings exist (so workflow_dispatch can fail explicitly).
- MUST accept `--trigger` defaulting to `manual` when not provided.
- MUST log a concise summary line to stdout (severity counts + report path) regardless of exit code.
- MUST add `audit:content` to `package.json` scripts (`"audit:content": "bun run scripts/audit-content.ts"`).
- MUST add `audit-content` target to `Makefile` invoking `bun run audit:content`.
- MUST add `docs/_reports/content-audit-*.md` to `.gitignore` (deferred entry from task_01 if not already added).
- MUST commit the initial `docs/audits/SUMMARY.md` with a header row + first baseline row produced by a local run.
- SHOULD complete a full audit in <30 seconds on V1-scale content.
</requirements>

## Subtasks

- [x] 13.1 Create `scripts/audit-content.ts` with argv parsing, audit invocation, and exit-code logic.
- [x] 13.2 Add `audit:content` script to `package.json`.
- [x] 13.3 Add `audit-content` target to `Makefile`.
- [x] 13.4 Verify `.gitignore` includes `docs/_reports/content-audit-*.md` (add if task_01 missed it).
- [x] 13.5 Run `bun run audit:content` locally to produce the initial `docs/audits/SUMMARY.md` baseline.
- [x] 13.6 Add `app/tests/audit-content-cli.test.ts` exercising argv parsing + exit-code logic against a fixture run.

## Implementation Details

See TechSpec "Build Order steps 31-33" and "Data Models → SUMMARY.md row format". The CLI entry pattern follows the existing `scripts/migrate.ts` / `scripts/seed.ts` / `scripts/sync.ts` shape (Bun shebang, top-level await, explicit `process.exit(N)`). The `--trigger` flag value lands in the SUMMARY row's "Run trigger" column.

### Relevant Files

- `scripts/migrate.ts`, `scripts/seed.ts`, `scripts/sync.ts` — reference for Bun script shape.
- `app/lib/content-audit/checks.server.ts` (task_12) — `runContentAudit()` source.
- `app/lib/content-audit/reporter.server.ts` (task_12) — `writeReport()` source.
- `package.json` — scripts block; consistent style with existing entries.
- `Makefile` — current targets; reference for the new `audit-content` entry.

### Dependent Files

- `.github/workflows/content-audit.yml` (task_14) — invokes `bun run audit:content`.
- `.agents/skills/content-audit/SKILL.md` (task_15) — references this CLI command as the canonical invocation.

### Related ADRs

- [ADR-002: Pivot audit skill from browser-sweep to content-audit](../adrs/adr-002.md) — defines the audit scope this CLI wraps.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — Phase 3 deliverable.

## Acceptance Criteria

1. **AC-1**: `bun run audit:content` exits 0 on a clean content tree with no blocker findings.
2. **AC-2**: `bun run audit:content` exits 1 when at least one `blocker` finding is produced (verified by injecting a deliberate broken link in a fixture branch).
3. **AC-3**: Running the command writes a file at `docs/_reports/content-audit-<today>.md` matching the TechSpec format.
4. **AC-4**: Running the command appends a row to `docs/audits/SUMMARY.md`; subsequent runs append additional rows (not duplicate per-day).
5. **AC-5**: The `--trigger=ci-pr-42` flag results in the SUMMARY row's trigger column reading `ci-pr-42`.
6. **AC-6**: Initial commit includes `docs/audits/SUMMARY.md` with a baseline row produced from the first local run.

## Deliverables

- New file `scripts/audit-content.ts`.
- New file `docs/audits/SUMMARY.md` (committed initial state).
- Modified `package.json` (new script).
- Modified `Makefile` (new target).
- Modified `.gitignore` (verify entry; add if missing).
- New file `app/tests/audit-content-cli.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for end-to-end CLI run **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] Argv parsing: `--trigger=foo` is captured; default is `manual`.
  - [ ] Exit code 0 path: no `blocker` findings → exit 0.
  - [ ] Exit code 1 path: ≥1 `blocker` finding → exit 1.
  - [ ] Summary log format: stdout contains severity counts and the report path.
- Integration tests:
  - [ ] `bun run audit:content` invoked from a Vitest spawn child returns exit 0 on a clean fixture branch.
  - [ ] `bun run audit:content` invoked from a Vitest spawn child returns exit 1 when fixture has a blocker.
  - [ ] SUMMARY.md row count increases by 1 per invocation.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `scripts/audit-content.ts`.
- Local invocation runs in <30 seconds on V1-scale content.
- `docs/audits/SUMMARY.md` initialized with valid markdown table.
