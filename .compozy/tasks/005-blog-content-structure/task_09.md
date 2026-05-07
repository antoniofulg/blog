---
status: completed
title: Language Switcher in Header
type: frontend
complexity: low
dependencies:
    - task_05
    - task_06
    - task_07
---

# Task 09: Language Switcher in Header

## Overview

Add a language switcher button to `app/components/layout/header.tsx`. The button reads the current locale via `useLocale()`, calls `setLocale()` on click, and navigates to the locale-prefixed equivalent of the current URL — or to the locale listing if no translated version of the current post is known.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add a language switcher button visible on all pages (desktop and mobile) — not hidden in footer or hamburger-only
- MUST use `useLocale()` to read current locale and `setLocale()` to persist the new choice to localStorage
- MUST use TanStack Router's `useNavigate` or `useRouter` to navigate to the locale-prefixed URL after switching
- MUST switch from `/en/<slug>` to `/pt-br/<slug>` (same slug) when on a post page; fall back to `/$targetLang/blog` when the current path is locale-less or unknown
- MUST display the alternate locale label on the button (e.g., "PT" when current is English, "EN" when current is Portuguese)
- MUST work on both desktop nav and mobile menu overlay
- MUST NOT break the existing theme toggle or navigation links
</requirements>

## Subtasks

- [x] 9.1 Add `useLocale()` and TanStack Router navigation hooks to `header.tsx`
- [x] 9.2 Compute target URL: if current path matches `/$lang/$slug` pattern, swap `$lang`; otherwise navigate to `/$targetLang/blog`
- [x] 9.3 Add switcher button to desktop nav (alongside theme toggle) and mobile menu
- [x] 9.4 Verify: on `/en/react-suspense`, clicking switcher navigates to `/pt-br/react-suspense` and stores `'pt-br'` in localStorage

## Implementation Details

See TechSpec "System Architecture → Component Overview → UI Layer" and PRD "Core Features → F6 — Language Switcher" for switcher behavior spec.

The header currently has no awareness of the current route's `$lang` or `$slug` params. Use TanStack Router's `useRouterState` or `useMatches` to read the current location pathname and parse the `$lang` segment to compute the target URL.

The switcher label showing the alternate locale (not the current one) follows the standard pattern — users click what they want to switch TO.

### Relevant Files

- `app/components/layout/header.tsx` — the only file to modify; currently has 6 nav links + theme toggle
- `app/lib/locale.tsx` — import `useLocale`, `LOCALES` from here (task_04)
- `app/lib/theme.tsx` — reference for how `useTheme` is used in the header for the theme toggle

### Dependent Files

- `app/tests/` — add header test for switcher render and click behavior if a header test file exists; otherwise add to an appropriate test file

### Related ADRs

- [ADR-004: Technical architecture — `$lang` layout route, localStorage locale, English fallback rendering](adrs/adr-004.md) — localStorage locale persistence; switcher falls back to listing when no translation exists

## Deliverables

- Updated `app/components/layout/header.tsx` with language switcher on desktop and mobile
- Switcher correctly swaps locale in URL and persists to localStorage
- `tsc --noEmit` exits 0
- `make test` exits 0

## Tests

- Unit tests:
  - [x] `tsc --noEmit` passes — `useLocale()` import compiles correctly in header component
  - [x] Switcher button renders with label `'PT'` when `locale = 'en'`
  - [x] Switcher button renders with label `'EN'` when `locale = 'pt-br'`
  - [x] Clicking switcher on `/en/react-suspense` calls navigate to `/pt-br/react-suspense` and `setLocale('pt-br')`
  - [x] Clicking switcher on `/en/blog` navigates to `/pt-br/blog`
- Integration tests:
  - [x] Switcher button visible in rendered header on `/en/blog`
  - [x] After clicking switcher, `localStorage.getItem('locale')` returns `'pt-br'`
- Test coverage target: >=80% on new switcher logic
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- Language switcher button visible on desktop and mobile header
- Clicking switcher navigates to the locale-swapped URL
- `localStorage` updated with new locale after click
- Theme toggle and existing nav links unaffected
