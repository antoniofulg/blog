---
status: completed
title: DB Schema & Migration
type: backend
complexity: medium
dependencies: []
---

# Task 01: DB Schema & Migration

## Overview

Add five new columns to the `posts` table (`lang`, `category`, `series`, `seriesPart`, `draft`), replace the standalone `slug UNIQUE` constraint with a composite `UNIQUE(slug, lang)`, and generate and apply the Drizzle migration. This is the foundational change that enables bilingual content storage. All subsequent tasks depend on this schema being in place.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `lang text NOT NULL DEFAULT 'en'` column to `posts` table
- MUST add `category text` (nullable) column
- MUST add `series text` (nullable) column
- MUST add `series_part integer` (nullable) column (Drizzle field name: `seriesPart`)
- MUST add `draft boolean` (nullable) column
- MUST remove the standalone `UNIQUE` constraint on `slug`
- MUST add a composite `UNIQUE(slug, lang)` constraint
- MUST generate migration with `bun run db:generate`
- MUST apply migration with `bun run db:migrate` (or `make db-migrate`)
- MUST verify all 3 existing posts receive `lang = 'en'` via column DEFAULT after migration
- MUST NOT break any existing Drizzle inferred types (`Post`, `NewPost`)
</requirements>

## Subtasks

- [x] 1.1 Update `app/db/schema.ts` — add 5 new columns and replace slug uniqueness constraint per TechSpec "Data Models" section
- [x] 1.2 Run `bun run db:generate` to generate the new migration SQL file in `drizzle/`
- [x] 1.3 Review the generated SQL to confirm: ALTER TABLE adds 5 columns, drops old unique on slug, adds composite unique
- [x] 1.4 Run `bun run db:migrate` to apply the migration to the database
- [x] 1.5 Verify with a DB query that existing posts have `lang = 'en'` and the new nullable columns are NULL

## Implementation Details

See TechSpec "Data Models → Updated `posts` table" and "Data Models → Drizzle schema additions" for exact column types and the composite unique syntax. The Drizzle composite unique is declared in the table-level config (second argument to `pgTable`), not on the column itself.

The `filePath` UNIQUE constraint is unchanged — it remains the upsert conflict target in `indexer.ts`.

### Relevant Files

- `app/db/schema.ts` — the only source file to modify; currently defines `posts` table with standalone `slug UNIQUE`
- `drizzle.config.ts` — points to `app/db/schema.ts` as the schema source; no change needed
- `drizzle/0000_chief_mauler.sql` — reference: existing migration pattern for posts table
- `drizzle/0001_daily_sasquatch.sql` — reference: existing migration pattern for auth tables

### Dependent Files

- `app/db/indexer.ts` — `upsertPost` will need updating in task_03 to write the new `lang` column
- `app/db/queries.ts` — `getPublishedPostsFn` will need `lang` param in task_03
- `app/db/client.ts` — imports schema; `Post` and `NewPost` inferred types will automatically include new columns

### Related ADRs

- [ADR-001: V1 scope — conventions + DB schema, no UI filtering](adrs/adr-001.md) — establishes why the DB schema is the foundational V1 deliverable
- [ADR-003: Expand V1 scope to include locale routing and language switcher](adrs/adr-003.md) — the composite `(slug, lang)` unique is the enabling constraint for bilingual content

## Deliverables

- Updated `app/db/schema.ts` with all 5 new columns and composite unique constraint
- New Drizzle migration file in `drizzle/` with the correct ALTER TABLE statements
- Migration successfully applied; existing 3 posts have `lang = 'en'`
- `tsc --noEmit` (`make check`) exits 0 — no type regressions
- Existing test suite passes (`make test`) — migration does not break any existing tests

## Tests

- Unit tests:
  - [ ] `tsc --noEmit` passes — `Post` and `NewPost` inferred types include `lang`, `category`, `series`, `seriesPart`, `draft`
  - [ ] `make test` passes — all existing tests continue to pass after schema change (indexer and query mocks don't reference the new columns yet, so no mock updates needed here)
- Integration tests:
  - [ ] After `bun run db:migrate`, `SELECT lang FROM posts` returns `'en'` for all 3 existing rows
  - [ ] `SELECT slug, lang FROM posts` shows no duplicate `(slug, lang)` pairs
  - [ ] Attempting to insert a duplicate `(slug='lorem-ipsum', lang='en')` returns a unique constraint violation
- Test coverage target: existing suite coverage maintained; new columns verified via DB query
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- Migration file exists in `drizzle/` alongside `0000_` and `0001_`
- `posts` table has 15 columns (10 existing + 5 new)
- `slug UNIQUE` constraint removed; `UNIQUE(slug, lang)` active
- Existing 3 posts have `lang = 'en'` (verified via DB query)
