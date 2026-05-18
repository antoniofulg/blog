---
status: completed
title: Install Playwright + PGLite + remark deps; gitignore additions
type: infra
complexity: low
dependencies: []
feature: testing/playwright-bootstrap
---

# Task 01: Install Playwright + PGLite + remark deps; gitignore additions

## Overview

Install all dev dependencies required by Phases 1-3 in a single step so that downstream tasks never block on package installation. Add `.gitignore` entries for Playwright artifacts, the auth storageState directory, and the audit per-run report directory before any of those paths exist on disk.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST install `@playwright/test`, `@electric-sql/pglite`, `unified`, `remark-parse`, `remark-mdx`, `unist-util-visit`, `@types/unist` as dev dependencies pinned to known-good versions.
- MUST install Chromium browser binary via `bunx playwright install chromium`.
- MUST add `.gitignore` entries: `tests/e2e/.auth/`, `tests/e2e/storageState.json`, `test-results/`, `playwright-report/`, `docs/_reports/content-audit-*.md`.
- MUST NOT introduce any source files; this task is package + gitignore only.
- SHOULD verify the Drizzle ORM version matches the `drizzle-orm/pglite` driver subpath export.
</requirements>

## Subtasks

- [x] 1.1 Run `bun add -D` with the full devDependency set, ensuring exact versions are recorded in `bun.lock`.
- [x] 1.2 Run `bunx playwright install chromium` (no `--with-deps` on macOS dev machines; CI handles OS deps separately).
- [x] 1.3 Append the five `.gitignore` entries listed in the requirements block.
- [x] 1.4 Verify `bun install --frozen-lockfile` succeeds with the new lockfile (no peer-dep warnings that block CI).

## Implementation Details

See TechSpec section "Development Sequencing → Phase 1 → Build Order step 1" for the exact `bun add` command. The pinned versions land in `package.json:devDependencies` (existing block at L45-65).

### Relevant Files

- `package.json` — devDependency block needs additions; existing test stack is vitest + @testing-library + jsdom only.
- `bun.lock` — frozen lockfile; new deps must lock cleanly.
- `.gitignore` — current entries cover `.env`, `node_modules`, `dist`, `.tanstack`, `.output`; no test/auth/audit entries yet.

### Dependent Files

- All Phase 1-3 tasks transitively depend on this task: `task_02` through `task_15` require at least one of the installed packages.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — establishes PGLite + Playwright as the chosen substrate.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — locks the specific package choices (PGLite over testcontainers; remark over regex).

## Acceptance Criteria

1. **AC-1**: `bun install --frozen-lockfile` exits 0 after the new lockfile is committed.
2. **AC-2**: `bunx playwright --version` prints a version and `~/.cache/ms-playwright/chromium-*` directory exists.
3. **AC-3**: `git check-ignore tests/e2e/.auth/foo` and `git check-ignore docs/_reports/content-audit-2026-01-01.md` both exit 0 (paths are ignored).
4. **AC-4**: No source files under `app/`, `tests/`, `scripts/`, `.agents/`, or `.github/` have been added or modified.

## Deliverables

- Updated `package.json` with 7 new devDependencies.
- Updated `bun.lock` reflecting the new dependency closure.
- 5 new entries in `.gitignore`.
- Unit tests with 80%+ coverage **(REQUIRED)** — this task is config-only; coverage requirement is satisfied by ensuring no source files are added.
- Integration tests for installation reproducibility **(REQUIRED)** — verified via `bun install --frozen-lockfile` succeeding in CI.

## Tests

- Unit tests:
  - [x] Verify `package.json:devDependencies` contains each of: `@playwright/test`, `@electric-sql/pglite`, `unified`, `remark-parse`, `remark-mdx`, `unist-util-visit`, `@types/unist`.
  - [x] Verify each `.gitignore` glob pattern is present (string match per entry).
- Integration tests:
  - [x] `bun install --frozen-lockfile` in a clean checkout exits 0 with no warnings that fail CI.
  - [x] `bunx playwright install chromium` produces a runnable Chromium binary (verified by `bunx playwright test --list` on an empty config).
- Test coverage target: >=80% (N/A for this config-only task; verified by the absence of new source files).
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% (config-only task; criterion satisfied vacuously).
- New lockfile reproducible across local + CI environments.
- Chromium binary cached in the standard Playwright location.
