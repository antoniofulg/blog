---
status: completed
title: Create `CONTRIBUTING.md`
type: docs
complexity: low
dependencies:
    - task_05
---

# Task 6: Create `CONTRIBUTING.md`

## Overview

Create `CONTRIBUTING.md` at the project root documenting the two-command onboarding flow (`make setup && make dev`), the available Makefile targets, and the two development paths (native vs. containerized). This file is the canonical contributor entry point and replaces the need to read `package.json` scripts or docker-compose files to understand the workflow.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST document Docker Desktop as the only prerequisite for `make dev-docker`; Bun + Docker Desktop for `make dev`
- MUST show the two-command onboarding flow: `make setup` then `make dev`
- MUST reference `make help` as the single source of truth for all available commands (not duplicate every target)
- MUST explain the two development paths: `make dev` (native, default) vs `make dev-docker` (containerized, opt-in)
- MUST document the macOS hot reload caveat for `make dev-docker`
- MUST document that dev data resets on `bun dev` restart (vite.config.ts seeds on every start)
- MUST be ≤ 80 lines — concise reference, not a tutorial
- SHOULD include a "Before you commit" checklist: `make test && make lint`
</requirements>

## Subtasks

- [x] 6.1 Write prerequisites section (Docker Desktop, optional Bun for native dev)
- [x] 6.2 Write quick-start section with `make setup && make dev` as the two commands
- [x] 6.3 Write "Available commands" section referencing `make help`
- [x] 6.4 Write "Dev paths" section explaining `make dev` vs `make dev-docker` and macOS caveat
- [x] 6.5 Write "Before you commit" checklist (`make test && make lint`)
- [x] 6.6 Note that dev data (seed) resets on each `make dev` restart

## Implementation Details

See TechSpec "Implementation Design → CONTRIBUTING.md — Minimum Content" section for the required structure and key content points.

**Key notes to include:**
- `make dev-docker` uses `docker compose watch` — requires Docker Desktop 4.24+
- macOS hot reload via `make dev-docker` may vary due to Bun file-event issue (oven-sh/bun#9300); `make dev` (native) is more reliable
- The Vite `configureServer` hook auto-runs `db:migrate` and `db:seed` on every `bun dev` start — dev data is reset each restart

### Relevant Files

- `Makefile` (task_05) — all targets must be working before CONTRIBUTING.md documents them
- `.env.example` — onboarding section should mention that `.env` is auto-created from this file by `make setup`
- `vite.config.ts` — source of the auto-seed behavior; not referenced directly but the behavior must be documented
- `package.json` — `make help` output is derived from Makefile targets, not package.json scripts; CONTRIBUTING.md should not list package.json scripts

### Dependent Files

No downstream files depend on `CONTRIBUTING.md`.

### Related ADRs

- [ADR-001: Containerized Dev as Opt-In Target, Not Default](adrs/adr-001.md) — justifies documenting `make dev` as the default and `make dev-docker` as opt-in

## Deliverables

- `CONTRIBUTING.md` at project root, ≤ 80 lines
- Two-command onboarding flow documented and verified to work
- macOS hot reload caveat for `make dev-docker` documented

## Tests

- Unit tests:
  - [x] `CONTRIBUTING.md` exists at project root
  - [x] File contains `make setup` and `make dev` in the quick-start section
  - [x] File references `make help` for the full command list
  - [x] File mentions both dev paths (`make dev` and `make dev-docker`)
  - [x] File is ≤ 80 lines (`wc -l CONTRIBUTING.md` ≤ 80)
- Integration tests:
  - [ ] Follow CONTRIBUTING.md quick-start on a clean clone: `make setup && make dev` completes in under 3 minutes
  - [ ] `make help` output matches the "Available commands" description in CONTRIBUTING.md
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- File is ≤ 80 lines and covers all required topics
- A developer unfamiliar with the project can follow CONTRIBUTING.md to a running dev environment without external documentation
- `make setup && make dev` as documented completes in under 3 minutes on a machine with Docker Desktop
