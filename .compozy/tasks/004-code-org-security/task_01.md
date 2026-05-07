---
status: pending
title: Types Directory & interface→type Migration
type: refactor
complexity: medium
dependencies: []
---

# Task 01: Types Directory & interface→type Migration

## Overview

Create `app/types/` as the canonical home for shared TypeScript types, moving `PostFrontmatter` and `AuthUser`/`RouterContext` out of lib and route files respectively. Remove the duplicate `interface PostFrontmatter` from `indexer.ts` and convert all remaining non-class `interface` declarations in `app/` to `type`. This task establishes the type foundation that tasks 03 and 04 depend on.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/types/content.ts` exporting `PostFrontmatter` as a `type` (not `interface`) with `publishedAt?: string` (ISO 8601) per ADR-003
- MUST create `app/types/auth.ts` exporting `AuthUser` and `RouterContext` as `type` declarations
- MUST remove `interface AuthUser` and `interface RouterContext` from `app/routes/__root.tsx` and replace with imports from `#/types/auth`
- MUST remove `interface PostFrontmatter` from `app/db/indexer.ts`; `parseFrontmatterBlock` MUST use an inlined return type `{ title: string; description?: string; publishedAt?: Date; slug?: string }` to preserve Date semantics for Drizzle (ADR-003)
- MUST convert `export interface TocItem` in `app/components/ui/table-of-contents.tsx` to `export type TocItem =`
- MUST NOT touch `interface Register` in `app/router.tsx` — TanStack Router module augmentation requires `interface`
- MUST pass `tsc --noEmit` with zero errors after all changes
- SHOULD update any import sites that reference the old type locations
</requirements>

## Subtasks

- [ ] 1.1 Create `app/types/` directory with `content.ts` exporting `PostFrontmatter` type
- [ ] 1.2 Create `app/types/auth.ts` exporting `AuthUser` and `RouterContext` types
- [ ] 1.3 Update `app/routes/__root.tsx` — remove type definitions, import from `#/types/auth`
- [ ] 1.4 Update `app/db/indexer.ts` — remove duplicate `interface PostFrontmatter`, inline return type on `parseFrontmatterBlock`
- [ ] 1.5 Convert `interface TocItem` to `type TocItem =` in `app/components/ui/table-of-contents.tsx`
- [ ] 1.6 Run `tsc --noEmit` and fix any import errors

## Implementation Details

See TechSpec sections "Core Interfaces" (`app/types/content.ts`, `app/types/auth.ts`) and "File-by-File Changes" for exact type shapes and which files to modify.

Key constraint from ADR-003: `PostFrontmatter` uses `publishedAt?: string` for display use. `indexer.ts` cannot import this shared type because its pipeline needs `publishedAt?: Date` for Drizzle — it must inline its own return type.

### Relevant Files

- `app/routes/__root.tsx` — currently defines `AuthUser` (lines 18-22) and `RouterContext` (lines 24-26); both must be removed and imported
- `app/db/indexer.ts` — contains duplicate `interface PostFrontmatter` (lines 8-13) with `publishedAt?: Date` — remove and inline on `parseFrontmatterBlock`
- `app/components/ui/table-of-contents.tsx` — `export interface TocItem` at line 1 — convert to `type`
- `app/router.tsx` — has `interface Register` (TanStack Router augmentation) — do NOT change

### Dependent Files

- `app/lib/mdx.server.ts` — currently exports `PostFrontmatter` as `interface`; task_03 moves and converts this
- `app/routes/admin/index.tsx` — imports from `__root.tsx` indirectly via router context; verify no breakage
- `app/tests/admin-routes.test.ts` — tests admin route fns; type changes must not break test compilation
- `app/tests/indexer.test.ts` — tests indexer; verify `parseFrontmatterBlock` return type inlining doesn't break expectations

### Related ADRs

- [ADR-003: PostFrontmatter canonical type uses `publishedAt?: string`; indexer retains inlined Date type](adrs/adr-003.md) — defines exactly what type shape goes in `content.ts` vs what indexer inlines

## Deliverables

- `app/types/content.ts` with `PostFrontmatter` type
- `app/types/auth.ts` with `AuthUser` and `RouterContext` types
- Updated `app/routes/__root.tsx` importing from `#/types/auth`
- Updated `app/db/indexer.ts` with inlined return type, no duplicate interface
- Updated `app/components/ui/table-of-contents.tsx` with `type TocItem =`
- `tsc --noEmit` exits 0 with all changes in place
- Existing tests pass with no modifications (REQUIRED)

## Tests

- Unit tests:
  - [ ] `tsc --noEmit` passes — catches all broken import paths and type mismatches from moves
  - [ ] `app/tests/indexer.test.ts` passes — `parseFrontmatterBlock` inlined return type must satisfy existing test expectations for `publishedAt` as `Date`
  - [ ] `app/tests/admin-routes.test.ts` passes — `AuthUser`/`RouterContext` move must not break test compilation
  - [ ] `app/tests/mdx.test.ts` passes — no `PostFrontmatter` regressions (mdx.server.ts still exports it; task_03 handles deletion)
- Integration tests:
  - [ ] `app/tests/auth-integ.test.ts` passes — `RouterContext` and `AuthUser` types used in auth flow must resolve correctly
  - [ ] `app/tests/indexer-integ.test.ts` passes — `indexer.ts` inlined return type must not break DB insert integration path
- Test coverage target: existing suite coverage maintained (no new code paths introduced)
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- Zero `interface` declarations in `app/types/`, `app/db/indexer.ts`, and `app/components/ui/table-of-contents.tsx`
- `app/types/` contains exactly `content.ts` and `auth.ts`
- `__root.tsx` imports `AuthUser` and `RouterContext` from `#/types/auth` (no local definitions)
- `interface Register` in `app/router.tsx` is untouched
