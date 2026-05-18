---
status: pending
title: auth-flow capability spec
type: test
complexity: low
dependencies:
  - task_04
feature: testing/auth-flow-spec
---

# Task 05: auth-flow capability spec

## Overview

First Playwright capability spec covering the auth surface end-to-end: UI login round-trip against the seeded user, session presence after login, logout. This spec validates the storageState pipeline from task_04 and acts as the PR-blocking smoke gate for Phase 1.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST exercise the `/login` route's UI form (email + password inputs) against the e2e-seeded admin user.
- MUST verify Better Auth set the session cookie after successful sign-in (cookie present in `page.context().cookies()`).
- MUST verify a logged-in user can access `/admin` (status 200, dashboard content present).
- MUST verify logout clears the session and `/admin` redirects to `/login`.
- MUST wait for the TanStack Start hydration marker (per `.agents/rules/testing.md` to be written in task_08) before asserting; MUST NOT use `page.waitForTimeout()`.
- MUST use selector hierarchy: `getByRole` > `getByLabel` > `getByText` > `data-testid`; never raw CSS selectors.
- MUST be tagged with `@auth` and `@smoke` (Playwright tags) for selective runs.
</requirements>

## Subtasks

- [ ] 5.1 Create `tests/e2e/auth-flow.spec.ts` importing from `./fixtures/auth`.
- [ ] 5.2 Implement login round-trip test: `/login` → fill credentials → submit → assert redirect → assert session cookie.
- [ ] 5.3 Implement session-presence test: navigate to `/admin` (storageState applied via project) → assert dashboard renders.
- [ ] 5.4 Implement logout test: trigger logout (button or `auth.signOut()`) → assert redirect to `/login` on next admin nav.
- [ ] 5.5 Apply `@auth @smoke` tags to all tests in the file.

## Implementation Details

See TechSpec "Build Order step 12" and PRD-007 User Stories ("As the developer, I want every PR to run e2e on Chromium and block merge on red"). Selector and wait-strategy conventions are documented in `.agents/rules/testing.md` (created in task_08); this spec is the FIRST consumer of those conventions, so it must demonstrate them correctly.

### Relevant Files

- `app/routes/login.tsx` — UI surface under test; form inputs are `name="email"` and `name="password"`.
- `app/routes/admin/index.tsx` — protected route; `beforeLoad` redirects unauthed users to `/login`.
- `app/routes/admin/index.server.ts` — server fn calls `requireSession()`; ensures DAL-level auth gate.
- `tests/e2e/fixtures/auth.ts` (task_04) — provides `test` + `expect` + `freshLogin`.
- `app/lib/auth.client.ts` — client-side signOut call signature; reference for logout test.

### Dependent Files

- `.github/workflows/ci.yml` (task_07) — gates merges on this spec passing.
- `.agents/skills/e2e-coverage/SKILL.md` (task_08) — uses this spec as the canonical pattern reference for generating future specs.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — establishes auth-flow as one of the 3 capability specs.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — confirms this spec is part of Phase 1's MVP.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — fixture pattern + hydration marker convention.

## Acceptance Criteria

1. **AC-1**: `bunx playwright test tests/e2e/auth-flow.spec.ts` exits 0 with all tests passing on a clean PGLite suite.
2. **AC-2**: The login test fails (red CI) if `/login`'s form inputs are renamed; verified by deliberately renaming `name="email"` in a fixture branch.
3. **AC-3**: All assertions use the documented selector hierarchy; no raw CSS selectors appear in the spec file.
4. **AC-4**: No `page.waitForTimeout()` calls appear in the spec; all waits use `waitForLoadState`, `waitForURL`, or auto-waiting locators.
5. **AC-5**: Running `bunx playwright test --grep @smoke` includes this spec; `--grep-invert @smoke` excludes it.

## Deliverables

- New file `tests/e2e/auth-flow.spec.ts` with 3 tests (login / session / logout).
- Unit tests with 80%+ coverage **(REQUIRED)** — N/A directly (this IS the test); coverage is satisfied by the spec being PR-blocking.
- Integration tests for the auth surface **(REQUIRED)** — this spec IS the integration test.

## Tests

- Unit tests:
  - [ ] Spec file parses without TypeScript errors (verified by `tsc --noEmit` running on `tests/e2e/**/*.ts`).
  - [ ] `bunx playwright test --list` includes the 3 tests from this file.
- Integration tests:
  - [ ] Login test: `/login` form submission with seeded credentials results in HTTP 200 on next `/admin` GET and a `better-auth.session_token` cookie set.
  - [ ] Session-presence test: `await page.goto('/admin')` from storageState session returns dashboard content (`getByRole('heading', { name: /admin|dashboard/i })`).
  - [ ] Logout test: triggering logout then `await page.goto('/admin')` results in redirect to `/login` (URL match).
  - [ ] Wrong-password edge case: filling the wrong password results in a visible error message and the URL stays at `/login`.
- Test coverage target: >=80% (N/A; this task delivers tests).
- All tests must pass.

## Success Criteria

- All 3 tests passing on local + CI.
- Spec runs in <30 seconds wall-clock.
- Zero flake reports against this spec in Phase 1's first week (per PRD's Phase 1 success criteria).
- Selector + wait conventions documented in `.agents/rules/testing.md` (task_08) are demonstrated correctly here.
