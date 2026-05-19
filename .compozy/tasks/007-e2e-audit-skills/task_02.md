---
status: completed
title: Site-model module + vite stub + drift test
type: backend
complexity: medium
dependencies:
    - task_01
feature: testing/site-model
---

# Task 02: Site-model module + vite stub + drift test

## Overview

Create the single shared producer of route + post knowledge that both `e2e-coverage` and `content-audit` consume. Add it to the `serverOnlyStubPlugin` list in `vite.config.ts` so the client bundle never imports server-only filesystem APIs, and add a Vitest drift test that fails CI if a route file is added without a matching inventory entry.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST export `RouteEntry`, `RouteAuthLevel`, and `PostEntry` types matching the shapes defined in TechSpec "Core Interfaces".
- MUST export async functions `getRouteInventory(): Promise<RouteEntry[]>` and `getPostInventory(): Promise<PostEntry[]>`.
- MUST declare a static `ROUTE_METADATA` const that maps every file under `app/routes/**/*.tsx` (excluding `__root.tsx` and `routeTree.gen.ts`) to its `auth`, `expectedStatus`, and `intent` values.
- MUST add `#/lib/site-model.server` to `vite.config.ts:serverOnlyStubPlugin`'s id list.
- MUST add a Vitest drift test that walks `app/routes/**/*.tsx` and asserts every file appears in `ROUTE_METADATA`; it MUST fail if a new route file is added without an inventory entry.
- SHOULD allow opt-out exclusion entries (e.g. `expectedStatus: null`) for documented exceptions.
- MUST NOT import any server-only modules from client code; the file must only ever be referenced from server fns, scripts, or tests.
</requirements>

## Subtasks

- [x] 2.1 Create `app/lib/site-model.server.ts` with types, `ROUTE_METADATA` map, `getRouteInventory()`, and `getPostInventory()`.
- [x] 2.2 Add `#/lib/site-model.server` (and any unprefixed variant required by the existing stub plugin) to `vite.config.ts:serverOnlyStubPlugin` server-only ID list.
- [x] 2.3 Create `app/tests/site-model.test.ts` with drift assertion (walk vs. `ROUTE_METADATA`) plus tests for the `hasTwin` cross-reference logic in `getPostInventory()`.
- [x] 2.4 Update `app/types/content.ts` (or create a new types module) if `PostFrontmatter` needs to be re-exported for site-model consumers.

## Implementation Details

See TechSpec sections "Core Interfaces", "System Architecture → Component Overview", and "Build Order steps 2-4". The module re-uses `Locale` from `app/lib/locale.tsx` and `PostFrontmatter` from `app/types/content.ts` (or the indexer's existing parser output).

### Relevant Files

- `app/routes/**/*.tsx` — the inventory source; current shape is `__root.tsx`, `login.tsx`, `robots[.]txt.ts`, `{-$locale}.tsx`, `{-$locale}/{index,$slug,about}.tsx`, `admin/{index,preview.$slug}.tsx`, `api/auth/$.ts`.
- `app/lib/locale.tsx` — `Locale` type and `LOCALES` const consumed by route + post inventory entries.
- `app/db/schema.ts` — `posts` table whose `isPublished` flag feeds `PostEntry.isPublished`.
- `app/lib/mdx/parser.server.ts` — existing `parseFrontmatter()` returning the subset frontmatter; `getPostInventory()` may need to use `indexer.ts`'s `parseFrontmatterBlock()` for the superset (category, series, seriesPart, draft).
- `app/db/indexer.ts` — `parseFrontmatterBlock()` superset frontmatter parser to mirror for inventory.
- `vite.config.ts:serverOnlyStubPlugin` — existing client-bundle stub list at the end of the file; new id must be appended.

### Dependent Files

- `app/tests/site-model.test.ts` — the new drift test exercising the module.
- `tests/e2e/global-setup.ts` (task_03) — consumes `getRouteInventory()` indirectly via fixture metadata.
- `app/lib/content-audit/checks.server.ts` (task_12) — consumes `getPostInventory()` for translation-gap and series-gap checks.
- All Playwright specs (tasks_05/09/10) — consume `getRouteInventory()` when targeting routes by intent.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — establishes the shared-producer pattern.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — decides TypeScript runtime walker over generated JSON manifest; lists static-map opt-out semantics for documented exclusions.

## Acceptance Criteria

1. **AC-1**: `app/lib/site-model.server.ts` exports `RouteEntry`, `RouteAuthLevel`, `PostEntry`, `getRouteInventory`, and `getPostInventory` with TypeScript signatures matching TechSpec "Core Interfaces".
2. **AC-2**: `ROUTE_METADATA` contains an entry for every current route file (verified by drift test).
3. **AC-3**: Adding a fake route fixture in the drift test triggers a test failure with a clear "route X has no inventory entry" message.
4. **AC-4**: Building the client bundle (`bun run build`) succeeds and `dist/client/**/*.js` does NOT contain any string matching `getRouteInventory`, `getPostInventory`, or `ROUTE_METADATA` (server-only stub working).
5. **AC-5**: `getPostInventory()` correctly sets `hasTwin: true` for posts where both en + pt-br variants exist and `hasTwin: false` otherwise, verified against fixture posts in the test.

## Deliverables

- New file `app/lib/site-model.server.ts`.
- Modified `vite.config.ts` (one-line addition to the stub plugin list).
- New file `app/tests/site-model.test.ts`.
- Optionally modified `app/types/content.ts` if frontmatter type re-export is needed.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for site-model + posts table cross-reference **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] `getRouteInventory()` returns one `RouteEntry` for every file in `ROUTE_METADATA`; total count matches `app/routes/**/*.tsx` excluding `__root.tsx` and `routeTree.gen.ts`.
  - [ ] `getRouteInventory()` filters out files with `expectedStatus: null` (opt-out entries).
  - [ ] `getPostInventory()` returns one `PostEntry` per `.mdx` file under `app/content/posts/**`, with `lang` derived from the locale directory and `slug` derived from the filename.
  - [ ] `getPostInventory()` sets `hasTwin: true` only when the counterpart locale file exists.
  - [ ] Drift test: synthetic addition of `app/routes/fake-route.tsx` (via fixture monkey-patch of `fs.readdir`) causes the drift assertion to fail with a route-name in the message.
  - [ ] Drift test: removing all routes still passes (vacuous drift); inventory length equals 0.
- Integration tests:
  - [ ] `getPostInventory()` reads real `app/content/posts/**` and merges with the live `posts` table — `isPublished` reflects DB state.
  - [ ] Client bundle build (`bun run build`) succeeds with the site-model module present.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `app/lib/site-model.server.ts`.
- Drift test catches a deliberately-added route in PR-internal sanity check.
- Client bundle does not embed any site-model strings (stub plugin verified).
