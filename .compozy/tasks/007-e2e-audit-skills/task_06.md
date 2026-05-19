---
status: complete
title: lint-test-annotations script + scripts wiring
type: infra
complexity: medium
dependencies:
  - task_05
feature: testing/lint-test-annotations
---

# Task 06: lint-test-annotations script + scripts wiring

## Overview

Implement the CI lint script that enforces the 48-hour SLA on `@flaky`, `.skip`, and `.todo` annotations in `tests/e2e/**/*.ts`. Per ADR-003 and ADR-004, the script uses Bun's built-in TypeScript parser (AST-based) rather than regex to avoid false positives in comments or string literals. Returns exit code 1 if any annotation is older than 48 hours; emits one line per offense.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST scan `tests/e2e/**/*.ts` for `test.skip()`, `test.todo()`, and `@flaky` tag literals (in the `tag` array of `test(...)`).
- MUST require an associated ISO-date comment (`// added: YYYY-MM-DD`) on the same or preceding line for each annotation.
- MUST exit code 1 if any annotation's date is older than 48 hours from `new Date()`; emit `tests/e2e/<file>.ts:<line>: <annotation> is <hours>h old, exceeds 48h SLA`.
- MUST exit code 1 with `tests/e2e/<file>.ts:<line>: <annotation> missing ISO-date comment` if an annotation has no date comment.
- MUST exit code 0 if no offenses found.
- SHOULD use a TypeScript AST parser (Bun's built-in or `typescript` package's parser) rather than regex to avoid matching comments / string literals containing those tokens.
- MUST register a `lint:tests` script in `package.json` and a `lint-tests` target in `Makefile`.
- MUST be covered by Vitest unit tests with fixture spec files in `app/tests/fixtures/lint-annotations/`.
</requirements>

## Subtasks

- [x] 6.1 Create `scripts/lint-test-annotations.ts` implementing AST scan + date-age check + exit codes.
- [x] 6.2 Add `lint:tests` script to `package.json`.
- [x] 6.3 Add `lint-tests` target to `Makefile` invoking `bun run lint:tests`.
- [x] 6.4 Create fixture spec files under `app/tests/fixtures/lint-annotations/` covering happy + offense cases.
- [x] 6.5 Create `app/tests/lint-test-annotations.test.ts` (Vitest) covering all exit code paths.

## Implementation Details

See TechSpec "Build Order step 13" and "Known Risks → Lint script regex false positives". The mitigation chosen is AST-based scanning, not regex. The script reads each `.ts` file under `tests/e2e/`, parses to AST, finds `CallExpression` nodes where the callee matches `test.skip`/`test.todo` or where a `test(...)` call has a tag array containing `@flaky`, then walks preceding comments for the date.

### Relevant Files

- `tests/e2e/auth-flow.spec.ts` (task_05) — first real spec that the linter scans (currently has no annotations; linter exits 0).
- `package.json` — devDeps may already include `typescript`; check if a parser dep is needed.
- `Makefile` — existing `lint` target invokes Biome; new `lint-tests` is a sibling target.
- `scripts/migrate.ts`, `scripts/seed.ts`, `scripts/sync.ts` — reference patterns for Bun TypeScript scripts (shebang, error handling, exit codes).

### Dependent Files

- `.github/workflows/ci.yml` (task_07) — adds `lint-tests` as a matrix entry so CI invokes the script.
- `.agents/rules/testing.md` (task_08) — documents the 48h SLA rule that this script enforces.

### Related ADRs

- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — establishes the 48h SLA policy.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — mandates AST-based scan over regex.

## Acceptance Criteria

1. **AC-1**: `bun run lint:tests` on a clean tests/e2e/ tree (only auth-flow.spec.ts, no annotations) exits 0 with no output.
2. **AC-2**: A fixture spec with `test.skip('foo', ...)` and `// added: 2026-05-15` (3 days ago) causes the linter to exit 1 with a line containing "exceeds 48h SLA".
3. **AC-3**: A fixture spec with `test.skip('foo', ...)` and no preceding date comment causes the linter to exit 1 with "missing ISO-date comment".
4. **AC-4**: A fixture spec with `tag: ['@flaky']` and `// added: <yesterday>` exits 0 (within SLA).
5. **AC-5**: A non-test file containing the string `@flaky` in a comment or string literal does NOT trigger the linter (AST-based — comments + strings excluded).
6. **AC-6**: The Vitest test suite for the linter achieves ≥80% coverage of the script's branches.

## Deliverables

- New file `scripts/lint-test-annotations.ts`.
- New file `app/tests/lint-test-annotations.test.ts`.
- New fixture directory `app/tests/fixtures/lint-annotations/` with at least 4 fixture spec files (happy, expired skip, missing-date, flaky-within-SLA).
- Modified `package.json` (new script).
- Modified `Makefile` (new target).
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests against fixture spec files **(REQUIRED)**.

## Tests

- Unit tests:
  - [x] Happy path: file with no annotations returns exit 0 + empty offense list.
  - [x] `test.skip` with date >48h old returns exit 1 + one offense.
  - [x] `test.todo` with date >48h old returns exit 1 + one offense.
  - [x] `@flaky` tag with date >48h old returns exit 1 + one offense.
  - [x] Annotation missing date comment returns exit 1 + "missing ISO-date comment" message.
  - [x] Annotation with date within 48h returns exit 0.
  - [x] String literal containing `@flaky` (not as a tag) does NOT trigger offense.
  - [x] Multi-line comment containing `test.skip` (not as a call) does NOT trigger offense.
- Integration tests:
  - [x] Run the script directly against `app/tests/fixtures/lint-annotations/` and assert stdout content + exit code.
  - [x] Run the script against the real `tests/e2e/` directory and assert exit 0 in normal operation.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `scripts/lint-test-annotations.ts`.
- AST-based scan correctly distinguishes annotations from string/comment occurrences.
- Script execution time <500ms on the V1 spec set.
