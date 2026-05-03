---
status: completed
title: Content Indexer
type: backend
complexity: medium
dependencies:
  - task_03
---

# Task 5: Content Indexer

## Overview

Implement the content indexer (`app/db/indexer.ts`) that reads `.mdx` file frontmatter and upserts post metadata into the Postgres `posts` table. The indexer provides three operations: upsert a single file, remove a file from the index, and sync all files in the `content/` directory. This module is the core integration between the file system and the database — both the file watcher (task_06) and the manual sync script (task_07) depend on it.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST implement `upsertPost(filePath: string)` — reads frontmatter, derives slug, upserts into `posts` table; new posts default to `is_published = false`
- MUST implement `removePost(filePath: string)` — deletes the row matching `file_path`
- MUST implement `syncAll(contentDir: string)` — discovers all `.mdx` files, upserts each, removes orphaned rows whose `file_path` no longer exists on disk
- MUST use `file_path` (not slug) as the stable identifier for upsert conflict resolution (ADR-002)
- MUST derive `slug` from frontmatter `slug` field if present; fall back to filename without extension
- MUST NOT overwrite `is_published` on upsert — only update `title`, `description`, `published_at`, `slug`, and `indexed_at`
- MUST log a structured message for each upsert, removal, and error (see TechSpec "Monitoring" section)
- SHOULD parse frontmatter using the same `parseFrontmatter` utility from `app/lib/mdx.server.ts` (task_08) — or define a lightweight frontmatter-only parser here if task_08 is not yet available
</requirements>

## Subtasks

- [x] 5.1 Implement frontmatter parsing for `.mdx` files (title, description, publishedAt, slug fields)
- [x] 5.2 Implement `upsertPost(filePath)` using Drizzle's `onConflictDoUpdate` targeting `file_path`
- [x] 5.3 Implement `removePost(filePath)` deleting by `file_path`
- [x] 5.4 Implement `syncAll(contentDir)` — glob all `.mdx` files, upsert each, delete orphaned rows
- [x] 5.5 Add structured console logging for add, update, remove, and error events

## Implementation Details

See TechSpec "Core Interfaces" for the `upsertPost`, `removePost`, and `syncAll` function signatures. See "Data Models" for the `posts` table columns and which fields are updated on conflict vs. which are preserved (`is_published`, `view_count`).

The frontmatter parser can be a thin wrapper around `gray-matter` or a custom YAML front-matter extractor. If `app/lib/mdx.server.ts` (task_08) exports `parseFrontmatter`, reuse it; otherwise implement it locally in this file.

### Relevant Files

- `app/db/indexer.ts` — new file; all three exported functions
- `app/db/schema.ts` (task_03) — imports `posts`, `Post`, `NewPost`
- `app/db/client.ts` (task_03) — imports `db`
- `content/` — read-only; source of `.mdx` files to index

### Dependent Files

- `app/lib/watcher.server.ts` (task_06) — calls `upsertPost` and `removePost`
- `scripts/sync.ts` (task_07) — calls `syncAll`
- `app/routes/index.tsx` (task_09) — indirectly depends on indexed data being present

### Related ADRs

- [ADR-002: Content Model and Sync Strategy](adrs/adr-002.md) — `file_path` as stable identifier; `is_published` not overwritten on re-index

## Deliverables

- `app/db/indexer.ts` with `upsertPost`, `removePost`, `syncAll`
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests against a real Postgres instance **(REQUIRED)**

## Tests

- Unit tests:
  - [x] `upsertPost` with a fixture `.mdx` file calls `db.insert().onConflictDoUpdate()` with correct field mapping
  - [x] `upsertPost` derives slug from frontmatter `slug` field when present
  - [x] `upsertPost` falls back to filename (without `.mdx`) when frontmatter has no `slug` field
  - [x] `removePost` calls `db.delete().where(eq(posts.filePath, filePath))`
  - [x] `syncAll` globs all `.mdx` files and calls `upsertPost` for each
  - [x] `syncAll` deletes a row whose `file_path` no longer exists on disk
- Integration tests:
  - [x] `upsertPost('content/hello.mdx')` creates a row with `is_published = false` and correct `slug`
  - [x] Calling `upsertPost` twice for the same file updates `title` but does not reset `view_count` or `is_published`
  - [x] `removePost('content/hello.mdx')` removes the row; subsequent query returns 0 rows
  - [x] `syncAll` on a directory with 3 `.mdx` files produces 3 rows in `posts`
  - [x] `syncAll` after deleting a file removes the orphaned row
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `is_published` and `view_count` are never reset by a re-index operation
- `syncAll` removes orphaned rows after file deletion
