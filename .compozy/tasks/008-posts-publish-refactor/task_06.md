---
status: completed
title: Content-audit — add `slug-collision` finding + page enumeration
type: backend
complexity: low
dependencies:
    - task_03
feature: pages/static-pages
---

# Task 06: Content-audit — add `slug-collision` finding + page enumeration

## Overview
Extend the content-audit pipeline so it (a) enumerates static pages via `enumerateStaticPages` and applies the translation-gap rule to pages identically to posts, and (b) flags `slug-collision` whenever a post and page share a slug at the same locale (warning severity per ADR-005 — the route silently prefers posts, so the audit is the surface that catches the footgun).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST call `enumerateStaticPages` from `app/lib/mdx/pages.server.ts` for each locale during the audit run.
- MUST apply the existing `translation-gap` rule to pages (en page exists → pt-br twin must exist OR carry an analogous opt-out; reuse the post rule's shape).
- MUST add a new finding category `slug-collision` (severity: major) for each locale where a post slug equals a page slug.
- MUST update `.agents/rules/audit.md` (Coverage Matrix + Category Definitions tables) to document the new category.
- MUST NOT break existing audit categories or the `docs/_reports/content-audit-YYYY-MM-DD.md` output format.
</requirements>

## Subtasks
- [ ] 06.1 Import `enumerateStaticPages` and wire it into `app/lib/content-audit/checks.server.ts` after the existing post enumeration.
- [ ] 06.2 Add the `translation-gap` rule for pages (mirror the post rule's structure).
- [ ] 06.3 Add the `slug-collision` finding: for each locale, intersect post slugs with page slugs; emit one finding per collision.
- [ ] 06.4 Update `.agents/rules/audit.md` Coverage Matrix and Category Definitions tables.
- [ ] 06.5 Add a fixture set to `app/tests/` covering each new path (collision, page-only-en, page+twin).

## Implementation Details
See TechSpec "System Architecture → Component Overview" for the content-audit layer. The pipeline entry is at `app/lib/content-audit/checks.server.ts:232` (`runContentAudit`); the script wrapper is `scripts/audit-content.ts`. Existing finding emission patterns live in the same file and provide the template for the new category.

### Relevant Files
- `app/lib/content-audit/checks.server.ts:232` — `runContentAudit` entry point.
- `scripts/audit-content.ts` — CLI wrapper.
- `.agents/rules/audit.md` — Coverage Matrix + Category Definitions.
- `app/lib/mdx/pages.server.ts` — provides `enumerateStaticPages` (task_03).

### Dependent Files
- `docs/audits/SUMMARY.md` — the SUMMARY rows do not change format; new findings show up in the existing column structure.
- `docs/_reports/content-audit-YYYY-MM-DD.md` — per-run reports gain new rows when the new categories fire.

### Related ADRs
- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — pages are enumerated through the encapsulated module.
- [ADR-005: Unified `$slug` loader resolves posts + static pages, posts win on collision](adrs/adr-005.md) — defines the silent-shadow behavior the audit must catch.

## Acceptance Criteria
1. AC-1: A test fixture with a collision (e.g., post `en/foo.mdx` + page `pages/en/foo.mdx`) produces one `slug-collision` finding per locale for that slug.
2. AC-2: A page that has an en variant but no pt-br twin produces a `translation-gap` finding (severity matches the existing post rule).
3. AC-3: An audit run with no fixture collisions and full twin coverage on all pages produces zero new findings (no false positives).
4. AC-4: `.agents/rules/audit.md` documents `slug-collision` in both the Coverage Matrix and Category Definitions tables.

## Deliverables
- Modified `app/lib/content-audit/checks.server.ts`.
- Updated `.agents/rules/audit.md`.
- New fixtures under `app/tests/` covering the audit categories.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for the audit CLI run **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `runContentAudit` emits a `slug-collision` finding when fixture data contains a post + page with the same slug at the same locale.
  - [ ] `runContentAudit` emits a `translation-gap` finding for an en-only page (no pt-br twin).
  - [ ] `runContentAudit` does not emit `slug-collision` when the colliding slugs are in different locales.
  - [ ] Severity for `slug-collision` is `major`; severity for page `translation-gap` matches the post rule's severity.
- Integration tests:
  - [ ] `bun run audit:content` against the test fixture set exits 0 (no blockers) and writes the expected new categories to the per-run report.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- New finding category visible in per-run audit reports
- `.agents/rules/audit.md` accurately reflects the extended coverage
