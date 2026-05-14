---
status: completed
title: Stabilize post indexing pipeline (F9)
type: infra
complexity: medium
dependencies: []
---

# Task 01: Stabilize post indexing pipeline (F9)

## Overview
Fix the gap where `bun run dev` and CD deploys leave the `posts` table empty even when `content/*.mdx` files exist on disk. Insert a `[sync]` step in the existing `content-watcher-dev` Vite plugin between `[seed]` and the watcher spawn, and a `bun run sync` step in `scripts/deploy.sh` after `bun run db:migrate`. Result: admin dashboard reflects on-disk content with no manual intervention.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- The `content-watcher-dev` plugin in `vite.config.ts` MUST call `syncAll('./content')` after migrate and seed steps and before the watcher subprocess spawns.
- The sync step MUST emit a distinct `[sync]` log prefix consistent with the existing `[migrate]` and `[seed]` log style.
- `scripts/deploy.sh` MUST run `bun run sync` via `docker run` against the pulled runner image after `bun run db:migrate` and before `docker compose up -d --no-deps app`.
- Sync failure during deploy MUST exit non-zero so the workflow blocks; failure during dev boot MUST log a clear error and re-throw.
- Tests MUST cover the plugin sync invocation order and error propagation.
</requirements>

## Subtasks
- [x] 1.1 Add `[sync]` labeled step to `content-watcher-dev` plugin in `vite.config.ts`
- [x] 1.2 Insert `bun run sync` `docker run` invocation in `scripts/deploy.sh` after migrate, before compose-up
- [x] 1.3 Run smoke pass of `bun run sync` against current `content/` to confirm clean state
- [x] 1.4 Add unit test asserting plugin invokes syncAll between seed and watcher start
- [x] 1.5 Verify `bun run dev` populates `posts` rows for existing fixtures

## Implementation Details
See TechSpec sections "System Architecture → Component Overview" (indexer stabilization entry) and "Development Sequencing → Build Order" step 1. See also the Monitoring section for the `sync_started` / `sync_completed` / `sync_failed` log event shapes.

### Relevant Files
- `vite.config.ts` — hosts the `content-watcher-dev` plugin
- `app/db/indexer.ts` — exports `syncAll(contentDir)`
- `scripts/sync.ts` — wraps `syncAll` for CLI use via `import.meta.main`
- `scripts/deploy.sh` — orchestrates the VPS deploy

### Dependent Files
- `app/routes/admin/index.tsx` — admin dashboard whose empty state surfaced this bug; verification target
- `.github/workflows/cd.yml` — invokes `scripts/deploy.sh`; no direct edit but its observable behavior changes

### Related ADRs
- [ADR-003: Fold Post Indexing Stabilization into V1 Phase 1](adrs/adr-003.md) — defines the F9 scope and rationale
- [ADR-002: 3-Phase Rollout for Site Restructure V1](adrs/adr-002.md) — places F9 in Phase 1

## Deliverables
- Updated `vite.config.ts` with `[sync]` plugin step
- Updated `scripts/deploy.sh` with sync step before compose-up
- Unit tests for plugin sync invocation
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration test verifying `posts` table populated after `bun run dev` boot **(REQUIRED)**

## Tests
- Unit tests:
  - [x] Plugin calls `syncAll` exactly once during the dev startup hook
  - [x] Plugin sync invocation happens AFTER migrate + seed (order asserted via call sequence)
  - [x] Plugin sync invocation happens BEFORE watcher subprocess spawn
  - [x] Plugin re-throws when `syncAll` throws (does not silently swallow)
  - [x] Plugin logs structured `[sync]`-prefixed message on start and completion
- Integration tests:
  - [x] Boot dev plugin against a fresh test DB + fixture content dir → `posts` table contains rows matching the fixture files (skipped when port 5432 free — pre-existing constraint)
  - [x] Run `bun run sync` against a directory with one malformed `.mdx` → process exits non-zero with descriptive error
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- `bun run dev` populates `posts` table from `content/` without manual `bun run sync`
- After CD deploy, `/admin/` admin dashboard lists every `.mdx` in deployed `content/`
- Failing sync step in deploy blocks the workflow (no silent partial deploy)
