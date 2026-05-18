---
status: pending
title: PGLite test DB harness + admin seed + global setup/teardown
type: test
complexity: medium
dependencies:
  - task_01
feature: testing/pglite-harness
---

# Task 03: PGLite test DB harness + admin seed + global setup/teardown

## Overview

Build the ephemeral PGLite test database harness that Playwright's preview server connects to during e2e runs. One PGLite instance per suite (per ADR-004); Drizzle's PGLite adapter pushes both `app/db/schema.ts` and `app/db/auth-schema.ts`; Better Auth's `signUpEmail` seeds the e2e admin user using `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD`. Global teardown closes the instance.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST expose `createTestDb(): Promise<TestDb>` from `tests/e2e/db.ts` returning `{ db, client, connectionString, close }` per TechSpec.
- MUST programmatically push schema via Drizzle's PGLite-compatible push API (no `drizzle-kit` CLI invocation at runtime).
- MUST seed the e2e admin user via Better Auth's `auth.api.signUpEmail` against the PGLite instance (not via raw SQL inserts).
- MUST source admin credentials from `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` env vars; fall back to `e2e@test.local` / `e2e-test-password` locally; FAIL hard if either env var is unset on CI (`process.env.CI === 'true'`).
- MUST close PGLite cleanly in `global-teardown.ts`; no dangling handles after suite exit.
- MUST write the PGLite connection string to a process-wide channel (env var or temp file) that the Playwright `webServer` spawn can read.
- MUST NOT touch the production `app/db/client.ts` singleton.
</requirements>

## Subtasks

- [ ] 3.1 Create `tests/e2e/db.ts` exporting `createTestDb()` using `@electric-sql/pglite` + `drizzle-orm/pglite`.
- [ ] 3.2 Create `tests/e2e/seed.ts` exporting `seedAdminUser(db)` that uses Better Auth's API to create the e2e admin.
- [ ] 3.3 Create `tests/e2e/global-setup.ts` — orchestrates `createTestDb()` + `seedAdminUser()`, exposes connection string to subsequent test workers and the webServer process.
- [ ] 3.4 Create `tests/e2e/global-teardown.ts` — closes the PGLite client; idempotent.
- [ ] 3.5 Add Vitest integration tests under `app/tests/e2e-harness.test.ts` (Vitest, not Playwright) that exercise `createTestDb()` + `seedAdminUser()` in isolation.

## Implementation Details

See TechSpec "Build Order steps 5-9" and "Core Interfaces → tests/e2e/db.ts". The Better Auth instance used during seeding must be constructed against the PGLite-backed Drizzle client, NOT the production `app/lib/auth.ts` singleton; otherwise seeding hits the real DB.

### Relevant Files

- `app/db/schema.ts` — pushed to PGLite at setup time.
- `app/db/auth-schema.ts` — pushed alongside the main schema.
- `app/db/client.ts` — reference for the `drizzle()` factory call shape; do NOT import it from tests/e2e (production singleton).
- `app/lib/auth.ts` — reference for Better Auth construction; do NOT import the production instance.
- `scripts/seed.ts` — existing admin-seed pattern (uses `ADMIN_EMAIL` / `ADMIN_PASSWORD`); adapt the shape for e2e.
- `app/tests/auth-integ.test.ts` — reference for the lazy-import + port-free skip pattern; adapt for the harness test.
- `drizzle.config.ts` — schema paths consumed by the programmatic push API.

### Dependent Files

- `playwright.config.ts` (task_04) — references `global-setup.ts` and `global-teardown.ts`; uses the connection string from `global-setup` for the `webServer` env.
- `tests/e2e/auth.setup.ts` (task_04) — performs UI login against the seeded user.
- `tests/e2e/fixtures/auth.ts` (task_04) — references the seeded `userId` for assertions.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — PGLite + Better Auth seed pattern at the architecture level.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — locks per-suite singleton + workers=1.

## Acceptance Criteria

1. **AC-1**: `createTestDb()` returns a working `TestDb` whose `db` query against `posts` returns an empty array on a fresh instance.
2. **AC-2**: After `seedAdminUser(db)` runs, the `user` table contains exactly one row whose `email` matches `E2E_ADMIN_EMAIL` (or the local default).
3. **AC-3**: `await testDb.close()` releases the PGLite client; a second `close()` call is a no-op (no error).
4. **AC-4**: On CI (`process.env.CI === 'true'`) with missing `E2E_ADMIN_EMAIL` env var, `seedAdminUser()` throws with a clear "missing credential" error and the suite aborts in global-setup before any spec runs.
5. **AC-5**: The connection string from `createTestDb()` matches the `postgres://` shape expected by `postgres-js` so the Playwright `webServer` can use it unchanged.

## Deliverables

- New files: `tests/e2e/db.ts`, `tests/e2e/seed.ts`, `tests/e2e/global-setup.ts`, `tests/e2e/global-teardown.ts`.
- New file: `app/tests/e2e-harness.test.ts` (Vitest integration test for the harness in isolation).
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for end-to-end harness lifecycle **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] `createTestDb()` returns an object with all 4 properties (`db`, `client`, `connectionString`, `close`).
  - [ ] `createTestDb()` schema push includes `posts`, `user`, `session`, `account`, `verification` tables (queryable).
  - [ ] `seedAdminUser()` is idempotent — second call detects existing user and returns without error.
  - [ ] `seedAdminUser()` throws when credentials env vars are missing on CI; returns silently with defaults locally.
  - [ ] `close()` called twice does not throw.
- Integration tests:
  - [ ] Full lifecycle: `createTestDb()` → `seedAdminUser()` → query session via Better Auth API returns null (no session yet) → manual `auth.api.signInEmail` against PGLite succeeds → query session returns the seeded user.
  - [ ] `global-setup.ts` writes the connection string to the documented channel (env var or temp file path documented in TechSpec); `global-teardown.ts` cleans it up.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% across `tests/e2e/db.ts`, `seed.ts`, `global-setup.ts`, `global-teardown.ts`.
- Harness boots and tears down in <3 seconds combined.
- No leaked PGLite handles (verified by `process.exit(0)` clean exit in tests).
