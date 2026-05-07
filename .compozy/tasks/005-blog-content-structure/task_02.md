---
status: completed
title: Content Folder Restructure
type: chore
complexity: low
dependencies:
  - task_01
---

# Task 02: Content Folder Restructure

## Overview

Move the 3 existing MDX files from the flat `content/` directory into `content/en/` and create a `content/pt-br/.gitkeep` placeholder. This is a file-system-only operation with no code changes. After this task the content directory matches the locale-based structure the indexer expects in task_03.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST move `content/lorem-ipsum.mdx` → `content/en/lorem-ipsum.mdx`
- MUST move `content/component-composition-react.mdx` → `content/en/component-composition-react.mdx`
- MUST move `content/react-suspense-typescript.mdx` → `content/en/react-suspense-typescript.mdx`
- MUST create `content/pt-br/` directory with a `.gitkeep` placeholder file
- MUST NOT modify the content of any MDX file during the move
- MUST NOT leave any `.mdx` files in the flat `content/` root (only the `en/` and `pt-br/` subdirectories)
- SHOULD use `git mv` to preserve git history for each file
</requirements>

## Subtasks

- [x] 2.1 Create `content/en/` directory
- [x] 2.2 Move all 3 MDX files to `content/en/` using `git mv` (preserves history)
- [x] 2.3 Create `content/pt-br/` directory with `.gitkeep`
- [x] 2.4 Verify `content/` root contains only `en/` and `pt-br/` subdirectories

## Implementation Details

The watcher script (`scripts/watcher.ts`) passes `join(process.cwd(), "content")` to `startContentWatcher`. The watcher uses `fs.watch(contentDir, { recursive: true })` which already picks up subdirectories — no code change needed.

The indexer's `syncAll` uses `like(posts.filePath, '${contentDir}/%')` for cleanup. Calling it with `content/` as root covers both locale subdirectories.

After this move, the `filePath` values in the DB become stale (still pointing to `content/lorem-ipsum.mdx`). Task_03 handles the re-index that updates them.

### Relevant Files

- `content/lorem-ipsum.mdx` — move to `content/en/lorem-ipsum.mdx`
- `content/component-composition-react.mdx` — move to `content/en/component-composition-react.mdx`
- `content/react-suspense-typescript.mdx` — move to `content/en/react-suspense-typescript.mdx`
- `scripts/watcher.ts` — no change; already watches `content/` parent recursively

### Dependent Files

- `app/db/indexer.ts` — task_03 updates `upsertPost` to derive `lang` from the new path prefix; task_03 also triggers a re-index to update stale `filePath` values in DB
- `app/tests/mdx.test.ts` — task_10 updates the frontmatter lint scan path from `content/` to `content/en/**`

### Related ADRs

- [ADR-002: Atomic single-PR delivery strategy](adrs/adr-002.md) — this file move and the DB migration (task_01) must land in the same PR to avoid an interim broken state

## Deliverables

- `content/en/` directory with 3 MDX files (contents unchanged)
- `content/pt-br/` directory with `.gitkeep`
- Empty `content/` root (no `.mdx` files at top level)
- `make test` exits 0 — existing tests not broken by file move

## Tests

- Unit tests:
  - [x] `make test` passes — no tests reference `content/` paths directly (watcher tests use fixture paths); file move does not break any existing test
- Integration tests:
  - [x] `ls content/en/` shows all 3 MDX files
  - [x] `ls content/pt-br/` shows `.gitkeep`
  - [x] `ls content/*.mdx` returns empty (no MDX files in flat root)
- Test coverage target: N/A — file system operation; verified by directory listing
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `content/en/` contains exactly 3 MDX files with identical content to their originals
- `content/pt-br/` exists with `.gitkeep`
- No `.mdx` files in `content/` root
- Git history preserved for each moved file (`git log --follow content/en/lorem-ipsum.mdx` shows original commits)
