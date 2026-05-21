---
status: completed
title: Drop `isPublished` column (Drizzle migration + schema)
type: infra
complexity: medium
dependencies: []
feature: posts/publish-refactor
---

# Task 01: Drop `isPublished` column (Drizzle migration + schema)

## Overview
Remove the vestigial `isPublished` boolean column from the `posts` table. File presence under `app/content/posts/<locale>/` becomes the only post-visibility signal per PRD F1. The migration co-deploys with the code that removes the filters (task_02) under the CD pipeline's migrate-before-restart ordering, so no two-phase staging is needed.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST remove the `isPublished` field from the `posts` table definition in `app/db/schema.ts`.
- MUST generate a Drizzle migration via `bun run db:generate` that performs `ALTER TABLE posts DROP COLUMN is_published`.
- MUST commit the generated SQL file under `drizzle/` with the next sequential migration number.
- MUST NOT introduce a `draft` or analogous replacement column — file presence is the visibility gate per PRD F1.
- MUST be runnable against an existing development database via `bun run db:migrate` without manual SQL.
</requirements>

## Subtasks
- [ ] 01.1 Remove the `isPublished` column from the `posts` table in `app/db/schema.ts`.
- [ ] 01.2 Run `bun run db:generate` to produce the new migration file under `drizzle/`.
- [ ] 01.3 Inspect the generated SQL to confirm a single `DROP COLUMN is_published` statement (no unintended drops or renames).
- [ ] 01.4 Run `bun run db:migrate` against the local dev DB and verify the column is gone.
- [ ] 01.5 Update any inferred Drizzle types (e.g., `Post = typeof posts.$inferSelect`) consumers that reference the field — TypeScript compilation surfaces all of them.

## Implementation Details
See TechSpec "System Architecture → Component Overview" and "Data Models" sections for the post-migration shape of the `posts` table. The migration runtime is described in TechSpec "Integration Points" and `.agents/rules/cicd.md` (migrate-before-restart ordering). The drizzle-safe-migrations skill applies here because this is a destructive schema change.

### Relevant Files
- `app/db/schema.ts:21` — definition of `posts.isPublished` to remove.
- `drizzle/0002_puzzling_beyonder.sql` — example of an existing migration file format.
- `drizzle.config.ts` — Drizzle Kit configuration (no change required).
- `scripts/migrate.ts` — migration runner invoked by `bun run db:migrate`.
- `package.json` — `db:generate` and `db:migrate` script entries.

### Dependent Files
- `app/db/queries.ts`, `app/db/indexer.ts`, `app/lib/site-model.server.ts`, `app/routes/{-$locale}/$slug.server.ts` — all reference the column today (handled in task_02).
- `app/types/content.ts` and any other shape mirroring `Post` will see TypeScript errors after the column drops; resolved in task_02.

### Related ADRs
- [ADR-004: Rollout = single release for V1](adrs/adr-004.md) — single-deploy ordering makes a single-phase migration safe.
- [ADR-005: Unified `$slug` loader resolves posts + static pages](adrs/adr-005.md) — references the post resolution that depends on the migrated schema.

## Acceptance Criteria
1. AC-1: `app/db/schema.ts` no longer mentions `isPublished` and TypeScript compilation (`bun run check`) reports any downstream type errors for task_02 to resolve.
2. AC-2: A new file under `drizzle/` exists whose SQL body contains exactly `ALTER TABLE "posts" DROP COLUMN "is_published";` (modulo Drizzle's quoting conventions) and no other destructive statements.
3. AC-3: Running `bun run db:migrate` against a database that has the column succeeds, leaves the column gone, and no rows are lost.

## Deliverables
- Updated `app/db/schema.ts`.
- New `drizzle/000N_*.sql` migration file.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for migration round-trip **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Schema inference: `typeof posts.$inferSelect` no longer contains `isPublished` (Vitest assertion against `keyof Post`).
  - [x] Migration file present in `drizzle/` and parses as valid SQL via a small read+split check.
- Integration tests:
  - [x] End-to-end migration round-trip: seed a Postgres test database with the column present; run the migration via `scripts/migrate.ts`; assert the column is absent via `information_schema.columns`.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- `bun run check` and `bun run db:migrate` both succeed in a clean dev environment
- No `isPublished` reference remains in `app/db/schema.ts`
