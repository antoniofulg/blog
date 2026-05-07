---
status: pending
title: Shared Session Utility
type: refactor
complexity: low
dependencies: []
---

# Task 02: Shared Session Utility

## Overview

Create `app/lib/session.ts` with a single exported `requireSession()` function, extracting the duplicated inline session guard from admin route files. This file becomes the canonical auth enforcement point for all current and future server function handlers. No callers are updated in this task — admin route extraction (task_04) consumes it.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `app/lib/session.ts` exporting `requireSession(): Promise<void>`
- MUST implement the throw-only pattern per ADR-004: throw `new Response("Unauthorized", { status: 401 })` when no session; return `void` otherwise
- MUST import `auth` from `#/lib/auth` and `getRequest` from `@tanstack/react-start/server`
- MUST NOT return `AuthUser` or any session data — throw-only per ADR-004
- MUST NOT update callers in this task (caller updates are task_04's responsibility)
- MUST pass `tsc --noEmit` with zero errors after the new file is added
</requirements>

## Subtasks

- [ ] 2.1 Create `app/lib/session.ts` with `requireSession()` matching the throw-only signature in TechSpec "Core Interfaces"
- [ ] 2.2 Verify the function is a drop-in replacement for the inline copies in `admin/index.tsx:36-39` and `admin/preview.$slug.tsx:32-35`
- [ ] 2.3 Run `tsc --noEmit` to confirm the new file type-checks cleanly

## Implementation Details

See TechSpec "Core Interfaces → `app/lib/session.ts`" for the exact function signature and body. The implementation is a direct extraction of the existing inline `requireSession` in `admin/index.tsx:36-39`.

Current inline copies (for reference — do not modify them in this task):
- `app/routes/admin/index.tsx:36-39` — local `requireSession` (used by `getAllPosts`, `togglePublished`)
- `app/routes/admin/preview.$slug.tsx:32-35` — inline session check (not extracted as named function)

### Relevant Files

- `app/lib/auth.ts` — provides `auth` instance imported by `requireSession`; already exists, no changes needed
- `app/routes/admin/index.tsx` — contains the source inline `requireSession` at lines 36-39; task_04 will remove it
- `app/routes/admin/preview.$slug.tsx` — contains inline session check at lines 32-35; task_04 will remove it

### Dependent Files

- `app/routes/admin/index.server.ts` — created in task_04; will import `requireSession` from `#/lib/session`
- `app/routes/admin/preview.$slug.server.ts` — created in task_04; will import `requireSession` from `#/lib/session`

### Related ADRs

- [ADR-004: `requireSession` uses throw-only pattern (`Promise<void>`)](adrs/adr-004.md) — defines return type and error behavior; do not deviate

## Deliverables

- `app/lib/session.ts` with `requireSession(): Promise<void>` implementation
- `tsc --noEmit` exits 0 with new file present
- Existing tests pass unmodified (REQUIRED)

## Tests

- Unit tests:
  - [ ] `tsc --noEmit` passes — new file must type-check cleanly against existing `#/lib/auth` and `@tanstack/react-start/server`
  - [ ] `app/tests/auth.test.ts` passes — no regressions in auth layer
- Integration tests:
  - [ ] `app/tests/auth-integ.test.ts` passes — auth integration unaffected by new file addition
- Test coverage target: existing suite coverage maintained; `session.ts` is exercised indirectly when task_04 wires callers
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0
- `app/lib/session.ts` exists and exports exactly `requireSession`
- Function signature matches TechSpec: `export async function requireSession(): Promise<void>`
- Zero caller updates in this task (deferred to task_04)
