---
status: completed
title: Delete tutorials, projects, newsletter, search routes
type: refactor
complexity: low
dependencies:
    - task_02
---

# Task 03: Delete tutorials, projects, newsletter, search routes

## Overview
Delete the route files for mocked and stub pages (Tutorials, Projects, Newsletter, Search) and the orphan `tutorial-step` component. Header and footer were cleaned in task_02 so no dangling references remain. `routeTree.gen.ts` regenerates automatically when the dev server or the TanStack Router vite plugin runs.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- The following route files MUST be deleted: `app/routes/tutorials.tsx`, `app/routes/tutorials.$seriesSlug.tsx`, `app/routes/projects.tsx`, `app/routes/newsletter.tsx`, `app/routes/search.tsx`.
- The orphan component `app/components/tutorial-step.tsx` MUST be deleted.
- `routeTree.gen.ts` MUST regenerate without errors or stale references to the deleted routes.
- Any test fixture or import path referencing the deleted files MUST be updated or removed.
- `make check` (tsc --noEmit) and `make lint` MUST pass after the deletions.
</requirements>

## Subtasks
- [ ] 3.1 Delete the five route files via `git rm`
- [ ] 3.2 Delete `app/components/tutorial-step.tsx` via `git rm`
- [ ] 3.3 Restart dev or run the TanStack Router generator to refresh `routeTree.gen.ts`
- [ ] 3.4 Locate and remove any remaining imports or test references to deleted files
- [ ] 3.5 Run `make check` + `make lint` and resolve any reported issues

## Implementation Details
See TechSpec "Impact Analysis" rows tagged Deleted. The skill `.agents/rules/routes.md` notes that `routeTree.gen.ts` is auto-generated — never edit manually. See "Development Sequencing → Build Order" step 3 for ordering dependency on task_02.

### Relevant Files
- `app/routes/tutorials.tsx`
- `app/routes/tutorials.$seriesSlug.tsx`
- `app/routes/projects.tsx`
- `app/routes/newsletter.tsx`
- `app/routes/search.tsx`
- `app/components/tutorial-step.tsx`

### Dependent Files
- `routeTree.gen.ts` — regenerates after deletions
- `app/components/layout/header.tsx` and `footer.tsx` — already cleaned in task_02
- `app/tests/public-routes.test.ts` — may contain assertions for deleted routes; verify and remove

### Related ADRs
- [ADR-001: V1 Scope](adrs/adr-001.md) — enumerates the deletions

## Deliverables
- 5 route files deleted
- 1 component file deleted
- Regenerated `routeTree.gen.ts` with no references to deleted routes
- Unit tests with 80%+ coverage **(REQUIRED)** — existing suite passes after deletions; new assertions cover post-deletion routing
- Integration tests for SSR 404 behavior on deleted paths **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `routeTree.gen.ts` contains no route definitions for paths `/tutorials`, `/tutorials/$seriesSlug`, `/projects`, `/newsletter`, `/search`
  - [ ] `git grep` for `tutorial-step` returns zero matches outside `routeTree.gen.ts`
  - [ ] `git grep` for imports of deleted route files returns zero matches
- Integration tests:
  - [ ] SSR `GET /tutorials` returns 404 status
  - [ ] SSR `GET /projects` returns 404 status
  - [ ] SSR `GET /newsletter` returns 404 status
  - [ ] SSR `GET /search` returns 404 status
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- 6 files removed from the git working tree
- `routeTree.gen.ts` regenerates cleanly
- `make check` + `make lint` green
