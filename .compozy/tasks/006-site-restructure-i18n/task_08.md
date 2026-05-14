---
status: completed
title: Implement cookie-first SSR redirect on `/`
type: backend
complexity: medium
dependencies:
    - task_07
---

# Task 08: Implement cookie-first SSR redirect on `/`

## Overview
When a visitor requests `/`, the SSR layer reads the `locale` cookie (precedent) or falls back to Accept-Language. Portuguese-language visitors get a 302 to `/pt-br/`. Bots without Accept-Language stay at `/` (en canonical). Implements ADR-005, which supersedes the no-redirect alternative in ADR-001.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- The `{-$locale}/index.tsx` route (or its parent layout, whichever is more appropriate per TanStack Router conventions) MUST implement a `beforeLoad` that calls `detectLocaleFromRequest(request)` from `app/lib/locale.tsx`.
- When the URL path has no locale prefix AND the detected locale is NOT `DEFAULT_LOCALE`, the handler MUST `throw redirect({ to: '/<locale>/', statusCode: 302 })`.
- The `locale` cookie MUST take precedence over Accept-Language (already implemented in `detectLocaleFromRequest`; do not duplicate logic).
- The response on `/` MUST set `Vary: Cookie, Accept-Language` regardless of whether the redirect fires, so CDNs cache correctly.
- A bot or request without Accept-Language MUST stay at `/` rendering en content.
- Tests MUST cover all five cookie/Accept-Language combinations listed in TechSpec Testing Approach.
</requirements>

## Subtasks
- [x] 8.1 Implement `beforeLoad` in the appropriate route file with `detectLocaleFromRequest` call
- [x] 8.2 Add `Vary: Cookie, Accept-Language` response header on `/`
- [x] 8.3 Extend unit tests for `detectLocaleFromRequest` to cover any uncovered edge cases
- [x] 8.4 Add integration tests for SSR redirect behavior on `/`
- [ ] 8.5 Curl-smoke-test against dev server with various Cookie + Accept-Language combinations (manual — requires running server)

## Implementation Details
See TechSpec "Implementation Design → Core Interfaces" sketch labeled "Cookie-first redirect at `/`" for the route file shape. See ADR-005 for the full decision context and supersession of ADR-001. The `detectLocaleFromRequest` function already implements cookie + Accept-Language precedence — do not re-implement.

### Relevant Files
- `app/routes/{-$locale}/index.tsx` or `app/routes/{-$locale}.tsx` (decide via TanStack Router conventions during implementation)
- `app/lib/locale.tsx` — `detectLocaleFromRequest`, `DEFAULT_LOCALE`, `LOCALES`

### Dependent Files
- task_06 + task_07 must have landed so the layout exists
- CDN configuration consumes the `Vary` header (out of V1 scope; documented in ADR-005)

### Related ADRs
- [ADR-005: Cookie-First SSR Auto-Redirect on `/`](adrs/adr-005.md) — supersedes ADR-001 no-redirect
- [ADR-001: V1 Scope](adrs/adr-001.md) — partially superseded by ADR-005
- [ADR-004: Optional Path-Param Routing](adrs/adr-004.md) — provides the route file structure

## Deliverables
- `beforeLoad` handler with redirect logic
- `Vary` response header
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for all five cookie/Accept-Language combinations **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `detectLocaleFromRequest` returns "en" when `Cookie: locale=en` is set (no fallback)
  - [x] `detectLocaleFromRequest` returns "pt-br" when `Cookie: locale=pt-br` is set
  - [x] `detectLocaleFromRequest` returns "pt-br" when no cookie + `Accept-Language: pt-BR`
  - [x] `detectLocaleFromRequest` returns "en" when no cookie + `Accept-Language: en-US`
  - [x] `detectLocaleFromRequest` returns `DEFAULT_LOCALE` when no cookie + no Accept-Language
- Integration tests:
  - [x] SSR `GET /` with `Cookie: locale=pt-br` returns 302 with `Location: /pt-br/`
  - [x] SSR `GET /` with `Cookie: locale=en` + `Accept-Language: pt-BR` returns 200 (cookie wins, no redirect)
  - [x] SSR `GET /` with `Accept-Language: pt` and no cookie returns 302 to `/pt-br/`
  - [x] SSR `GET /` with no Cookie + no Accept-Language returns 200 (no redirect)
  - [x] Response on `/` includes `Vary` header containing both `Cookie` and `Accept-Language` regardless of redirect outcome
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Behavior matches ADR-005 specification
- `Vary: Cookie, Accept-Language` set on `/`
- Bots without Accept-Language stay at `/` en canonical (manual smoke test with `curl -I` and no headers)
