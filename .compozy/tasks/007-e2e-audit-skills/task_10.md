---
status: complete
title: public-read capability spec
type: test
complexity: low
dependencies:
  - task_08
feature: blog/public-read
---

# Task 10: public-read capability spec

## Overview

Third Playwright capability spec covering the public reader surface end-to-end: a published post rendering in both locales (en + pt-br), the locale switcher behavior, and the 404 path for a non-existent slug. Uses an anonymous session via `test.use({ storageState: { cookies: [], origins: [] } })`. Closes Phase 2.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST opt out of admin storageState via `test.use({ storageState: { cookies: [], origins: [] } })` at the top of the spec file.
- MUST render a published fixture post at `/<slug>` (en, default locale, no prefix) and verify title + body presence.
- MUST render the pt-br twin at `/pt-br/<slug>` and verify title + body presence in Portuguese.
- MUST exercise the locale switcher UI: from en post, switch to pt-br, verify URL changes to `/pt-br/<slug>` and content updates.
- MUST exercise the 404 path: navigate to `/<non-existent-slug>`; verify the 404 page renders.
- MUST be tagged `@public`; one of the tests may also carry `@smoke` if the team wants public-read in the smoke subset.
- MUST adhere to `.agents/rules/testing.md` conventions (task_08).
</requirements>

## Subtasks

- [x] 10.1 Create `tests/e2e/public-read.spec.ts` with the `test.use({ storageState: ... })` opt-out.
- [x] 10.2 Implement en post render test against a seeded fixture post.
- [x] 10.3 Implement pt-br post render test.
- [x] 10.4 Implement locale switcher test.
- [x] 10.5 Implement 404 test.

## Implementation Details

See TechSpec "Build Order step 26" and PRD-007 User Stories ("reader lands on post that has expected title…", "reader who prefers pt-br finds every English post translated"). The fixture posts must exist as MDX files under `app/content/posts/en/` and `app/content/posts/pt-br/` AND be indexed into the PGLite `posts` table by `tests/e2e/seed.ts` (extend if needed). The locale switcher lives in the layout component (header); its exact interaction shape (button, dropdown, link) must be discovered from `app/components/layout/` at implementation time.

### Relevant Files

- `app/routes/{-$locale}/index.tsx` — blog home (renders post list).
- `app/routes/{-$locale}/$slug.tsx` — single post page; reads slug + locale params.
- `app/routes/{-$locale}/$slug.server.ts` — server fn `getPost(slug, locale)`.
- `app/components/layout/` — locale switcher component lives here (exact file TBD at implementation time).
- `app/lib/locale.tsx` — `localeHref()` helper used to compute URLs.
- `tests/e2e/seed.ts` (task_03) — may need extension to seed fixture posts in both locales.
- `app/content/posts/en/`, `app/content/posts/pt-br/` — fixture post location (or use existing posts if stable).

### Dependent Files

- `.github/workflows/ci.yml` — already wired (task_07).

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — establishes public-read as one of the 3 capability specs.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — Phase 2.

## Acceptance Criteria

1. **AC-1**: `bunx playwright test tests/e2e/public-read.spec.ts` exits 0 with all tests passing.
2. **AC-2**: en render test: `await page.goto('/<slug>')` returns 200 and shows the fixture title via `getByRole('heading', { name: ... })`.
3. **AC-3**: pt-br render test: `await page.goto('/pt-br/<slug>')` returns 200 and shows the Portuguese fixture title.
4. **AC-4**: Locale switcher test: clicking the pt-br option from an en post navigates to `/pt-br/<slug>` and the URL + content both reflect pt-br.
5. **AC-5**: 404 test: `await page.goto('/<non-existent-slug>')` renders the 404 page (verified by presence of 404-specific text from `app/lib/i18n/strings.ts`).
6. **AC-6**: No admin cookies present in any request (verified by checking `page.context().cookies()` after each test).

## Deliverables

- New file `tests/e2e/public-read.spec.ts` with 4 tests.
- Optionally modified `tests/e2e/seed.ts` (if bilingual fixture post seeding is added).
- Optionally new fixture MDX files under `app/content/posts/{en,pt-br}/e2e-fixture.mdx`.
- Unit tests with 80%+ coverage **(REQUIRED)** — this task delivers tests; coverage is satisfied by PR-blocking.
- Integration tests for the public read surface **(REQUIRED)** — this spec IS the integration test.

## Tests

- Unit tests:
  - [ ] Spec file parses without TypeScript errors.
  - [ ] `bunx playwright test --list` includes all 4 tests.
- Integration tests:
  - [ ] en render: title heading visible, body content present.
  - [ ] pt-br render: title heading visible in Portuguese, URL prefix `/pt-br/`.
  - [ ] Locale switcher: from en, switching to pt-br updates URL and content within 2s.
  - [ ] 404 path: navigation to a non-existent slug renders the 404 page (verified by i18n 404 string presence).
  - [ ] Edge case: hydration completes without console errors (assert no `console.error` events during page lifecycle).
- Test coverage target: >=80% (N/A; this task delivers tests).
- All tests must pass.

## Success Criteria

- All 4 tests passing on local + CI.
- Spec runs in <30 seconds wall-clock.
- Phase 2 success criteria from PRD met: all 3 specs green on 3 consecutive PRs; rolling 30-day flake rate <2%.
- No `console.error` events captured during navigation.
