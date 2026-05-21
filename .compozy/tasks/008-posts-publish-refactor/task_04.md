---
status: completed
title: Migrate `about.mdx` + delete legacy `about` route and loader
type: refactor
complexity: low
dependencies:
    - task_03
feature: pages/static-pages
---

# Task 04: Migrate `about.mdx` + delete legacy `about` route and loader

## Overview
Move `app/content/<locale>/about.mdx` into the new convention (`app/content/pages/<locale>/about.mdx`), delete the dedicated `about` route and its server fn, and delete `app/lib/mdx/about.server.ts` (replaced by task_03's `pages.server.ts`). After this task, the `/about` URL must continue to render via the unified `$slug` loader (delivered by task_05).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST `git mv app/content/en/about.mdx app/content/pages/en/about.mdx` and the same for `pt-br` so file history is preserved.
- MUST delete `app/routes/{-$locale}/about.tsx` and `app/routes/{-$locale}/about.server.ts`.
- MUST delete `app/lib/mdx/about.server.ts`.
- MUST NOT introduce a `pages/$slug.tsx` or analogous separate route — `/about` resolves through the unified `$slug.tsx` (task_05).
- MUST update or remove the existing `app/tests/about.test.ts` so it covers the new `pages.server.ts` surface (or is moved/merged into task_03's tests if it duplicates them).
</requirements>

## Subtasks
- [x] 04.1 `git mv` `about.mdx` files under both locales into `app/content/pages/<locale>/`.
- [x] 04.2 Delete `app/routes/{-$locale}/about.tsx` and `app/routes/{-$locale}/about.server.ts`.
- [x] 04.3 Delete `app/lib/mdx/about.server.ts`.
- [x] 04.4 Regenerate `app/routeTree.gen.ts` by running the dev server briefly or `bunx tsr generate`.
- [x] 04.5 Update `app/tests/about.test.ts` to no longer import the deleted `about.server.ts`; either retarget the test at `pages.server.ts` or delete it after confirming task_03 covers the same scenarios.

## Implementation Details
See TechSpec "Impact Analysis" rows for `about.tsx`, `about.server.ts`, `about.mdx`. The directory layout for pages is documented in ADR-001 and PRD F2.

### Relevant Files
- `app/content/en/about.mdx`, `app/content/pt-br/about.mdx` — files to move.
- `app/routes/{-$locale}/about.tsx`, `app/routes/{-$locale}/about.server.ts` — to delete.
- `app/lib/mdx/about.server.ts` — to delete.
- `app/tests/about.test.ts` — to retarget or remove.

### Dependent Files
- `app/routeTree.gen.ts` — auto-regenerated; never edit by hand per `.agents/rules/routes.md`.
- Task_05 will route `/about` via the unified `$slug` loader after this task lands.

### Related ADRs
- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — directory layout decision.
- [ADR-005: Unified `$slug` loader](adrs/adr-005.md) — `/about` URL contract preserved after the dedicated route is deleted.

## Acceptance Criteria
1. AC-1: `app/content/pages/en/about.mdx` and `app/content/pages/pt-br/about.mdx` exist; the legacy `app/content/<locale>/about.mdx` paths do not.
2. AC-2: `app/routes/{-$locale}/about.tsx`, `app/routes/{-$locale}/about.server.ts`, and `app/lib/mdx/about.server.ts` are deleted; `routeTree.gen.ts` regenerates without them.
3. AC-3: `bun run check` is clean (no orphan imports referencing the deleted files).

## Deliverables
- Moved `about.mdx` files (both locales).
- Deleted `about.tsx`, `about.server.ts`, `about` MDX loader.
- Regenerated `routeTree.gen.ts`.
- Updated or removed `app/tests/about.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)** — coverage delivered through task_03 + this task's updated `about.test.ts`.
- Integration tests for the migrated path **(REQUIRED)** — covered by task_05's e2e tests.

## Tests
- Unit tests:
  - [x] `about.test.ts` deleted; task_03's `pages.test.ts` covers `pages.server.ts` comprehensively (870 tests pass).
  - [x] `header.test.ts` updated to assert new slug-based navigation for `/about`.
- Integration tests:
  - [ ] (Covered by task_05) `/about` URL returns 200 in both locales after this task + task_05 land.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- The legacy `about` route and loader are absent from the repository
- `routeTree.gen.ts` reflects the deletion
