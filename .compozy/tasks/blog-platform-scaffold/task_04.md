---
status: completed
title: Admin Seed Script
type: backend
complexity: low
dependencies:
  - task_03
---

# Task 4: Admin Seed Script

## Overview

Create an idempotent seed script (`scripts/seed.ts`) that inserts the initial admin user into the Better Auth user table using credentials from environment variables. The script must be safe to run multiple times — if the admin user already exists, it exits cleanly without error. This script runs as part of the Docker Compose startup sequence (after migrations) so the admin account is available immediately on a clean clone.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST read `ADMIN_EMAIL` and `ADMIN_PASSWORD` from environment variables (no hardcoded credentials)
- MUST check for an existing user with `ADMIN_EMAIL` before inserting — idempotent on repeat runs
- MUST hash the password using Better Auth's password hashing function (not a custom implementation)
- MUST exit 0 on success and exit 1 with a descriptive error message on failure
- MUST be added as a `db:seed` script in `package.json`
- SHOULD log a confirmation message when the admin user is created, and a skip message when the user already exists
- MUST NOT insert into the `posts` table — this script is only for the admin user
</requirements>

## Subtasks

- [x] 4.1 Create `scripts/seed.ts` that reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `process.env`
- [x] 4.2 Query the Better Auth `user` table to check for an existing admin account; skip if found
- [x] 4.3 Hash `ADMIN_PASSWORD` using Better Auth's built-in password hasher and insert the admin user
- [x] 4.4 Add `db:seed` script to `package.json` that runs `bun run scripts/seed.ts`
- [x] 4.5 Verify running `bun run db:seed` twice produces one user row, not two

## Implementation Details

See TechSpec "Integration Points" (Better Auth) and "Development Sequencing" (step 4) for the seed script's role in the startup sequence. The Better Auth Drizzle adapter creates the `user`, `session`, and `account` tables during migration — this task inserts a row into `user` only.

### Relevant Files

- `scripts/seed.ts` — new file; admin user creation logic
- `package.json` — modified; add `db:seed` script
- `app/db/client.ts` (task_03) — imported by seed script for DB access
- `app/lib/auth.ts` (task_10) — defines the Better Auth schema; seed script must target the correct table/column names

### Dependent Files

- `app/lib/auth.ts` (task_10) — Better Auth session reads rely on the seeded admin user existing
- `docker-compose.yml` (task_02) — startup sequence comment references `bun run db:seed`

### Related ADRs

- [ADR-001: Scaffold Scope — Full Starter Kit](adrs/adr-001.md) — admin seed must be part of startup sequence for the 60-second DX promise

## Deliverables

- `scripts/seed.ts` — idempotent admin user creation
- `db:seed` npm script
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for idempotency **(REQUIRED)**

## Tests

- Unit tests:
  - [x] Seed script reads `ADMIN_EMAIL` and `ADMIN_PASSWORD` from env — mock env vars and assert values are read
  - [x] Seed script exits 1 when `ADMIN_EMAIL` is not set
  - [x] Seed script exits 1 when `ADMIN_PASSWORD` is not set
- Integration tests (skipIf no DB at port 5432):
  - [x] `bun run db:seed` with valid env vars creates exactly one user row in the `user` table
  - [x] Running `bun run db:seed` a second time does not insert a duplicate user (row count stays at 1)
  - [x] Seeded user's `email` matches `ADMIN_EMAIL` env var
  - [x] Seeded user's `password` field is a hashed value, not the plaintext `ADMIN_PASSWORD`
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `bun run db:seed` is idempotent — safe to run multiple times
- Admin user is present in the database after one successful run
