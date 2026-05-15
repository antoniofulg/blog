---
status: completed
title: Move lorem-ipsum fixture out of `content/`
type: refactor
complexity: low
dependencies:
    - task_01
---

# Task 05: Move lorem-ipsum fixture out of `content/`

## Overview
The test fixture `content/en/lorem-ipsum.mdx` currently lives alongside production content. After task_01 lands, the F9 `[sync]` step indexes everything in `content/` into the production `posts` table — the fixture would become a phantom production post. Move the fixture to `app/tests/fixtures/lorem-ipsum.mdx` and update the test references so the fixture is invisible to the sync pipeline while remaining accessible to tests.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- `content/en/lorem-ipsum.mdx` MUST be moved to `app/tests/fixtures/lorem-ipsum.mdx` using `git mv` to preserve history.
- Tests that previously read the fixture from `content/en/lorem-ipsum.mdx` MUST update their path references to the new location.
- After the move, running `bun run sync` against `content/` MUST NOT create a `posts` row for the lorem-ipsum fixture.
- The full vitest suite MUST pass after the move.
- The fixture's contents MUST remain semantically identical; this is a relocation, not a rewrite.
</requirements>

## Subtasks
- [x] 5.1 Create `app/tests/fixtures/` directory if it does not exist
- [x] 5.2 `git mv content/en/lorem-ipsum.mdx app/tests/fixtures/lorem-ipsum.mdx`
- [x] 5.3 Update path references in `app/tests/mdx.test.ts` and `app/tests/indexer.test.ts`
- [x] 5.4 Run `bun run sync` against `content/` → assert no `posts` row for `lorem-ipsum`
- [x] 5.5 Run the full vitest suite → assert green

## Implementation Details
See TechSpec "Impact Analysis" row for `content/en/lorem-ipsum.mdx`. The skill rules in `.agents/rules/db.md` emphasize keeping test data out of production data paths — this task makes that boundary explicit. Path constants should be co-located with the tests using them, not centralized.

### Relevant Files
- `content/en/lorem-ipsum.mdx` (source)
- `app/tests/fixtures/lorem-ipsum.mdx` (destination)
- `app/tests/mdx.test.ts` — references fixture for renderer tests
- `app/tests/indexer.test.ts` — references fixture for indexer tests

### Dependent Files
- task_01 F9 `syncAll('./content')` integration — the fixture must leave `content/` before this hits production

### Related ADRs
- [ADR-001: V1 Scope](adrs/adr-001.md) — F8 fixture move
- [ADR-002: 3-Phase Rollout](adrs/adr-002.md) — Phase 1 ordering

## Deliverables
- Fixture file relocated with git history preserved
- Test path references updated
- Unit tests with 80%+ coverage **(REQUIRED)**
- Integration test verifying sync excludes the moved fixture **(REQUIRED)**

## Tests
- Unit tests:
  - [x] `mdx.test.ts` reads the fixture from the new path and renders successfully
  - [x] `indexer.test.ts` reads the fixture from the new path and asserts frontmatter correctly
  - [x] `git log --follow` on the new path shows the move preserved history
- Integration tests:
  - [x] After `git mv`, running `bun run sync --dir content` produces no `posts` row with slug `lorem-ipsum`
  - [x] After the move, the full vitest suite passes
- Test coverage target: >=80%
- All tests must pass

## Success Criteria
- All tests passing
- Test coverage >=80%
- Fixture file exists at `app/tests/fixtures/lorem-ipsum.mdx` and not in `content/en/`
- F9 sync (task_01) does not index the fixture as a production post
