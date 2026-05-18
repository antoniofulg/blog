---
status: pending
title: Playwright config + auth.setup + auth fixture
type: test
complexity: medium
dependencies:
  - task_01
  - task_03
feature: testing/playwright-config
---

# Task 04: Playwright config + auth.setup + auth fixture

## Overview

Wire Playwright's root configuration with the canonical "auth setup project + storageState" pattern (per ADR-004). One `setup` project runs `auth.setup.ts` once to perform the UI login and save `tests/e2e/.auth/admin.json`; the `chromium` project depends on `setup` and inherits storageState. Export a typed `AuthedFixture` from `tests/e2e/fixtures/auth.ts` for downstream specs.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `playwright.config.ts` at the repo root with: `workers: 1`, `retries: process.env.CI ? 1 : 0`, `testDir: 'tests/e2e'`, two projects (`setup` + `chromium`), `chromium` depends on `setup` and uses `storageState: 'tests/e2e/.auth/admin.json'`.
- MUST configure `webServer` to spawn `bun preview` (production-like SSR) with `DATABASE_URL` env var pointing at the PGLite connection string from `global-setup.ts`.
- MUST register `globalSetup: './tests/e2e/global-setup.ts'` and `globalTeardown: './tests/e2e/global-teardown.ts'`.
- MUST create `tests/e2e/auth.setup.ts` as a single Playwright test in the `setup` project that performs the UI login round-trip and saves storageState.
- MUST create `tests/e2e/fixtures/auth.ts` exporting the typed `test` extension with `AuthedFixture` shape from TechSpec "Core Interfaces".
- MUST export a `freshLogin(page)` helper from the fixture for the rare case a spec needs a non-cached session.
- MUST NOT commit `tests/e2e/.auth/admin.json`; verify `.gitignore` (added in task_01) excludes it.
</requirements>

## Subtasks

- [ ] 4.1 Create `playwright.config.ts` with projects, retries, webServer, globalSetup/Teardown wiring.
- [ ] 4.2 Create `tests/e2e/auth.setup.ts` performing UI login + `page.context().storageState({ path: '.auth/admin.json' })`.
- [ ] 4.3 Create `tests/e2e/fixtures/auth.ts` exporting `test` (extended) + `expect` re-export + `freshLogin(page)` helper.
- [ ] 4.4 Verify `tests/e2e/.auth/` is gitignored (entry from task_01); fail if not.

## Implementation Details

See TechSpec "Build Order steps 7, 10, 11" and "Core Interfaces → tests/e2e/fixtures/auth.ts". The Playwright project dependency wiring is documented in Playwright's official auth docs; the config in this task is the canonical adaptation, not a custom variant.

### Relevant Files

- `tests/e2e/db.ts` (task_03) — provides the connection string to webServer.
- `tests/e2e/global-setup.ts` (task_03) — sets the env var that webServer reads.
- `app/routes/login.tsx` — the UI surface auth.setup.ts targets (form inputs: `email`, `password`; submit triggers Better Auth sign-in).
- `app/lib/auth.client.ts` — client-side auth client used by login form; reference for the call shape.
- `.gitignore` — confirms `tests/e2e/.auth/` exclusion entry exists.

### Dependent Files

- `tests/e2e/auth-flow.spec.ts` (task_05) — first consumer of the fixture.
- `tests/e2e/admin-write.spec.ts` (task_09) — uses storageState via project config.
- `tests/e2e/public-read.spec.ts` (task_10) — opts out of storageState via `test.use({ storageState: { cookies: [], origins: [] } })`.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — establishes owned auth fixture as a contract.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — locks Playwright canonical setup+storageState pattern.

## Acceptance Criteria

1. **AC-1**: `bunx playwright test --list` outputs both `setup` and `chromium` projects with the auth.setup.ts file listed under `setup`.
2. **AC-2**: Running `bunx playwright test --project=setup` succeeds and writes a valid storageState JSON to `tests/e2e/.auth/admin.json`.
3. **AC-3**: A subsequent run of `bunx playwright test --project=chromium` with a stub spec inherits the storageState (e.g., `await page.goto('/admin')` returns 200 instead of redirecting).
4. **AC-4**: `freshLogin(page)` performs the UI login round-trip without consulting the storageState file.
5. **AC-5**: `git check-ignore tests/e2e/.auth/admin.json` exits 0 (file is ignored).
6. **AC-6**: The webServer process started by Playwright connects to PGLite (verified by `auth.setup.ts`'s login succeeding against the seeded user).

## Deliverables

- New file `playwright.config.ts` at the repo root.
- New files `tests/e2e/auth.setup.ts`, `tests/e2e/fixtures/auth.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for the setup → spec project chain **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] Static config sanity: `playwright.config.ts` parses without TypeScript errors and `defineConfig` accepts the projects shape.
  - [ ] `freshLogin(page)` calls `page.goto('/login')`, fills email + password, submits, awaits redirect — verifiable via Playwright trace inspection on a single ad-hoc run.
- Integration tests:
  - [ ] `bunx playwright test --project=setup` produces a valid storageState JSON file (>0 bytes, contains a Better Auth session cookie).
  - [ ] A stub `bunx playwright test --project=chromium` run with `await page.goto('/admin')` does NOT redirect to `/login` (auth carried via storageState).
  - [ ] Opting out via `test.use({ storageState: { cookies: [], origins: [] } })` causes `/admin` to redirect to `/login` as expected.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% (fixtures + setup file).
- storageState produced once per suite; reused by all admin-session specs.
- `tests/e2e/.auth/` directory NEVER appears in `git status`.
