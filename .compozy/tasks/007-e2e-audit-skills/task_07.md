---
status: completed
title: CI gate integration + GitHub Secrets documentation
type: infra
complexity: low
dependencies:
    - task_05
    - task_06
feature: testing/ci-gate
---

# Task 07: CI gate integration + GitHub Secrets documentation

## Overview

Extend `.github/workflows/ci.yml`'s quality matrix to include `e2e` and `lint-tests` entries so every PR runs Playwright + the annotation linter. Add a Chromium binary cache step keyed on the lockfile hash to avoid re-downloading Chromium on every run. Document the required `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` GitHub Secrets in `.agents/rules/cicd.md`.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST add `e2e` and `lint-tests` to the existing `quality.strategy.matrix.check` list in `.github/workflows/ci.yml`.
- MUST add a `make test-e2e` target and a `make lint-tests` target in `Makefile` (referenced by the matrix's `make ${{ matrix.check }}` step).
- MUST add a Chromium binary cache step (`actions/cache@v4`) keyed on `bun.lock` hash; the `e2e` job restores Chromium from cache before `bunx playwright install --with-deps` runs.
- MUST inject `E2E_ADMIN_EMAIL` and `E2E_ADMIN_PASSWORD` from GitHub Secrets into the `e2e` job's environment.
- MUST upload `playwright-report/` and `test-results/` as GHA artifacts on the `e2e` job, regardless of pass/fail.
- MUST document the required Secrets + the manual one-time setup procedure in `.agents/rules/cicd.md`.
- MUST verify the existing `commitlint` and `branch-check` jobs still run on PRs (no regression).
</requirements>

## Subtasks

- [x] 7.1 Add `test-e2e` and `lint-tests` Makefile targets (each invokes the corresponding `bun run` script).
- [x] 7.2 Extend `.github/workflows/ci.yml:jobs.quality.strategy.matrix.check` with `e2e` and `lint-tests`.
- [x] 7.3 Add Playwright Chromium cache step in the `e2e` matrix entry only (use `if: matrix.check == 'e2e'`).
- [x] 7.4 Add `env:` block injecting `E2E_ADMIN_EMAIL` + `E2E_ADMIN_PASSWORD` for the `e2e` matrix entry only.
- [x] 7.5 Add `actions/upload-artifact@v4` step on `e2e` matrix entry with `if: always()`.
- [x] 7.6 Update `.agents/rules/cicd.md` with required Secrets, setup procedure, and e2e gate behavior.

## Implementation Details

See TechSpec "Build Order steps 16-17, 22" and PRD-007 High-Level Technical Constraints (free-tier GHA budget). The current `quality` job uses `matrix: { check: [test, lint, check, build-js] }`; extending it to `[test, lint, check, build-js, e2e, lint-tests]` keeps the parallel-fanout model and reuses existing checkout + bun setup steps. The Chromium cache lives at `~/.cache/ms-playwright`; `actions/cache@v4` with key `playwright-${{ runner.os }}-${{ hashFiles('bun.lock') }}` covers the common case.

### Relevant Files

- `.github/workflows/ci.yml` — current matrix at L11-14 + `make ${{ matrix.check }}` step at L20.
- `Makefile` — current `test`, `lint`, `check`, `build-js` targets; pattern to mirror for new targets.
- `.agents/rules/cicd.md` — existing CI/CD doc; "GitHub Secrets required" section at the bottom is the insertion point.
- `.github/workflows/cd.yml` — reference for `secrets:` block shape; do NOT modify here.

### Dependent Files

- `tests/e2e/global-setup.ts` (task_03) — reads `E2E_ADMIN_EMAIL` / `E2E_ADMIN_PASSWORD` from env.
- `playwright.config.ts` (task_04) — references the secrets via env at webServer startup.

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — PR-blocking CI from day 1.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — strict-block + retry + SLA policy lives in the CI surface this task wires up.

## Acceptance Criteria

1. **AC-1**: Pushing to a feature branch triggers a CI run where the `quality` matrix shows 6 entries (`test`, `lint`, `check`, `build-js`, `e2e`, `lint-tests`) running in parallel.
2. **AC-2**: The `e2e` matrix entry runs `bunx playwright test` and reports pass/fail; on red, the PR cannot merge.
3. **AC-3**: The `lint-tests` matrix entry runs `bun run lint:tests` and reports pass/fail.
4. **AC-4**: On the second CI run after Chromium cache warms, the `e2e` job skips Chromium download (verified by cache-hit log line).
5. **AC-5**: `.agents/rules/cicd.md` contains a documented "E2E secrets" subsection with the exact secret names and the manual setup steps.
6. **AC-6**: Existing `commitlint` and `branch-check` jobs continue to run on PRs (no regression in the workflow).

## Deliverables

- Modified `.github/workflows/ci.yml` (matrix extension + cache step + env block + artifact upload).
- Modified `Makefile` (2 new targets).
- Modified `.agents/rules/cicd.md` (documentation).
- Unit tests with 80%+ coverage **(REQUIRED)** — N/A directly; this task is workflow + Makefile + doc only.
- Integration tests for CI integration **(REQUIRED)** — verified by a green PR after Phase 1 lands.

## Tests

- Unit tests:
  - [x] Vitest test parses `.github/workflows/ci.yml` (via `yaml` package) and asserts the matrix includes `e2e` and `lint-tests` entries.
  - [x] Vitest test parses `Makefile` and asserts `test-e2e:` and `lint-tests:` targets are present.
- Integration tests:
  - [ ] First CI run after merge: `e2e` matrix entry shows green (specs pass).
  - [ ] Second CI run: Chromium cache-hit log line present in `e2e` step; install step is skipped or fast-paths.
  - [ ] Forced-failure run (deliberately broken spec on a fixture branch): `e2e` entry fails; PR merge UI shows the gate blocking merge.
- Test coverage target: >=80% (vacuously satisfied; no source code added).
- All tests must pass.

## Success Criteria

- All tests passing.
- 6-entry matrix running on every PR.
- Chromium cache reduces e2e wall-clock by ≥30 seconds on warm runs.
- `.agents/rules/cicd.md` reflects the new gate accurately.
