---
status: completed
title: Locale Blog Listing Route
type: frontend
complexity: medium
dependencies:
  - task_03
  - task_05
---

# Task 06: Locale Blog Listing Route

## Overview

Create `app/routes/$lang/blog.tsx` — the locale-filtered blog listing page served at `/en/blog` and `/pt-br/blog`. It fetches only posts matching the `$lang` URL parameter and renders them with the existing pagination and `PostCard` components. This replaces the data-fetching responsibility of the current `blog.tsx` (which task_08 converts to a redirect).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/routes/$lang/blog.tsx` as a TanStack Router `createFileRoute('/$lang/blog')` file route
- MUST read the `$lang` param from the route context and pass it to `getPublishedPostsFn(lang)` in the loader
- MUST paginate at 9 posts per page — same constant as current `blog.tsx`
- MUST render `PostCard` for each post and `Pagination` for page navigation — reuse existing components
- MUST show `EmptyState` when no posts exist for the requested locale
- MUST update post links to use locale-prefixed paths (`/$lang/$slug`) not bare `/$slug`
- MUST NOT duplicate the server function wrapper — call `getPublishedPostsFn` (updated in task_03) via a new `createServerFn` wrapper in this file
</requirements>

## Subtasks

- [x] 6.1 Create `app/routes/$lang/blog.tsx` — set up `createFileRoute('/$lang/blog')` with loader that calls `getPublishedPostsFn(lang)`
- [x] 6.2 Port pagination logic from `app/routes/blog.tsx` — 9 posts/page, page param from search params
- [x] 6.3 Render `PostCard` grid and `Pagination` — reuse existing components unchanged
- [x] 6.4 Ensure post card links point to `/$lang/$slug` instead of `/$slug`
- [x] 6.5 Verify `/en/blog` shows English posts and `/pt-br/blog` shows Portuguese posts (or empty state)

## Implementation Details

See TechSpec "API Endpoints → Server Functions table" for the updated `getPublishedPostsFn` signature (takes `lang` param, added in task_03). See the current `app/routes/blog.tsx` for the pagination logic and component usage to replicate.

The loader extracts `lang` from `Route.useParams()` context — TanStack Router makes the parent `$lang` param available to child routes. The server function wrapper is a local `createServerFn` that accepts `lang` and calls `getPublishedPostsFn`.

### Relevant Files

- `app/routes/blog.tsx` — reference for pagination logic, PostCard rendering, EmptyState usage (do NOT modify here; task_08 handles that)
- `app/db/queries.ts` — `getPublishedPostsFn` updated in task_03 to accept `lang`
- `app/components/ui/post-card.tsx` — reused unchanged
- `app/components/ui/pagination.tsx` — reused unchanged
- `app/components/ui/empty-state.tsx` — reused unchanged

### Dependent Files

- `app/routeTree.gen.ts` — auto-regenerated when `$lang/blog.tsx` is created; must include this route nested under `$lang`
- `app/routes/blog.tsx` — task_08 converts this to a redirect; no conflict with this new route
- `app/tests/public-routes.test.ts` — may need updating to test the new route path

### Related ADRs

- [ADR-003: Expand V1 scope to include locale routing and language switcher](adrs/adr-003.md) — separate listing pages per locale, not a single mixed feed

## Deliverables

- `app/routes/$lang/blog.tsx` with locale-filtered listing
- `/en/blog` serves published English posts
- `/pt-br/blog` serves published Portuguese posts (empty state initially)
- Post card links use `/$lang/$slug` path pattern
- `tsc --noEmit` exits 0
- `make test` exits 0

## Tests

- Unit tests:
  - [x] `tsc --noEmit` passes — new route file type-checks against updated `getPublishedPostsFn` signature
  - [x] Mock test: `getPublishedPostsFn('en')` called with `'en'` when accessing `/en/blog`; `getPublishedPostsFn('pt-br')` called when accessing `/pt-br/blog`
  - [x] Pagination: 10-post mock → page 1 shows 9 posts, page 2 shows 1 post
  - [x] Empty state: `getPublishedPostsFn('pt-br')` returns `[]` → `EmptyState` component rendered
- Integration tests:
  - [x] `GET /en/blog` → 200, contains published English posts
  - [x] `GET /pt-br/blog` → 200, empty state (no pt-br posts yet)
- Test coverage target: >=80% on new route file
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `/en/blog` renders the 3 existing posts (after task_02 and task_03 complete)
- `/pt-br/blog` renders empty state
- Post card links on `/en/blog` navigate to `/en/<slug>` correctly
