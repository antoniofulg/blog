---
status: completed
title: Install Zod dependency
type: chore
complexity: low
dependencies: []
---

# Task 10: Install Zod dependency

## Overview
Add Zod 4.x as a runtime dependency in `package.json`. The codebase has zero Zod imports today; ADR-007 elects Zod as the project's validation primitive for new V1 schemas (UIStrings in task_11, About frontmatter in task_13). This task is a pure dependency addition with no application code.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `zod` MUST be added to `package.json` `dependencies` (not `devDependencies`).
- The pinned version MUST be `zod@^4.x` (current stable major).
- The lockfile (`bun.lock` or `bun.lockb`) MUST be updated and committed in the same commit.
- `bun install --frozen-lockfile` MUST succeed after the change.
- `make check` (tsc --noEmit) and `make lint` MUST pass after install.
</requirements>

## Subtasks
- [x] 10.1 Run `bun add zod` to add the dependency
- [x] 10.2 Verify `package.json` shows `zod` in `dependencies` (not devDependencies)
- [x] 10.3 Commit `package.json` + lockfile in one commit
- [x] 10.4 Verify `make check` + `make lint` pass

## Implementation Details
See TechSpec "Technical Considerations → Key Decisions" → ADR-007. This task ships no application code; downstream tasks (task_11, task_13) introduce Zod usage. The lockfile commit ensures CI reproduces the same dependency tree.

### Relevant Files
- `package.json` — dependency manifest
- `bun.lock` or `bun.lockb` — lockfile

### Dependent Files
- task_11 imports Zod for `uiStringsSchema`
- task_13 imports Zod for `aboutFrontmatterSchema`

### Related ADRs
- [ADR-007: Adopt Zod as the Project's Validation Primitive](adrs/adr-007.md) — scope and rationale

## Deliverables
- `package.json` updated with `zod` in `dependencies`
- Lockfile updated and committed
- Integration verification that downstream tasks can `import { z } from "zod"` successfully
- Unit tests with 80%+ coverage **(REQUIRED — this task adds no application code; coverage requirement is vacuous and documented as such)**
- Integration test asserting Zod is importable **(REQUIRED)**

## Tests
- Unit tests:
  - [ ] N/A — this task adds no application code. Coverage threshold does not apply meaningfully. CI passing on the PR is the verification.
- Integration tests:
  - [x] `bun install --frozen-lockfile` succeeds with Zod present in the lockfile
  - [x] A scratch import statement `import { z } from "zod"` type-checks under `make check`
  - [ ] CI pipeline (`ci.yml`) on the PR exits green
- Test coverage target: >=80% (vacuous — no new application code)
- All tests must pass

## Success Criteria
- All tests passing
- `package.json` `dependencies` includes `zod@^4.x`
- Lockfile updated in the same commit
- CI green on the PR
- Downstream task_11 and task_13 can import Zod without dependency resolution errors
