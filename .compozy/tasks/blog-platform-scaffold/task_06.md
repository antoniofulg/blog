---
status: pending
title: File Watcher
type: backend
complexity: medium
dependencies:
  - task_05
---

# Task 6: File Watcher

## Overview

Implement the `startContentWatcher` function in `app/lib/watcher.server.ts` that uses Bun's native `fs.watch` to monitor the `content/` directory and trigger the content indexer on file changes. A 100ms debounce prevents duplicate upserts on rapid saves. The watcher must be integrated with the TanStack Start / Vinxi app startup so it runs automatically when `bun dev` starts — no manual invocation required.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST use Bun's native `fs.watch` from `node:fs` with `{ recursive: true }` (ADR-004)
- MUST handle both `'rename'` events (file created or deleted) and `'change'` events (file modified)
- MUST stat the file path to distinguish creation from deletion on `'rename'` events; call `upsertPost` on creation, `removePost` on deletion
- MUST apply a 100ms debounce per file path to prevent duplicate index operations on rapid saves (ADR-004)
- MUST filter events to `.mdx` files only — ignore all other file extensions
- MUST log a startup message when the watcher begins and a warning if no events fire within 5 seconds of startup
- MUST register `app/lib/watcher.server.ts` in `vite-env-only` to prevent client-side bundling
- MUST integrate with TanStack Start / Vinxi app lifecycle so `startContentWatcher()` is called automatically on server start
</requirements>

## Subtasks

- [ ] 6.1 Implement `startContentWatcher(contentDir: string)` with `fs.watch`, `.mdx` filter, and per-file debounce map
- [ ] 6.2 Implement the stat-based creation/deletion distinction for `'rename'` events
- [ ] 6.3 Add the 5-second startup warning if no events fire (indicates watcher may have failed silently)
- [ ] 6.4 Add `app/lib/watcher.server.ts` to `vite-env-only` in `app.config.ts`
- [ ] 6.5 Integrate watcher startup into the Vinxi/TanStack Start server entry point — validate that `startContentWatcher()` is called once on `bun dev` start and not during client-side rendering

## Implementation Details

See TechSpec "Implementation Notes" in ADR-004 for the exact debounce implementation pattern. See TechSpec "Technical Dependencies" for the note about validating Vinxi startup integration — this is the highest-risk subtask and should be prototyped first.

The watcher startup integration point may be a Vinxi plugin in `app.config.ts`, a server middleware, or a module-level side effect in a server-only import. The correct mechanism must be confirmed during implementation and documented in a code comment.

### Relevant Files

- `app/lib/watcher.server.ts` — new file; `startContentWatcher` export
- `app.config.ts` (task_01) — modified; add `watcher.server.ts` to `vite-env-only`, add Vinxi plugin or hook for watcher startup
- `app/db/indexer.ts` (task_05) — called by the watcher on file events

### Dependent Files

- No subsequent tasks depend directly on the watcher module, but tasks_09 and task_11 depend on the watcher producing correct DB state during development

### Related ADRs

- [ADR-002: Content Model and Sync Strategy](adrs/adr-002.md) — watcher triggers indexer; new files indexed as drafts
- [ADR-004: File Watcher — Bun Native fs.watch](adrs/adr-004.md) — chosen watcher, debounce strategy, known limitations

## Deliverables

- `app/lib/watcher.server.ts` with `startContentWatcher`
- Updated `app.config.ts` with `vite-env-only` registration and startup integration
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration tests for file event handling **(REQUIRED)**

## Tests

- Unit tests:
  - [ ] Non-`.mdx` files (e.g., `.txt`, `.ts`) do not trigger `upsertPost` or `removePost`
  - [ ] Two rapid `'change'` events for the same file within 100ms result in exactly one `upsertPost` call
  - [ ] A `'rename'` event for a file that exists on disk calls `upsertPost`
  - [ ] A `'rename'` event for a file that no longer exists on disk calls `removePost`
  - [ ] `startContentWatcher` logs the startup message on invocation
- Integration tests:
  - [ ] After `bun dev` starts, dropping a new `.mdx` file into `content/` results in a new row in `posts` within 2 seconds
  - [ ] Editing an existing `.mdx` file updates the `title` in `posts` within 2 seconds
  - [ ] Deleting an `.mdx` file removes its row from `posts` within 2 seconds
  - [ ] `app/lib/watcher.server.ts` is not present in the client JavaScript bundle (inspect bundle output)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- New `.mdx` file appears in the `posts` table within 2 seconds of being saved in `content/`
- Watcher module is absent from the client bundle
