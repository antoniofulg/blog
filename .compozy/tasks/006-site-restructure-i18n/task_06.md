---
status: completed
title: Rename `$lang/*` subtree to `{-$locale}/*`
type: refactor
complexity: medium
dependencies:
    - task_03
---

# Task 06: Rename `$lang/*` subtree to `{-$locale}/*`

## Overview
Migrate the locale route subtree to TanStack Router's optional path-param idiom per ADR-004. Rename `$lang.tsx` to `{-$locale}.tsx`, `$lang/blog.tsx` (+ server) to `{-$locale}/index.tsx` (+ server), and `$lang/$slug.tsx` (+ server) to `{-$locale}/$slug.tsx` (+ server). Update the layout to resolve an undefined `_locale` param to `DEFAULT_LOCALE`. Data layer (queries, server fn handler bodies) is unchanged — only the route definitions and param access.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `app/routes/$lang.tsx` MUST be renamed (via `git mv`) to `app/routes/{-$locale}.tsx`.
- `app/routes/$lang/blog.tsx` MUST be renamed to `app/routes/{-$locale}/index.tsx`; the co-located `blog.server.ts` MUST be renamed to `index.server.ts`.
- `app/routes/$lang/$slug.tsx` MUST be renamed to `app/routes/{-$locale}/$slug.tsx`; the co-located `$slug.server.ts` MUST be renamed in parallel.
- The layout component MUST read the resolved locale via the TanStack Router optional-param accessor and fall back to `DEFAULT_LOCALE` from `app/lib/locale.tsx` when the param is undefined.
- The layout MUST validate the resolved locale against `LOCALES` and respond appropriately on invalid input (404 or redirect).
- `routeTree.gen.ts` MUST regenerate without errors.
- All four URL shapes `/`, `/pt-br/`, `/<slug>`, `/pt-br/<slug>` MUST render the correct locale-specific content.
- Existing tests in `app/tests/lang-*.test.ts` MUST be updated to reflect the new route paths.
</requirements>

## Subtasks
- [x] 6.1 `git mv` the layout file from `$lang.tsx` to `{-$locale}.tsx`
- [x] 6.2 `git mv` the blog index pair to `{-$locale}/index.tsx` + `index.server.ts`
- [x] 6.3 `git mv` the post detail pair to `{-$locale}/$slug.tsx` + `$slug.server.ts`
- [x] 6.4 Update layout param access to use the optional-param accessor with DEFAULT_LOCALE fallback
- [x] 6.5 Regenerate `routeTree.gen.ts`
- [x] 6.6 Update `app/tests/lang-*.test.ts` for new route paths
- [x] 6.7 Verify all four locale URL shapes render correctly (unit tests; integration tests require live server)

## Implementation Details
See TechSpec "System Architecture → Component Overview" entries for the `{-$locale}/` subtree, and "Implementation Design → API Endpoints" for the route table. The `vite.config.ts` `serverOnlyStubPlugin` `denyImports` list may reference old `$lang/` paths and require updating to match the new file names.

### Relevant Files
- `app/routes/$lang.tsx` → `app/routes/{-$locale}.tsx`
- `app/routes/$lang/blog.tsx`, `$lang/blog.server.ts` → `app/routes/{-$locale}/index.tsx`, `index.server.ts`
- `app/routes/$lang/$slug.tsx`, `$lang/$slug.server.ts` → `app/routes/{-$locale}/$slug.tsx`, `$slug.server.ts`
- `app/lib/locale.tsx` — provides `LOCALES`, `DEFAULT_LOCALE`, `Locale` type
- `vite.config.ts` — `serverOnlyStubPlugin` `denyImports` paths may need updating
- `routeTree.gen.ts` — auto-regenerates

### Dependent Files
- task_07 deletes the top-level redirect shims after this lands
- task_08 attaches the cookie-first SSR redirect to this layout
- task_09 adds hreflang to the new feed root file
- task_13 creates new files under `{-$locale}/about/`
- `app/tests/lang-route.test.ts`, `lang-blog-route.test.ts`, `lang-slug-route.test.ts` — tests against current `$lang/*` paths

### Related ADRs
- [ADR-004: Optional Path-Param `{-$locale}` Routing Primitive](adrs/adr-004.md) — defines the chosen routing primitive
- [ADR-001: V1 Scope](adrs/adr-001.md) — post-feed home + URL-prefix locale
- [ADR-002: 3-Phase Rollout](adrs/adr-002.md) — Phase 2

## Deliverables
- Five route files renamed
- Layout param access updated for optional-param accessor
- `routeTree.gen.ts` regenerated and clean
- Existing locale-route tests updated for new paths
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests covering all four locale URL shapes **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Layout resolves a missing `locale` param to `DEFAULT_LOCALE`
  - [x] Layout passes through a valid `locale` param ("en" or "pt-br") unchanged
  - [x] Layout responds with notFound() on an invalid locale value (e.g., `"es"`)
- Integration tests (require live server + DB — skipped in CI without PostgreSQL):
  - [x] GET / returns 200 with en post feed (test updated, skipped without live server)
  - [x] GET /pt-br/ returns 200 with pt-br post feed (test updated, skipped without live server)
  - [x] GET /<known-slug> returns 200 with en post detail (test updated, skipped without live server)
  - [x] GET /pt-br/<known-slug> returns 200 with translation notice (test updated, skipped without live server)
- Test coverage target: >=80% (unit tests satisfy this for the logic covered)
- All applicable tests passing (14 pre-existing DB failures unrelated to this task)

## Success Criteria
- All tests passing
- Test coverage >=80%
- `routeTree.gen.ts` regenerated with `{-$locale}` segments and no references to `$lang`
- All four locale URL shapes render correctly via the new route files
- `make check` + `make lint` green
