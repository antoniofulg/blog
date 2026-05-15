---
status: completed
title: Clean header + footer broken links
type: frontend
complexity: low
dependencies: []
---

# Task 02: Clean header + footer broken links

## Overview
Remove navigation entries for routes that task_03 will delete (Tutorials, Projects) and footer entries that point at routes that do not exist (`/feed.xml`, `/sitemap.xml`, `/newsletter`, `/search`). Doing this before deletions in task_03 prevents an interim build state where header or footer renders links to deleted routes.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `NAV_LABELS` in `app/components/layout/header.tsx` MUST NOT include `Tutorials` or `Projects` entries for any locale.
- `navLinks` and `resourceLinks` arrays in `app/components/layout/footer.tsx` MUST NOT include hrefs pointing at `/tutorials`, `/projects`, `/feed.xml`, `/sitemap.xml`, `/newsletter`, or `/search`.
- Header and footer rendering MUST remain valid React (no broken key warnings, no missing label fallbacks for remaining entries).
- The locale switcher button and theme toggle in the header MUST be preserved without behavioral change.
- Tests MUST assert each removed entry is absent from the rendered DOM in both locales.
</requirements>

## Subtasks
- [x] 2.1 Remove `Tutorials` and `Projects` entries from `NAV_LABELS`
- [x] 2.2 Remove `/feed.xml`, `/sitemap.xml`, `/tutorials`, `/projects`, `/newsletter`, `/search` from footer arrays
- [x] 2.3 Verify mobile menu still renders with remaining nav items
- [x] 2.4 Update or add tests asserting removed entries are gone
- [x] 2.5 Smoke-render header + footer in dev for both locales

## Implementation Details
See TechSpec "Impact Analysis" rows for `app/components/layout/header.tsx` and `app/components/layout/footer.tsx`. V1 keeps the remaining hardcoded labels in component files (ADR-001 partial population) — only entries pointing at deleted or nonexistent routes are removed in this task.

### Relevant Files
- `app/components/layout/header.tsx` — `NAV_LABELS` table (lines 7-40)
- `app/components/layout/footer.tsx` — `navLinks` + `resourceLinks` (lines 4-16)

### Dependent Files
- task_03 deletes the routes those entries previously linked to
- `app/tests/header.test.ts` — has existing assertions about header rendering; may need update for removed entries

### Related ADRs
- [ADR-001: V1 Scope](adrs/adr-001.md) — enumerates deletions
- [ADR-002: 3-Phase Rollout](adrs/adr-002.md) — Phase 1

## Deliverables
- Updated `header.tsx` with cleaned `NAV_LABELS`
- Updated `footer.tsx` with cleaned link arrays
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for rendered header + footer in both locales **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `NAV_LABELS.en` does not contain key for Tutorials
  - [x] `NAV_LABELS.en` does not contain key for Projects
  - [x] `NAV_LABELS["pt-br"]` does not contain key for Tutorials or Projects
  - [x] Footer `navLinks` contains no entry with href `/tutorials` or `/projects`
  - [x] Footer `resourceLinks` contains no entry with href `/feed.xml`, `/sitemap.xml`, `/newsletter`, or `/search`
  - [x] Locale switcher and theme toggle still render in header
- Integration tests:
  - [x] SSR a page rendering the header → DOM has no anchor tags pointing at deleted routes
  - [x] SSR a page rendering the footer → DOM has no anchor tags pointing at broken paths
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Rendered header + footer have zero anchors pointing at routes that do not exist post-Phase 1
- Locale switcher and theme toggle behave identically to pre-task state
