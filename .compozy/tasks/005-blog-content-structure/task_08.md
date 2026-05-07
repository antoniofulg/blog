---
status: completed
title: Legacy Route Redirects + Locale Detection
type: frontend
complexity: medium
dependencies:
  - task_04
  - task_06
  - task_07
---

# Task 08: Legacy Route Redirects + Locale Detection

## Overview

Convert three locale-less entry routes (`app/routes/index.tsx`, `app/routes/blog.tsx`, `app/routes/$slug.tsx`) from data-fetching routes to redirect routes. Each calls `detectLocaleFromRequest()` server-side to determine the target locale and throws a TanStack Router redirect to the locale-prefixed equivalent. This preserves backward compatibility for bookmarked URLs while routing users to the correct locale experience.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST update `app/routes/index.tsx` loader to call `detectLocaleFromRequest(getRequest())` and throw `redirect({ to: '/$lang/blog', params: { lang } })`
- MUST update `app/routes/blog.tsx` loader with the same locale detection + redirect to `/$lang/blog`
- MUST update `app/routes/$slug.tsx` loader to detect locale and redirect to `/$lang/$slug` preserving the `$slug` param
- MUST remove all data-fetching logic from the three routes (post queries, MDX rendering, view count) — this is now in `$lang/blog.tsx` and `$lang/$slug.tsx`
- MUST import `detectLocaleFromRequest` from `#/lib/locale` and `getRequest` from `@tanstack/react-start/server`
- MUST keep the route file itself (do not delete) — the redirect logic must live somewhere for TanStack Router to register the route
- MUST NOT break the admin routes, API routes, or any other existing routes
</requirements>

## Subtasks

- [x] 8.1 Update `app/routes/index.tsx` — strip data-fetch logic; add locale detect + redirect to `/$lang/blog`
- [x] 8.2 Update `app/routes/blog.tsx` — strip pagination logic; add locale detect + redirect to `/$lang/blog`
- [x] 8.3 Update `app/routes/$slug.tsx` — strip post fetch and MDX render; add locale detect + redirect to `/$lang/$slug`
- [x] 8.4 Verify redirects: `GET /` → `302` to `/en/blog` (or `/pt-br/blog` if pt-BR Accept-Language); `GET /blog` → same; `GET /react-suspense` → `/en/react-suspense`

## Implementation Details

See TechSpec "Development Sequencing → steps 13-15" for the per-route change description. See TechSpec "Core Interfaces → Locale detection utility" for how `detectLocaleFromRequest` is called.

The `loader` function (not `beforeLoad`) is the right place for the redirect because `getRequest()` is available in server function context. TanStack Router redirects thrown in `loader` execute server-side, causing no client-visible flash.

Existing `head()` meta in `$slug.tsx` can be removed — the new `$lang/$slug.tsx` (task_07) handles SEO meta.

### Relevant Files

- `app/routes/index.tsx` — strip hero section data fetch; keep route structure, add redirect loader
- `app/routes/blog.tsx` — strip pagination and post fetch; add redirect loader
- `app/routes/$slug.tsx` — strip post fetch, MDX render, view count, head meta; add redirect loader
- `app/lib/locale.tsx` — import `detectLocaleFromRequest` from here (task_04)

### Dependent Files

- `app/tests/public-routes.test.ts` — update: old route tests for `getPostBySlugFn` and `getPublishedPostsFn` on these routes now move to the `$lang/` route tests (tasks 06, 07); these three routes now test redirect behavior only

### Related ADRs

- [ADR-005: Initial locale detection — Accept-Language header + Portuguese country mapping](adrs/adr-005.md) — defines the detection strategy used in these loaders

## Deliverables

- `app/routes/index.tsx` redirects to `/$lang/blog` based on detected locale
- `app/routes/blog.tsx` redirects to `/$lang/blog`
- `app/routes/$slug.tsx` redirects to `/$lang/$slug`
- All old data-fetching removed from these three files
- `tsc --noEmit` exits 0
- `make test` exits 0

## Tests

- Unit tests:
  - [x] `tsc --noEmit` passes — all three routes compile after stripping data-fetch imports
  - [x] `GET /` with `Accept-Language: pt-BR` → redirect to `/pt-br/blog`
  - [x] `GET /` with `Accept-Language: en-US` → redirect to `/en/blog`
  - [x] `GET /blog` → redirect to `/en/blog` (default)
  - [x] `GET /react-suspense` → redirect to `/en/react-suspense`
- Integration tests:
  - [x] `GET /` returns HTTP redirect (301/302) to `/en/blog`
  - [x] `GET /blog` returns redirect to `/en/blog`
  - [x] `GET /react-suspense` returns redirect to `/en/react-suspense`
  - [x] Admin routes (`/admin`, `/admin/preview/react-suspense`) — unaffected; still serve correctly
- Test coverage target: 3-branch redirect logic (index, blog, slug) fully tested
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `GET /`, `GET /blog`, `GET /$slug` each redirect to locale-prefixed equivalents
- No data-fetching code remains in the three legacy route files
- Admin and auth routes are unaffected
