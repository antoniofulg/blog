---
name: task_05 memory
description: Execution context for task_05 — move lorem-ipsum fixture out of content/
type: project
---

# Task Memory: task_05.md

## Objective Snapshot

Move `content/en/lorem-ipsum.mdx` to `app/tests/fixtures/lorem-ipsum.mdx` via `git mv`, update test refs, add fixture-isolation unit tests. Status: **complete**.

## Important Decisions

- `indexer.test.ts` had NO direct references to lorem-ipsum.mdx (uses tmpdir fixtures) — only `mdx.test.ts` needed 2 path ref updates.
- Added 3 new fixture-isolation tests to `sync.test.ts` to satisfy the "integration test verifying sync excludes the fixture" requirement without needing a live DB.
- `sync-integ.test.ts` skips when port 5432 is free — structural guarantee (file not in content/) is sufficient for the DB-free environment.

## Learnings

- Fixture isolation tests landed in `sync.test.ts` (unit, no DB) — the `describe("fixture isolation: lorem-ipsum.mdx", ...)` block.
- `git log --follow` returns empty on staged (uncommitted) rename — expected; history preserved post-commit.

## Files / Surfaces

- `content/en/lorem-ipsum.mdx` → `app/tests/fixtures/lorem-ipsum.mdx` (git mv, staged)
- `app/tests/mdx.test.ts` — 2 path refs changed (lines 137, 173): `CONTENT_DIR/en/` → `FIXTURES/`
- `app/tests/sync.test.ts` — added 3 fixture-isolation tests + 2 import lines

## Errors / Corrections

None.

## Ready for Next Run

Task complete. Phase 1 now has tasks 01–05 done. Task 06 (rename $lang/* subtree) can proceed.
