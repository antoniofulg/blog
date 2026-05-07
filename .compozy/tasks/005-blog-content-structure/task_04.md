---
status: completed
title: Locale System
type: frontend
complexity: low
dependencies: []
---

# Task 04: Locale System

## Overview

Create `app/lib/locale.tsx` — a locale state module that mirrors the existing `app/lib/theme.tsx` pattern. It provides `LocaleProvider`, `useLocale()`, the `LOCALES` constant, and a `detectLocaleFromRequest()` utility for server-side `Accept-Language` header parsing. This is the foundational locale primitive that all routing and UI tasks depend on.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST define `type Locale = "en" | "pt-br"` and export it
- MUST export `LOCALES: Locale[] = ["en", "pt-br"]` and `DEFAULT_LOCALE: Locale = "en"`
- MUST implement `LocaleProvider` that reads `localStorage.getItem('locale')` on mount, falls back to `DEFAULT_LOCALE`, and exposes `setLocale()` that writes to localStorage
- MUST implement `useLocale()` hook returning `{ locale: Locale; setLocale: (l: Locale) => void }`
- MUST implement `detectLocaleFromRequest(request: Request): Locale` — reads `Accept-Language` header; any `pt-*` value (case-insensitive) returns `'pt-br'`; all other values return `DEFAULT_LOCALE`
- MUST follow the `app/lib/theme.tsx` pattern exactly for the provider/hook structure
- MUST NOT perform any navigation or routing in this file — that belongs in the route files
</requirements>

## Subtasks

- [x] 4.1 Create `app/lib/locale.tsx` with `Locale` type, constants, `LocaleProvider`, and `useLocale()` — mirror `theme.tsx` structure
- [x] 4.2 Add `detectLocaleFromRequest(request: Request): Locale` — parse `Accept-Language` header for `pt-*` pattern
- [x] 4.3 Add unit tests in `app/tests/` covering: localStorage persistence, default fallback, `detectLocaleFromRequest` with various header values

## Implementation Details

See TechSpec "Core Interfaces → Locale system" for the exact type signatures and "Core Interfaces → Locale detection utility" for the `detectLocaleFromRequest` logic. Reference `app/lib/theme.tsx` for the React context + localStorage pattern to replicate.

The `detectLocaleFromRequest` function is a pure utility — it receives a `Request` object (available via `getRequest()` from `@tanstack/react-start/server` in server-side contexts) and reads the `Accept-Language` header. The regex `/\bpt\b/i` or a simpler `startsWith('pt')` check on the parsed header values is sufficient.

### Relevant Files

- `app/lib/theme.tsx` — the exact pattern to replicate for `LocaleProvider` and `useLocale()`
- `app/lib/auth.ts` — reference for how other lib files are structured (server-only vs isomorphic)
- `app/routes/__root.tsx` — task_05 wraps children in `LocaleProvider` here

### Dependent Files

- `app/routes/__root.tsx` — task_05 imports `LocaleProvider` from this file
- `app/routes/$lang.tsx` — task_05 imports `LOCALES` for `beforeLoad` validation
- `app/routes/index.tsx`, `app/routes/blog.tsx`, `app/routes/$slug.tsx` — task_08 imports `detectLocaleFromRequest`
- `app/components/layout/header.tsx` — task_09 imports `useLocale`

### Related ADRs

- [ADR-004: Technical architecture — `$lang` layout route, localStorage locale, English fallback rendering](adrs/adr-004.md) — localStorage persistence mirrors theme; `detectLocaleFromRequest` uses Accept-Language
- [ADR-005: Initial locale detection — Accept-Language header + Portuguese country mapping](adrs/adr-005.md) — defines the `pt-*` detection rule and why IP geolocation was rejected

## Deliverables

- `app/lib/locale.tsx` with all exports: `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `LocaleProvider`, `useLocale`, `detectLocaleFromRequest`
- Unit tests covering all exported functions
- `tsc --noEmit` exits 0
- `make test` exits 0

## Tests

- Unit tests:
  - [x] `detectLocaleFromRequest` with `Accept-Language: pt-BR,pt;q=0.9,en-US;q=0.8` → returns `'pt-br'`
  - [x] `detectLocaleFromRequest` with `Accept-Language: en-US,en;q=0.9` → returns `'en'`
  - [x] `detectLocaleFromRequest` with `Accept-Language: pt` → returns `'pt-br'`
  - [x] `detectLocaleFromRequest` with missing/empty header → returns `'en'`
  - [x] `LocaleProvider` initializes with `'en'` when localStorage has no `'locale'` key
  - [x] `setLocale('pt-br')` writes `'pt-br'` to `localStorage.getItem('locale')`
  - [x] `useLocale()` returns `{ locale, setLocale }` matching current provider state
- Integration tests:
  - [ ] `make test` passes — new file does not break existing test suite
- Test coverage target: >=80% on `locale.tsx`
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `app/lib/locale.tsx` exports `Locale`, `LOCALES`, `DEFAULT_LOCALE`, `LocaleProvider`, `useLocale`, `detectLocaleFromRequest`
- `detectLocaleFromRequest` correctly identifies `pt-*` Accept-Language values
- `LocaleProvider` persists locale choice in `localStorage` key `'locale'`
