---
status: completed
title: Remove `isPublished` filters across queries / routes / site-model / indexer
type: refactor
complexity: medium
dependencies:
    - task_01
feature: posts/publish-refactor
---

# Task 02: Remove `isPublished` filters across queries / routes / site-model / indexer

## Overview
Strip every visibility filter that depends on the dropped `isPublished` column so the codebase compiles after task_01's schema change. Rename helpers whose names referenced "published" (e.g., `getPublishedPostsFn` → `getAllPostsFn` or similar; `getLatestPublishedSlug` → `getLatestPostSlug`). Update all callers in the same change.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST remove every `eq(posts.isPublished, true)` filter from `app/db/queries.ts` and `app/routes/{-$locale}/$slug.server.ts`.
- MUST remove the hardcoded `isPublished: false` upsert and the intentional skip in `onConflictDoUpdate` from `app/db/indexer.ts`.
- MUST remove the `isPublished` filter from `getLatestPublishedSlug` in `app/lib/site-model.server.ts` and rename it to `getLatestPostSlug`; update all import sites.
- MUST rename `getPublishedPostsFn` to `getAllPostsFn` (or `listPostsFn`) in `app/db/queries.ts`; update all import sites.
- MUST strip the field from existing test fixtures in `app/tests/admin-routes.test.ts`, `app/tests/indexer.test.ts`, `app/tests/lang-slug-route.test.ts`, `app/tests/site-model.test.ts`.
- MUST leave the test suite green (`bun run test`) and `bun run check` clean after the change.
</requirements>

## Subtasks
- [x] 02.1 Strip filters in `app/db/queries.ts` and rename the now-misnamed function; update callers.
- [x] 02.2 Strip the three filters in `app/routes/{-$locale}/$slug.server.ts` (`:43`, `:60`, `:77`).
- [x] 02.3 Strip `isPublished` upsert + skip in `app/db/indexer.ts` (`:97`, `:117`).
- [x] 02.4 Update `app/lib/site-model.server.ts` — drop filter, rename `getLatestPublishedSlug` → `getLatestPostSlug`, update import sites.
- [x] 02.5 Strip `isPublished` from test fixtures across the four `app/tests/*.test.ts` files listed in requirements.

## Implementation Details
See TechSpec "Impact Analysis" table for every touched file. See PRD F1 for the user-visible semantics. The rename strategy is mechanical — TypeScript compiler errors surface every caller after the rename.

### Relevant Files
- `app/db/queries.ts:12` — `getPublishedPostsFn` with the filter.
- `app/routes/{-$locale}/$slug.server.ts:43,60,77` — three lookup paths with the filter.
- `app/db/indexer.ts:97,117` — upsert and conflict-update sites.
- `app/lib/site-model.server.ts:114` — `getLatestPublishedSlug`.
- `app/tests/admin-routes.test.ts:79-90,128-129,165,175,184`, `app/tests/indexer.test.ts:80`, `app/tests/lang-slug-route.test.ts:79,331+`, `app/tests/site-model.test.ts:348,396,406,412,415,419`.

### Dependent Files
- All call sites of the renamed `getLatestPostSlug` / `getAllPostsFn` — TypeScript surfaces them on rename.
- `app/types/content.ts` — any inferred `Post` shape stops carrying `isPublished` automatically once task_01 lands.

### Related ADRs
- [ADR-004: Rollout = single release for V1](adrs/adr-004.md) — both this task and task_01 co-deploy.

## Acceptance Criteria
1. AC-1: `grep -r "isPublished" app/` returns zero matches across source and test files (excluding generated migration history).
2. AC-2: `bun run check` (tsc --noEmit) passes; `bun run test` passes on the modified fixtures.
3. AC-3: `getLatestPublishedSlug` and `getPublishedPostsFn` no longer exist as exported names; their replacements exist with the same call signatures (returning the same shapes).

## Deliverables
- Modified files listed in Relevant Files.
- Updated test fixtures in the four `app/tests/*.test.ts` files.
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for renamed query + route fall-through **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] `getAllPostsFn` returns every post in the seeded DB (no filtering by visibility), assertion on row count.
  - [ ] `getLatestPostSlug` returns the most recent post regardless of any prior "published" semantics.
  - [ ] `app/db/indexer.ts` upsert no longer mentions `isPublished` — assert via a key-set check on the upsert payload shape (Vitest mock spy on Drizzle insert).
- Integration tests:
  - [ ] Route `/{-$locale}/$slug` resolves a post regardless of prior visibility state — request a post seeded with no `isPublished` field (because the column is gone) and assert 200 + correct rendered title.
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- No `isPublished` reference remains in `app/` (verified by grep)
- Renamed functions and updated callers compile cleanly
