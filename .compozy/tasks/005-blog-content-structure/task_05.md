---
status: completed
title: Root Wrapper + Locale Layout Route
type: frontend
complexity: medium
dependencies:
    - task_04
---

# Task 05: Root Wrapper + Locale Layout Route

## Overview

Wrap the application in `LocaleProvider` by updating `app/routes/__root.tsx`, and create `app/routes/$lang.tsx` as the TanStack Router layout route that validates the `$lang` URL parameter. Together these two changes establish the locale-aware routing foundation that all locale-prefixed routes (tasks 06, 07) nest under.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST wrap the app's children in `LocaleProvider` inside `__root.tsx` — place it as a sibling wrapper to the existing `ThemeProvider`, not inside it
- MUST create `app/routes/$lang.tsx` as a TanStack Router `createFileRoute('/$lang')` layout route
- MUST validate `params.lang` in `$lang.tsx` `beforeLoad` — if the value is not in `LOCALES`, throw `redirect({ to: '/en/blog' })`
- MUST export `Route` from `$lang.tsx` — TanStack Router requires this for route tree generation
- MUST NOT add any UI rendering in `$lang.tsx` beyond `<Outlet />` — it is a layout-only route
- MUST NOT intercept routes that conflict with existing single-segment routes (e.g., `/about`, `/login`) — the `beforeLoad` redirect handles invalid lang values
- MUST regenerate `routeTree.gen.ts` by starting the dev server or running `bunx tsr generate` after creating `$lang.tsx`
</requirements>

## Subtasks

- [x] 5.1 Update `app/routes/__root.tsx` — import `LocaleProvider` from `#/lib/locale`; wrap children in it inside `RootLayout` or `RootDocument`
- [x] 5.2 Create `app/routes/$lang.tsx` — `createFileRoute('/$lang')` with `beforeLoad` validating `$lang` against `LOCALES`; render `<Outlet />`
- [x] 5.3 Regenerate `routeTree.gen.ts` — start dev server or run `bunx tsr generate`
- [x] 5.4 Verify `/invalid-string/blog` redirects to `/en/blog` in the dev server

## Implementation Details

See TechSpec "Core Interfaces → `$lang.tsx` beforeLoad" for the exact validation pattern. See TechSpec "System Architecture → Component Overview" for where `LocaleProvider` sits in the component tree.

The `$lang` dynamic segment will capture any single-path-segment URL. The `beforeLoad` redirect for invalid values (anything not `'en'` or `'pt-br'`) ensures routes like `/about` are not affected — `/about` has its own explicit route file that TanStack Router matches before the dynamic `$lang` segment.

TanStack Router resolves specific routes before dynamic segments, so `/about`, `/login`, `/blog`, etc. continue to work normally.

### Relevant Files

- `app/routes/__root.tsx` — add `LocaleProvider` wrapper; currently wraps in `ThemeProvider`
- `app/lib/locale.tsx` — import `LocaleProvider`, `LOCALES` from here (created in task_04)
- `app/lib/theme.tsx` — reference for how `ThemeProvider` is placed in `__root.tsx`
- `app/routeTree.gen.ts` — auto-regenerated; verify `$lang` layout route and child routes appear correctly

### Dependent Files

- `app/routes/$lang/blog.tsx` — task_06 creates this as a child of `$lang.tsx`; TanStack Router nests it automatically
- `app/routes/$lang/$slug.tsx` — task_07 creates this as a child of `$lang.tsx`
- `app/components/layout/header.tsx` — task_09 uses `useLocale()` which requires `LocaleProvider` to be an ancestor

### Related ADRs

- [ADR-004: Technical architecture — `$lang` layout route, localStorage locale, English fallback rendering](adrs/adr-004.md) — layout route approach chosen over flat file duplication; `beforeLoad` validation on invalid `$lang` values

## Deliverables

- Updated `app/routes/__root.tsx` with `LocaleProvider` wrapping
- New `app/routes/$lang.tsx` layout route with `beforeLoad` validation
- Regenerated `routeTree.gen.ts` showing `$lang` as a parent route
- `tsc --noEmit` exits 0
- `make test` exits 0

## Tests

- Unit tests:
  - [ ] `tsc --noEmit` passes — `$lang.tsx` exports `Route` correctly; `__root.tsx` compiles with `LocaleProvider` import
  - [ ] `make test` passes — `LocaleProvider` wrap does not break existing root tests or admin route tests
- Integration tests:
  - [ ] `GET /invalid/blog` → redirects to `/en/blog` (beforeLoad fires, `'invalid'` not in `LOCALES`)
  - [ ] `GET /en/blog` → `$lang.tsx` beforeLoad passes, `<Outlet />` renders child route (task_06)
  - [ ] `GET /about` → `about.tsx` route resolves correctly; `$lang.tsx` not triggered
- Test coverage target: beforeLoad logic is a 2-branch function (valid/invalid lang); both branches tested
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `routeTree.gen.ts` contains `$lang` layout route with no manual edits
- `LocaleProvider` wraps the app — `useLocale()` returns `'en'` by default throughout the component tree
- `/invalid/blog` redirects to `/en/blog`
- Existing routes (`/about`, `/login`, `/admin`) are unaffected
