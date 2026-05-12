---
status: completed
title: Conventions, CONTENT.md & Frontmatter Lint
type: docs
complexity: medium
dependencies:
    - task_01
    - task_02
    - task_03
---

# Task 10: Conventions, CONTENT.md & Frontmatter Lint

## Overview

Document the content conventions in `CONTENT.md` at repo root, add the `post/<lang>/<slug>` branch naming pattern to `.agents/rules/git-workflow.md`, and update the frontmatter lint test to scan `content/en/**`, enforce the controlled category list, and validate series+seriesPart co-presence. This task captures the "as-built" conventions from all previous tasks and provides the CI guardrail that enforces them going forward.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `CONTENT.md` at repo root documenting: locale folder structure, required and optional frontmatter fields, category vocabulary (6 values), image folder convention, branch naming pattern, series slug rules
- MUST add `post/<lang>/<slug>` as an allowed branch pattern in `.agents/rules/git-workflow.md` (alongside `TASK-XXXX/` and `hotfix/`)
- MUST update `app/tests/mdx.test.ts` (or create a new lint test) to scan all MDX files under `content/en/**` and `content/pt-br/**` (if any exist)
- MUST block CI if `title`, `description`, `publishedAt`, or `slug` are missing from any MDX file
- MUST block CI if `category` is set to a value not in `["frontend", "backend", "algorithms", "infra", "career", "tooling"]`
- MUST block CI if `series` is set without `seriesPart` or vice versa
- MUST NOT fail CI for posts that omit optional fields (`category`, `series`, `seriesPart`, `draft`, `cover`)
- SHOULD update `AGENTS.md` to reference `CONTENT.md` for content authoring conventions
</requirements>

## Subtasks

- [x] 10.1 Create `CONTENT.md` at repo root — document folder structure, frontmatter schema table, category list, image convention, branch naming, series rules
- [x] 10.2 Update `.agents/rules/git-workflow.md` — add `post/<lang>/<slug>` to the branch naming section
- [x] 10.3 Update frontmatter lint test — scan `content/**/*.mdx`; assert required fields; block on unknown category; assert series+seriesPart co-presence
- [x] 10.4 Optionally update `AGENTS.md` — add a "Content" row linking to `CONTENT.md`
- [x] 10.5 Run `make test` to confirm lint test passes on all 3 existing posts

## Implementation Details

See TechSpec "Development Sequencing → step 19" and PRD "Core Features → F4 — Frontmatter Schema & CONTENT.md" for the exact field list and category vocabulary to document.

The frontmatter lint test in `app/tests/mdx.test.ts` currently has a `describe("unit: parseFrontmatter")` block. Add a new `describe("lint: frontmatter conventions")` block that uses `node:fs` / `node:path` to find MDX files under `content/` and asserts against each one.

The `no-title.mdx` fixture in `app/tests/fixtures/` already exists for negative testing — the lint test for missing title can reuse it.

### Relevant Files

- `app/tests/mdx.test.ts` — add the new lint describe block here
- `app/tests/fixtures/no-title.mdx` — already exists; useful for verifying the title-missing assertion fires
- `.agents/rules/git-workflow.md` — add branch naming line
- `AGENTS.md` — optional: add content authoring row to the Skill Map or Rules section

### Dependent Files

- All files in `content/en/` (3 MDX files after task_02) — must pass the lint rule; they already have `title`, `description`, `publishedAt`, `slug` in frontmatter
- CI pipeline — lint test is part of `make test`, which runs in CI; any failing MDX file blocks merge

### Related ADRs

- [ADR-001: V1 scope — conventions + DB schema, no UI filtering](adrs/adr-001.md) — category enforcement with CI blocking is the V1 convention enforcement mechanism

## Deliverables

- `CONTENT.md` at repo root with complete authoring guide
- `.agents/rules/git-workflow.md` updated with `post/<lang>/<slug>` pattern
- Frontmatter lint test that blocks CI on missing required fields or unknown category
- All 3 existing posts pass the lint test
- `make test` exits 0

## Tests

- Unit tests:
  - [x] Lint test: `content/en/lorem-ipsum.mdx` has all required fields → assertion passes
  - [x] Lint test: `content/en/component-composition-react.mdx` has all required fields → passes
  - [x] Lint test: MDX file with missing `title` → lint assertion throws with descriptive message
  - [x] Lint test: MDX file with `category: unknown-value` → lint assertion blocks
  - [x] Lint test: MDX file with `series: my-series` but no `seriesPart` → lint assertion blocks
  - [x] Lint test: MDX file with `seriesPart: 1` but no `series` → lint assertion blocks
  - [x] Lint test: MDX file with no `category` field → passes (optional field)
- Integration tests:
  - [x] `make test` exits 0 — all 3 existing posts satisfy the lint rules
  - [x] Adding a fixture MDX file with `category: invalid` causes test failure
- Test coverage target: lint assertions cover all 6 failure modes; existing posts prove all passing paths
- All tests must pass

## Success Criteria

- All tests passing (`make test`)
- `CONTENT.md` exists at repo root with complete field documentation
- `.agents/rules/git-workflow.md` includes `post/<lang>/<slug>` pattern
- CI fails on any MDX file with missing required fields or invalid category
- All 3 existing posts pass the lint rule
- `make lint` passes (CONTENT.md and git-workflow.md are docs files; no Biome linting needed)
