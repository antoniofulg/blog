---
status: completed
title: Delete top-level redirect shims
type: refactor
complexity: low
dependencies:
    - task_06
---

# Task 07: Delete top-level redirect shims

## Overview
After task_06 lands the `{-$locale}/*` subtree, the legacy top-level redirect shims (`/`, `/blog`, `/<slug>`) at `app/routes/index.tsx`, `app/routes/blog.tsx`, and `app/routes/$slug.tsx` are obsolete. Delete them. The `{-$locale}` subtree now owns these paths natively; `/blog` becomes 404 (intentional, per ADR-001).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `app/routes/index.tsx` MUST be deleted.
- `app/routes/blog.tsx` MUST be deleted.
- `app/routes/$slug.tsx` MUST be deleted.
- `routeTree.gen.ts` MUST regenerate cleanly with no route collisions between deleted shims and the `{-$locale}` subtree.
- `/` MUST resolve via `{-$locale}/index.tsx` (not via redirect shim).
- `/<known-slug>` MUST resolve via `{-$locale}/$slug.tsx` (not via redirect shim).
- `/blog` MUST return 404 (intentional removal of the legacy URL).
</requirements>

## Subtasks
- [x] 7.1 `git rm` the three top-level shim files
- [x] 7.2 Regenerate `routeTree.gen.ts`
- [x] 7.3 Add integration tests asserting URL resolution post-deletion
- [x] 7.4 Verify `make check` + `make lint` pass

## Implementation Details
See TechSpec "Impact Analysis" rows for `index.tsx`, `blog.tsx`, `$slug.tsx`. See also "Development Sequencing → Build Order" step 7 which orders this after the route subtree rename.

### Relevant Files
- `app/routes/index.tsx` — deletes
- `app/routes/blog.tsx` — deletes
- `app/routes/$slug.tsx` — deletes
- `routeTree.gen.ts` — auto-regenerates

### Dependent Files
- task_06 must have landed; `{-$locale}/*` owns these paths now
- task_08 attaches redirect logic to the new layout — runs after this task
- task_09 attaches hreflang to the new feed root

### Related ADRs
- [ADR-004: Optional Path-Param Routing](adrs/adr-004.md) — supersedes the shim approach
- [ADR-001: V1 Scope](adrs/adr-001.md) — `/blog` hard delete confirmed

## Deliverables
- Three shim files deleted
- Regenerated `routeTree.gen.ts`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for URL resolution post-deletion **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `routeTree.gen.ts` contains no route definitions for top-level `index.tsx`, `blog.tsx`, `$slug.tsx`
  - [x] `git grep "from \"\\./index\""` or similar yields zero shim-related references
- Integration tests:
  - [x] SSR `GET /` returns 200 with the en post feed served by `{-$locale}/index.tsx`
  - [x] SSR `GET /blog` returns 404 (intentional)
  - [x] SSR `GET /<known-slug>` returns 200 with the en post detail served by `{-$locale}/$slug.tsx`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Three files removed from the git tree
- `routeTree.gen.ts` regenerates cleanly with no collisions
- URL resolution intact for `/` and `/<slug>`; `/blog` returns 404 per ADR-001
