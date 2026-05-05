---
status: completed
title: Create `.dockerignore`
type: infra
complexity: low
dependencies: []
---

# Task 1: Create `.dockerignore`

## Overview

Create a `.dockerignore` file at the project root to control which files are excluded from the Docker build context. This prevents large, unnecessary, or sensitive directories (`node_modules`, `.output`, `.env`) from being sent to the Docker daemon on every `docker build` call, reducing build time and preventing secrets from leaking into image layers.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST exclude `node_modules/` to prevent host deps from polluting the build context
- MUST exclude `.output/`, `.nitro/`, `.tanstack/` (generated build artifacts)
- MUST exclude `.env` and `.env.*` while explicitly allowing `.env.example`
- MUST exclude `.git/` to prevent repository history from entering the image
- MUST exclude `drizzle/` (generated migration files not needed in image)
- SHOULD exclude `*.local`, `.DS_Store` (macOS and local-only files)
</requirements>

## Subtasks

- [x] 1.1 Create `.dockerignore` at project root with all exclusion patterns from TechSpec `.dockerignore` section
- [x] 1.2 Verify `.env.example` is NOT excluded (negation rule `!.env.example` required)
- [x] 1.3 Confirm build context size is reduced vs. no `.dockerignore` (run `docker build` and observe context transfer size)

## Implementation Details

See TechSpec "Implementation Design → `.dockerignore`" section for the complete list of patterns.

The `.gitignore` already excludes `docker-compose.override.yml`, `.output`, `.nitro`, `.tanstack` from git — `.dockerignore` must independently list the same exclusions since Docker does not read `.gitignore`.

### Relevant Files

- `.gitignore` — reference for which generated/local paths already exist in the project; `.dockerignore` patterns should be a superset
- `.env.example` — must remain accessible inside the build context (used by `make setup`, not by Docker build itself, but keeping it available is correct)
- `docker-compose.yml` — build context is `.` (project root); `.dockerignore` applies to this context

### Dependent Files

- `Dockerfile` (task_02) — correctness of the Dockerfile build depends on `.dockerignore` being in place first so `COPY . .` in the builder stage excludes the right files

### Related ADRs

- [ADR-003: Multi-Stage Dockerfile with Named Build Targets](adrs/adr-003.md) — builder stage uses `COPY . .`; `.dockerignore` determines what that copies

## Deliverables

- `.dockerignore` file at project root with all required exclusion patterns
- Smoke test: `docker build` completes without copying `node_modules` or `.env` into context

## Tests

- Unit tests:
  - [x] `.dockerignore` exists at project root
  - [x] `node_modules` is listed and excluded from build context
  - [x] `.env` is listed and excluded; `.env.example` is NOT excluded (negation rule present)
  - [x] `.output`, `.nitro`, `.tanstack` are listed
  - [x] `.git` is listed
- Integration tests:
  - [ ] `docker build -t blog-test .` completes; inspect image layers confirm no `node_modules` directory in `/app` (blocked: needs Dockerfile from task_02)
  - [x] `docker build -t blog-test .` context transfer size is under 5 MB — verified 54.47kB via `FROM scratch COPY . /ctx` (vs. ~486MB without `.dockerignore`)
- Test coverage target: >=80%
- All tests must pass

## Success Criteria

- All tests passing
- Test coverage >=80%
- `docker build` context transfer size under 5 MB
- No `.env` secrets present in any image layer (`docker history blog-test` shows no env file in COPY layers)
