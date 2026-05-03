---
status: completed
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

- [x] 6.1 Implement `startContentWatcher(contentDir: string)` with `fs.watch`, `.mdx` filter, and per-file debounce map
- [x] 6.2 Implement the stat-based creation/deletion distinction for `'rename'` events
- [x] 6.3 Add the 5-second startup warning if no events fire (indicates watcher may have failed silently)
- [x] 6.4 Add `app/lib/watcher.server.ts` to `vite-env-only` in `vite.config.ts` (was already configured in task_01)
- [x] 6.5 Integrate watcher startup into Vite plugin `configureServer` hook in `vite.config.ts` (apply: "serve"; guarded with `process.env.VITEST`)

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
  - [x] Non-`.mdx` files (e.g., `.txt`, `.ts`) do not trigger `upsertPost` or `removePost`
  - [x] Two rapid `'change'` events for the same file within 100ms result in exactly one `upsertPost` call
  - [x] A `'rename'` event for a file that exists on disk calls `upsertPost`
  - [x] A `'rename'` event for a file that no longer exists on disk calls `removePost`
  - [x] `startContentWatcher` logs the startup message on invocation
- Integration tests:
  - [x] Writing a new `.mdx` file calls `upsertPost` within 2s (mocked indexer; DB test requires `bun dev`)
  - [x] Editing an existing `.mdx` file calls `upsertPost` again within 2s
  - [x] Deleting an `.mdx` file calls `removePost` within 2s
  - [x] `app/lib/watcher.server.ts` is listed in `vite-env-only` denyImports (verified via config file check)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- New `.mdx` file appears in the `posts` table within 2 seconds of being saved in `content/`
- Watcher module is absent from the client bundle
