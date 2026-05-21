---
status: completed
title: Unify `$slug.tsx` loader (post → page → 404)
type: backend
complexity: medium
dependencies:
    - task_02
    - task_03
    - task_04
feature: pages/static-pages
---

# Task 05: Unify `$slug.tsx` loader (post → page → 404)

## Overview
Make `app/routes/{-$locale}/$slug.tsx` the single resolution surface for posts and static pages per ADR-005. The loader tries `getPostBySlugWithLangFn` first; on miss falls back to `loadStaticPage(slug, locale)`; on miss throws `notFound()`. Posts win on slug collision; the runtime cost stays one query + one filesystem stat in the cold path.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST modify `app/routes/{-$locale}/$slug.server.ts` so the loader tries post lookup first, then `loadStaticPage`, then `notFound()`.
- MUST preserve the existing exact / alternate-locale / fallback lookup logic for posts (three branches) but without `isPublished` filters (those are removed in task_02).
- MUST distinguish post vs page in the route's return shape so the component can render the correct surface (frontmatter shape differs; pages have no `date`, etc.).
- MUST NOT change the URL shape — `/some-post`, `/about`, `/uses` all resolve through this loader.
- MUST keep TypeScript discrimination strict so the component cannot accidentally read post-only fields from a page result (use a tagged union).
</requirements>

## Subtasks
- [ ] 05.1 Define a tagged union return type `{ kind: "post"; ... } | { kind: "page"; ... }` for the loader.
- [ ] 05.2 Implement the post lookup branch (reusing existing logic minus the visibility filter).
- [ ] 05.3 Implement the page fallback branch via `loadStaticPage(slug, locale)`.
- [ ] 05.4 Update `$slug.tsx` component to render based on the tagged union (post path renders post frontmatter; page path renders page frontmatter).
- [ ] 05.5 Verify hreflang/canonical metadata emission still works for both branches (will be reworked by task_12, but should not regress here).

## Implementation Details
See TechSpec "Implementation Design → API Endpoints" and "Core Interfaces" for the discriminated union. The existing `$slug.server.ts` has three lookup paths today (exact, alt-locale, fallback) — keep them intact for the post branch and add the page branch after they all miss.

### Relevant Files
- `app/routes/{-$locale}/$slug.tsx` — route component.
- `app/routes/{-$locale}/$slug.server.ts` — server fn / loader.
- `app/lib/mdx/pages.server.ts` — `loadStaticPage` import target (delivered by task_03).
- `app/db/queries.ts` — `getPostBySlugWithLangFn` (post-side query, renamed by task_02 if applicable).

### Dependent Files
- `app/types/content.ts` — may need a new discriminated union type if not declared inline in the route file.
- Task_12 updates the `<head>` emission for hreflang; this task should leave the existing emission intact until task_12 lands.

### Related ADRs
- [ADR-005: Unified `$slug` loader resolves posts + static pages, posts win on collision](adrs/adr-005.md) — directly implements this ADR.
- [ADR-001: Static-pages storage = filesystem-only, encapsulated module](adrs/adr-001.md) — supplies `loadStaticPage`.

## Acceptance Criteria
1. AC-1: Requesting `/some-post` for an existing post returns 200 with the post rendered.
2. AC-2: Requesting `/about` after task_04's migration returns 200 with the static page rendered through `loadStaticPage`.
3. AC-3: Requesting `/nope-not-real` returns 404 (both the post and page lookups miss).
4. AC-4: With a synthetic collision (post slug = page slug at the same locale), the route returns the post; a `slug-collision` finding fires on the next content-audit run (handled by task_06).

## Deliverables
- Modified `app/routes/{-$locale}/$slug.tsx` and `$slug.server.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for post / page / 404 / collision branches **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] Loader returns `{ kind: "post", ... }` for a seeded post slug.
  - [ ] Loader returns `{ kind: "page", ... }` for a slug present in `app/content/pages/<locale>/`.
  - [ ] Loader throws `notFound()` when both post and page lookups miss.
  - [ ] Loader prefers post on collision (post + page both exist with same slug at the same locale).
- Integration tests:
  - [ ] HTTP GET `/about` returns 200 with the migrated page content (covers task_04 hand-off).
  - [ ] HTTP GET `/pt-br/about` returns 200 with the pt-br page content.
  - [ ] HTTP GET a real post slug returns 200 with post content.
  - [ ] HTTP GET an unknown slug returns 404.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- `/about` URL renders correctly in both locales after the migration in task_04
- Loader uses a discriminated union — no `any` or untyped narrowing
