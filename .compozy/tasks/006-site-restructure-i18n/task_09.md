---
status: completed
title: Add hreflang pairs to locale-aware pages
type: frontend
complexity: low
dependencies:
    - task_07
---

# Task 09: Add hreflang pairs to locale-aware pages

## Overview
The existing pattern on the post detail route renders `<link rel="alternate" hreflang>` pairs for cross-locale indexing. Extend the same pattern to the post feed root (`/` and `/pt-br/`) so every locale-aware page in V1 Phase 2 has hreflang pairs. About is locale-aware too, but its hreflang pair lands in task_13 when the route is created.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `app/routes/{-$locale}/index.tsx` MUST render `<link rel="alternate" hreflang="en" href="/">` and `<link rel="alternate" hreflang="pt-br" href="/pt-br/">` in the SSR `<head>` regardless of which locale is being served.
- `app/routes/{-$locale}/$slug.tsx` hreflang behavior MUST be preserved from the pre-restructure implementation (the pattern is already in place; verify it still emits correct URLs in the new route file).
- Hreflang URLs MUST follow the URL-prefix scheme: `/` for en, `/pt-br/` for pt-br. No `/en/` prefix in any href.
- Both hreflang and the page's own canonical link tags MUST coexist without conflict.
- Tests MUST assert presence and shape of hreflang pairs on both feed and post detail in both locales.
</requirements>

## Subtasks
- [ ] 9.1 Add hreflang rendering to `{-$locale}/index.tsx`
- [ ] 9.2 Verify post detail hreflang in `{-$locale}/$slug.tsx` is preserved with correct URLs
- [ ] 9.3 Add integration tests asserting hreflang pairs on `/`, `/pt-br/`, post detail
- [ ] 9.4 Curl-smoke-test the head tags against dev

## Implementation Details
See TechSpec "Implementation Design → API Endpoints" — hreflang is required on every locale-aware visitor page. The existing pattern in the original `$lang/$slug.tsx:33-46` is the reference. About hreflang lands in task_13.

### Relevant Files
- `app/routes/{-$locale}/index.tsx` — primary target
- `app/routes/{-$locale}/$slug.tsx` — verify existing pattern preserved

### Dependent Files
- task_06 (route subtree) provides the files this task modifies
- task_13 extends hreflang to About

### Related ADRs
- [ADR-001: V1 Scope](adrs/adr-001.md) — hreflang on all locale-aware pages
- [ADR-005: Cookie-First SSR Redirect](adrs/adr-005.md) — hreflang complements the redirect for bot indexing
- [ADR-004: Optional Path-Param Routing](adrs/adr-004.md) — route file structure

## Deliverables
- Updated `{-$locale}/index.tsx` with hreflang pairs
- Integration tests covering hreflang on feed and post detail
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for hreflang HTML head shape **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] Hreflang helper or inline render returns the two expected `<link>` tags for any input locale
- Integration tests:
  - [ ] SSR `GET /` HTML head contains `<link rel="alternate" hreflang="en" href="/">`
  - [ ] SSR `GET /` HTML head contains `<link rel="alternate" hreflang="pt-br" href="/pt-br/">`
  - [ ] SSR `GET /pt-br/` HTML head contains both hreflang pairs with the same URLs
  - [ ] SSR `GET /<known-slug>` HTML head contains hreflang pair pointing at `/pt-br/<slug>`
  - [ ] SSR `GET /pt-br/<known-slug>` HTML head contains hreflang pair pointing at `/<slug>`
  - [ ] Hreflang URLs contain no `/en/` prefix
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Hreflang pairs visible via `curl https://blog/ | grep hreflang` on `/`, `/pt-br/`, and post detail URLs
- Per DigitalApplied 2026 data, V1 sits in the 25% of multilingual sites that correctly implement hreflang
