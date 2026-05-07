---
status: pending
title: Agent Documentation & Domain Rules
type: docs
complexity: medium
dependencies:
  - task_01
  - task_02
  - task_03
  - task_04
---

# Task 05: Agent Documentation & Domain Rules

## Overview

Create `AGENTS.md` at repo root documenting the project structure, tech stack, conventions, and skill map based on the actual implemented patterns from tasks 01-04. Create `CLAUDE.md` as a symlink so Claude Code's automatic context injection reads the same source. Publish four domain rule files in `.agents/rules/` covering auth, routes, DB, and component concerns. Rules are written after code to guarantee alignment with implemented patterns (ADR-002).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `AGENTS.md` at repo root with ≤200 lines covering: project description, stack, file structure map, skill map, key conventions, and links to `.agents/rules/` domain files
- MUST create `CLAUDE.md` as a symlink to `AGENTS.md` (`ln -s AGENTS.md CLAUDE.md` from repo root)
- MUST create `.agents/rules/auth.md` covering: `requireSession` usage, session check placement, Better Auth conventions, DAL pattern, prohibited patterns
- MUST create `.agents/rules/routes.md` covering: two-file pattern for admin routes, allowed/prohibited content in `*.tsx` files, naming conventions, `routeTree.gen.ts` handling
- MUST create `.agents/rules/db.md` covering: per-file responsibilities, type placement rule, query function rules, prohibited patterns
- MUST create `.agents/rules/components.md` covering: layer boundary rule, TypeScript idiom (`type` not `interface`), structure rules, prohibited patterns
- MUST NOT exceed 200 lines in `AGENTS.md` — link to domain files instead of inlining content
- MUST reflect actual implemented patterns (e.g., `app/lib/session.ts`, `app/lib/mdx/` directory, `app/types/` directory) — not pre-refactor structure
- SHOULD verify `CLAUDE.md` symlink resolves correctly (`ls -la CLAUDE.md` shows `-> AGENTS.md`)
</requirements>

## Subtasks

- [ ] 5.1 Create `AGENTS.md` at repo root with all required sections from TechSpec "AGENTS.md Structure"; verify ≤200 lines
- [ ] 5.2 Create `CLAUDE.md` symlink (`ln -s AGENTS.md CLAUDE.md` from repo root); verify symlink resolves
- [ ] 5.3 Create `.agents/rules/auth.md` with content from TechSpec "Domain Rule Files Content → auth.md"
- [ ] 5.4 Create `.agents/rules/routes.md` with content from TechSpec "Domain Rule Files Content → routes.md"
- [ ] 5.5 Create `.agents/rules/db.md` with content from TechSpec "Domain Rule Files Content → db.md"
- [ ] 5.6 Create `.agents/rules/components.md` with content from TechSpec "Domain Rule Files Content → components.md"

## Implementation Details

See TechSpec sections "AGENTS.md Structure" and "Domain Rule Files Content" for the exact content of each file. Content is fully specified in the TechSpec — this task is faithful transcription plus verification that all file paths and conventions reflect the post-refactor codebase.

`AGENTS.md` must reference:
- `app/lib/mdx/` (not `app/lib/mdx.server.ts`) — split in task_03
- `app/lib/session.ts` — created in task_02
- `app/types/` directory — created in task_01
- `admin/*.server.ts` pattern — established in task_04

### Relevant Files

- `AGENTS.md` (new) — root agent context document
- `CLAUDE.md` (new symlink) — points to `AGENTS.md`; Claude Code auto-injects this into context
- `.agents/rules/auth.md` (new) — `.agents/rules/` directory already exists (contains `git-workflow.md`, `cicd.md`)
- `.agents/rules/routes.md` (new)
- `.agents/rules/db.md` (new)
- `.agents/rules/components.md` (new)
- `.agents/rules/git-workflow.md` — existing; `AGENTS.md` must link to it
- `.agents/rules/cicd.md` — existing; `AGENTS.md` must link to it

### Dependent Files

- None — this is documentation only; no source files depend on these docs

### Related ADRs

- [ADR-002: Atomic single-PR delivery strategy](adrs/adr-002.md) — rules written after code (this task last in dependency chain) ensures pattern alignment; no post-merge corrections needed

## Deliverables

- `AGENTS.md` at repo root (≤200 lines)
- `CLAUDE.md` symlink at repo root resolving to `AGENTS.md`
- `.agents/rules/auth.md`
- `.agents/rules/routes.md`
- `.agents/rules/db.md`
- `.agents/rules/components.md`
- All existing tests pass (REQUIRED — documentation changes must not break any CI check)

## Tests

- Unit tests:
  - [ ] `wc -l AGENTS.md` output is ≤200 — enforces the ≤200 line limit
  - [ ] `ls -la CLAUDE.md` shows symlink pointing to `AGENTS.md` — symlink resolves correctly
  - [ ] `make lint` passes — no lint regressions from new files
  - [ ] `make check` (`tsc --noEmit`) passes — no TypeScript regressions
- Integration tests:
  - [ ] `make test` passes — full suite green after documentation additions
  - [ ] All four `.agents/rules/*.md` files reference correct post-refactor paths (e.g., `#/lib/session`, `#/lib/mdx/renderer.server`, `#/types/content`) — manual grep verification
- Test coverage target: N/A (documentation only); CI must remain green
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `tsc --noEmit` exits 0 (`make check`)
- `AGENTS.md` exists at repo root with ≤200 lines
- `CLAUDE.md` is a symlink to `AGENTS.md` (not a copy)
- All four domain rule files exist in `.agents/rules/`
- `AGENTS.md` file structure section references `app/lib/mdx/`, `app/lib/session.ts`, `app/types/` — not pre-refactor paths
- `.agents/rules/auth.md` references `#/lib/session` as the import path for `requireSession`
- `.agents/rules/routes.md` documents the `*.server.ts` co-location pattern
