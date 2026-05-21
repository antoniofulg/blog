---
status: completed
title: admin-write capability spec
type: test
complexity: low
dependencies:
    - task_08
feature: admin/post-publish
---

# Task 09: admin-write capability spec

## Overview

Second Playwright capability spec covering the editorial surface end-to-end: admin dashboard guard (unauthed → redirect), publish/unpublish toggle round-trip, preview unpublished post. Uses storageState via the `chromium` project config (no per-spec login). First task of Phase 2.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST cover the admin guard: an unauthenticated session (opt-out via `test.use({ storageState: { cookies: [], origins: [] } })`) navigating to `/admin` redirects to `/login`.
- MUST cover the publish toggle: from an authenticated `/admin` dashboard, click the toggle for a known fixture post, verify the row's published state updates in the UI, and verify the DB row's `isPublished` flips.
- MUST cover preview: from `/admin`, navigate to `/admin/preview/<slug>` for an unpublished post; verify content renders.
- MUST use the storageState pattern from task_04 (no per-spec login).
- MUST be tagged `@admin` (and not `@smoke` to keep the smoke subset minimal).
- MUST adhere to `.agents/rules/testing.md` selector + wait conventions (task_08).
- SHOULD reset DB state between tests by re-seeding the fixture post (or use `beforeEach` to ensure deterministic starting state).
</requirements>

## Subtasks

- [ ] 9.1 Create `tests/e2e/admin-write.spec.ts` importing from `./fixtures/auth`.
- [ ] 9.2 Implement admin-guard test with opt-out storageState.
- [ ] 9.3 Implement publish-toggle test against a seeded fixture post.
- [ ] 9.4 Implement preview test for unpublished post.
- [ ] 9.5 Add `beforeEach` (or equivalent) to reset fixture post state.

## Implementation Details

See TechSpec "Build Order step 25" and PRD-007 User Stories (admin publish flow). The fixture post must be seeded via the e2e harness (extend `tests/e2e/seed.ts` if needed — minor addition) so the spec has a known target. The admin dashboard's toggle interaction lives in `app/routes/admin/index.tsx`; the server fn is in `app/routes/admin/index.server.ts` (`togglePublished(id, isPublished)`).

### Relevant Files

- `app/routes/admin/index.tsx` — admin dashboard UI with publish toggle.
- `app/routes/admin/index.server.ts` — `togglePublished` server fn; `requireSession()` guards it.
- `app/routes/admin/preview.$slug.tsx` — preview route for unpublished posts.
- `app/routes/admin/preview.$slug.server.ts` — preview server fn.
- `tests/e2e/fixtures/auth.ts` (task_04) — provides `test` + `expect`.
- `tests/e2e/seed.ts` (task_03) — may need extension to seed a fixture post for the toggle/preview tests.

### Dependent Files

- `.github/workflows/ci.yml` — already wired (task_07); this spec runs in the existing `e2e` matrix entry without changes.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — establishes admin-write as one of the 3 capability specs.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — Phase 2.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — storageState pattern.

## Acceptance Criteria

1. **AC-1**: `bunx playwright test tests/e2e/admin-write.spec.ts` exits 0 with all tests passing.
2. **AC-2**: Admin-guard test: unauthenticated navigation to `/admin` results in URL match `/login`.
3. **AC-3**: Publish-toggle test: clicking the toggle UI control results in the row reflecting the new state AND the DB row's `isPublished` matching the new state (verified via direct PGLite query in the spec).
4. **AC-4**: Preview test: navigating to `/admin/preview/<seeded-unpublished-slug>` renders the post body (verified by presence of fixture title text).
5. **AC-5**: All 3 tests use selectors from the documented hierarchy; no raw CSS.
6. **AC-6**: Running `bunx playwright test --grep @smoke` does NOT include this spec (only `@auth @smoke` from task_05).

## Deliverables

- New file `tests/e2e/admin-write.spec.ts` with 3 tests.
- Optionally modified `tests/e2e/seed.ts` (if fixture post seeding is added).
- Unit tests with 80%+ coverage **(REQUIRED)** — this task delivers tests; coverage is satisfied by the spec being PR-blocking.
- Integration tests for the admin write surface **(REQUIRED)** — this spec IS the integration test.

## Tests

- Unit tests:
  - [ ] Spec file parses without TypeScript errors.
  - [ ] `bunx playwright test --list` includes all 3 tests from this file.
- Integration tests:
  - [ ] Admin-guard test: `await page.goto('/admin')` with empty storageState ends at `/login`.
  - [ ] Publish-toggle test: state transitions captured in both UI and DB.
  - [ ] Preview test: rendered HTML contains the fixture title for the unpublished post.
  - [ ] Edge case: clicking toggle twice (publish → unpublish) leaves DB in original state.
- Test coverage target: >=80% (N/A; this task delivers tests).
- All tests must pass.

## Success Criteria

- All 3 tests passing on local + CI.
- Spec runs in <40 seconds wall-clock.
- Zero flake reports in Phase 2's first week (per PRD's Phase 2 success criteria).
- Selector + wait conventions from `.agents/rules/testing.md` are observed.
