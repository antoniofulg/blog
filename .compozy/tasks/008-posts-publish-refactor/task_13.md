---
status: completed
title: Trim admin — drop publish toggle + delete preview routes + add locale filter + view-in-new-tab
type: refactor
complexity: medium
dependencies:
  - task_02
feature: admin/list-view
---

# Task 13: Trim admin — drop publish toggle + delete preview routes + add locale filter + view-in-new-tab

## Overview
Reduce `/admin` to the locked V1 surface: list-only view of every post with an EN / PT-BR / both locale filter (URL search param), each row exposing a "View" button that opens the public URL in a new tab. Delete `togglePublishedFn` and the entire `preview.$slug` route + server fn pair. Target ≤ 100 LOC across `app/routes/admin/**` (down from 262 today).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST remove `togglePublishedFn` from `app/routes/admin/index.server.ts` and any UI that calls it.
- MUST delete `app/routes/admin/preview.$slug.tsx` and `app/routes/admin/preview.$slug.server.ts`.
- MUST add a locale filter to `/admin` via a `?locale=en | pt-br` URL search param; absent param means "show both".
- MUST render each row with a "View" button using `<a href="<public-url>" target="_blank" rel="noopener noreferrer">` semantics so the public URL opens in a new tab.
- MUST link the View button to the correct locale variant: if both exist, link to EN; if only one exists, link to that one (per PRD Q-O5 default).
- MUST hide the language menu on `/admin/*` (handled by task_09/task_10's `renderSwitcher: false` for admin RouteKind — verify no regression here).
- MUST keep total LOC across `app/routes/admin/**` below 100 after the trim.
</requirements>

## Subtasks
- [x] 13.1 Delete `app/routes/admin/preview.$slug.tsx` and `preview.$slug.server.ts`.
- [x] 13.2 Remove `togglePublishedFn` from `app/routes/admin/index.server.ts`; keep `getAllPostsFn`.
- [x] 13.3 Rewrite `app/routes/admin/index.tsx` to render a list with the locale filter UI and "View" buttons.
- [x] 13.4 Update `app/tests/admin-routes.test.ts` — strip publish-toggle tests; add locale-filter tests.
- [x] 13.5 Verify `wc -l app/routes/admin/**` returns under 100.
- [x] 13.6 Regenerate `app/routeTree.gen.ts` to remove the deleted preview routes.

## Implementation Details
See TechSpec "System Architecture → Component Overview" rows for `admin/index.tsx`, `admin/index.server.ts`, and the `preview.$slug.*` deletions. The "View" button URL strategy is locked in PRD Q-O5.

### Relevant Files
- `app/routes/admin/index.tsx` (136 LOC today) — to rewrite as list + filter.
- `app/routes/admin/index.server.ts` — drop `togglePublishedFn`; keep `getAllPostsFn`.
- `app/routes/admin/preview.$slug.tsx` (41 LOC) + `preview.$slug.server.ts` (34 LOC) — to delete.
- `app/tests/admin-routes.test.ts:79-90,128-129,165,175,184` — fixtures + assertions to update.

### Dependent Files
- `app/routeTree.gen.ts` — auto-regenerates after route deletion.
- Task_09's `getTwinAvailabilityForCurrentRoute` returns `renderSwitcher: false` for admin; verify it correctly hides the menu when this task lands.

### Related ADRs
- [ADR-004: Rollout = single release for V1](adrs/adr-004.md) — admin trim lands as part of the single release.

## Acceptance Criteria
1. AC-1: `app/routes/admin/preview.$slug.tsx` and `preview.$slug.server.ts` are deleted from the repository; `routeTree.gen.ts` reflects the deletion.
2. AC-2: `togglePublishedFn` no longer exists; no UI calls it.
3. AC-3: GET `/admin?locale=en` renders only EN-locale posts; `/admin?locale=pt-br` renders only PT-BR posts; `/admin` (no param) renders both.
4. AC-4: Each row's View button is an `<a target="_blank" rel="noopener noreferrer">` pointing at the public URL of the correct-locale variant per the Q-O5 default.
5. AC-5: `wc -l app/routes/admin/**` reports a total below 100.

## Deliverables
- Rewritten `app/routes/admin/index.tsx` and trimmed `index.server.ts`.
- Deleted `preview.$slug.tsx` and `preview.$slug.server.ts`.
- Updated `app/tests/admin-routes.test.ts`.
- Regenerated `app/routeTree.gen.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for the locale filter **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `getAllPostsFn` returns the full list (no filter at the data layer).
  - [ ] Admin component filters the rendered list when `?locale=en` or `?locale=pt-br` is present.
  - [ ] Admin component renders all rows when no locale param is present.
  - [ ] View button href points at the EN URL when both locales exist; points at the only-existing URL when only one does.
- Integration tests:
  - [ ] HTTP GET `/admin?locale=en` returns 200 and the rendered HTML contains only EN-locale post slugs.
  - [ ] HTTP GET `/admin/preview/some-slug` returns 404 (deleted route).
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- `wc -l app/routes/admin/**` < 100
- Language menu is hidden on `/admin/*` routes (verified end-to-end with task_10's switcher rewrite)
