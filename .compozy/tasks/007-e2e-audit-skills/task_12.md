---
status: completed
title: Content-audit checks + reporter
type: backend
complexity: medium
dependencies:
  - task_02
  - task_11
feature: audit/checks-reporter
---

# Task 12: Content-audit checks + reporter

## Overview

Implement the content-audit core: orchestrates all check functions (frontmatter validation, translation-gap detection, link integrity, image alt-text, series consistency) into a single `runContentAudit()` that returns `Finding[]`. Implement the reporter that writes the per-run markdown report to `docs/_reports/content-audit-YYYY-MM-DD.md` and appends a row to `docs/audits/SUMMARY.md`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST expose `runContentAudit(): Promise<Finding[]>` from `app/lib/content-audit/checks.server.ts` matching the `Finding` shape from TechSpec "Core Interfaces".
- MUST implement five check categories: `frontmatter-invalid`, `translation-gap`, `broken-link`, `missing-alt-text`, `series-gap`.
- MUST consume `getPostInventory()` from `app/lib/site-model.server.ts` (task_02) and `extractLinks()` from task_11.
- MUST classify severity per the rules in `_idea.md` / ADR-002 (translation-gap=major, broken-link=blocker if published else minor, missing-alt-text=major, series-gap=minor, frontmatter-invalid=blocker).
- MUST honor the `noTranslation: true` frontmatter opt-out for translation-gap detection.
- MUST expose `writeReport(findings, triggerLabel): Promise<void>` from `app/lib/content-audit/reporter.server.ts` that creates the per-run markdown file at `docs/_reports/content-audit-YYYY-MM-DD.md` and appends to `docs/audits/SUMMARY.md`.
- MUST initialize `docs/audits/SUMMARY.md` with header row if missing (idempotent first-run).
- MUST be server-only; add both modules to `vite.config.ts:serverOnlyStubPlugin`.
- MUST validate the per-run report exit format matches the example in TechSpec "Data Models".
</requirements>

## Subtasks

- [ ] 12.1 Create `app/lib/content-audit/checks.server.ts` with the 5 check functions + `runContentAudit()` orchestrator + `Finding` / `Severity` / `FindingCategory` types.
- [ ] 12.2 Create `app/lib/content-audit/reporter.server.ts` exposing `writeReport(findings, triggerLabel)`.
- [ ] 12.3 Add both module ids to `vite.config.ts:serverOnlyStubPlugin`.
- [ ] 12.4 Create `app/tests/content-audit.test.ts` exercising each check function with fixture data and the full `runContentAudit()` orchestration.

## Implementation Details

See TechSpec "Build Order steps 29-30" and "Data Models → SUMMARY.md row format + per-run report shape". The `Finding` type lives in `checks.server.ts` and is re-exported by the audit module. The orchestrator runs checks sequentially (no parallelism needed at V1 scale); each check function takes the post inventory + link extraction as inputs to keep checks pure.

### Relevant Files

- `app/lib/site-model.server.ts` (task_02) — `getPostInventory()` source.
- `app/lib/content-audit/link-parser.server.ts` (task_11) — `extractLinks()` source.
- `app/lib/mdx/parser.server.ts` — existing frontmatter parser; `parseFrontmatterBlock()` in `app/db/indexer.ts` is the superset variant.
- `app/db/schema.ts` — `posts` table; reference for valid frontmatter fields.
- `docs/audits/SUMMARY.md` — created/initialized by this task; task_13 will append the first real row.

### Dependent Files

- `scripts/audit-content.ts` (task_13) — entry point that wires up `runContentAudit()` + `writeReport()`.
- `.github/workflows/content-audit.yml` (task_14) — invokes the script.
- `app/lib/content-audit/checks.server.ts`, `reporter.server.ts` — newly created; downstream tasks consume them.

### Related ADRs

- [ADR-002: Pivot audit skill from browser-sweep to content-audit](../adrs/adr-002.md) — defines the 5 categories + severities + scope.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — Phase 3.

## Acceptance Criteria

1. **AC-1**: `runContentAudit()` returns a `Finding[]` whose union of categories is a subset of the 5 documented categories.
2. **AC-2**: Translation-gap detection: a fixture en post with no pt-br twin produces one Finding with `category: 'translation-gap'`, `severity: 'major'`. A fixture post with `noTranslation: true` does NOT produce a finding.
3. **AC-3**: Broken-link detection: an internal `[broken](/non-existent)` in a published post produces a Finding with `category: 'broken-link'`, `severity: 'blocker'`. The same link in a draft post produces `severity: 'minor'`.
4. **AC-4**: Missing-alt-text detection: `![](image.png)` produces a Finding with `category: 'missing-alt-text'`, `severity: 'major'`. `![alt](image.png)` does not.
5. **AC-5**: Series-gap detection: a published post with `series: 'foo', seriesPart: 3` and no published part 2 produces a Finding with `category: 'series-gap'`, `severity: 'minor'`.
6. **AC-6**: Frontmatter-invalid detection: a fixture post missing the required `title` field produces a Finding with `category: 'frontmatter-invalid'`, `severity: 'blocker'`.
7. **AC-7**: `writeReport(findings, 'manual')` creates `docs/_reports/content-audit-<today>.md` with the documented section structure (Blocker / Major / Minor) and appends one row to `docs/audits/SUMMARY.md`.
8. **AC-8**: Running `writeReport()` twice in the same day overwrites the per-run file (idempotent per-date) and appends a second SUMMARY row.

## Deliverables

- New files: `app/lib/content-audit/checks.server.ts`, `app/lib/content-audit/reporter.server.ts`.
- Modified `vite.config.ts` (two-line addition to stub plugin list).
- New file `app/tests/content-audit.test.ts`.
- New fixture directory `app/tests/fixtures/content-audit/` with handcrafted MDX files covering each check category.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for full `runContentAudit()` pipeline **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] Each of the 5 check functions: positive case (finding produced) + negative case (no finding).
  - [ ] `noTranslation: true` opt-out short-circuits translation-gap check.
  - [ ] Severity classification per category matches the documented mapping.
  - [ ] `writeReport()` produces a file at the expected path with the documented sections.
  - [ ] `writeReport()` initializes `SUMMARY.md` with header on first call when missing.
  - [ ] `writeReport()` appends a row to `SUMMARY.md` containing date, trigger label, severity counts, top finding.
- Integration tests:
  - [ ] Full `runContentAudit()` run against the fixture directory produces the expected Finding array shape and counts.
  - [ ] Full `runContentAudit() + writeReport()` writes a coherent markdown report file readable by `cat`.
  - [ ] Client bundle build (`bun run build`) succeeds without exposing audit module strings.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `checks.server.ts` and `reporter.server.ts`.
- Full audit + report cycle on V1-scale content completes in <30 seconds.
- Generated reports are human-readable and match the TechSpec example shape.
