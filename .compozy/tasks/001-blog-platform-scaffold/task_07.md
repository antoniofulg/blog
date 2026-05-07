---
status: completed
title: Manual Sync Script
type: backend
complexity: low
dependencies:
  - task_05
---

# Task 7: Manual Sync Script

## Overview

Create `scripts/sync.ts`, a CLI wrapper around the indexer's `syncAll` function that provides a manual fallback for syncing the `content/` directory into Postgres. This script is the safety net when `fs.watch` is unavailable (CI environments, restricted file descriptor limits, or Windows). It runs once, indexes all `.mdx` files, removes orphaned rows, and exits — no persistent watcher.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST call `syncAll(contentDir)` from `app/db/indexer.ts` with the `content/` directory path
- MUST exit 0 on success and exit 1 with a descriptive error message on failure
- MUST be added as a `sync` script in `package.json` (`bun run sync`)
- MUST close the database connection after `syncAll` completes to allow the process to exit cleanly
- SHOULD accept an optional `--dir` CLI argument to override the default `content/` path (useful for testing)
- SHOULD log a summary: total files synced, total orphans removed
</requirements>

## Subtasks

- [x] 7.1 Create `scripts/sync.ts` that imports `syncAll` from `app/db/indexer.ts` and runs it against `content/`
- [x] 7.2 Add proper process exit handling: exit 0 on success, exit 1 on error with message to stderr
- [x] 7.3 Close the Drizzle/postgres.js connection after sync completes
- [x] 7.4 Add `sync` script to `package.json`
- [x] 7.5 Verify `bun run sync` on a clean clone with sample content produces correct `posts` rows

## Implementation Details

See TechSpec "Technical Dependencies" and ADR-004 for the documented role of this script as the `fs.watch` fallback. The script is intentionally thin — all logic lives in `syncAll`.

### Relevant Files

- `scripts/sync.ts` — new file; CLI entry point
- `app/db/indexer.ts` (task_05) — `syncAll` function called here
- `app/db/client.ts` (task_03) — connection that must be closed after sync
- `package.json` — modified; add `sync` script

### Dependent Files

- No other tasks depend directly on this script; it is a standalone operational tool

### Related ADRs

- [ADR-004: File Watcher — Bun Native fs.watch](adrs/adr-004.md) — this script is the documented fallback when `fs.watch` is unavailable

## Deliverables

- `scripts/sync.ts` — manual sync CLI
- `sync` npm script
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for sync behavior **(REQUIRED)**

## Tests

- Unit tests:
  - [x] Script calls `syncAll` with the correct `content/` path when no `--dir` argument is given
  - [x] Script calls `syncAll` with the override path when `--dir ./other` argument is given
  - [x] Script exits 1 and logs to stderr when `syncAll` throws an error
- Integration tests:
  - [x] `bun run sync` on a directory with 2 `.mdx` files creates 2 rows in `posts`
  - [x] `bun run sync` is idempotent — running twice on the same content produces the same 2 rows
  - [x] `bun run sync` after deleting one file leaves 1 row (orphan removed)
  - [x] Process exits cleanly (no hanging connection) after sync completes
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `bun run sync` exits 0 on success and the process terminates cleanly
- `bun run sync` is safe to run multiple times without side effects
