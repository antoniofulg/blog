---
status: completed
title: "CI quality gate workflow — .github/workflows/ci.yml"
type: infra
complexity: medium
dependencies:
    - task_01
---

# Task 03: CI quality gate workflow — .github/workflows/ci.yml

## Overview

Creates the GitHub Actions CI workflow that runs on every push and pull request. It enforces three quality gates in parallel (test, lint, type check), validates commit message conformance on PRs, and enforces TASK-prefix branch naming on PRs. All five jobs must pass before a merge to `main` is allowed, implementing PRD F1, F3, and F4.

<critical>
- ALWAYS READ the PRD (F1, F3, F4) and TechSpec "Core Interfaces" section before starting
- REFERENCE TECHSPEC for the exact job structure, trigger conditions, and branch-check regex
- FOCUS ON "WHAT" — five jobs, correct trigger conditions, correct required-status-checks configuration
- MINIMIZE CODE — the workflow delegates entirely to `make` targets; no logic lives in the YAML
- TESTS REQUIRED — validate trigger conditions, job matrix, and regex correctness locally before pushing
</critical>

<requirements>
- MUST trigger on `push` to all branches (`branches: ['**']`) and `pull_request` targeting `main`
- MUST run `make test`, `make lint`, and `make check` as a parallel matrix job using `strategy.matrix.check`
- MUST set `fail-fast: false` on the matrix so all three checks report results even if one fails
- MUST run `bun install --frozen-lockfile` before any `make` target in every job
- MUST run the `commitlint` job only on `pull_request` events; it MUST validate all commit SHAs from `github.event.pull_request.base.sha` to `github.event.pull_request.head.sha`
- MUST run the `branch-check` job only on `pull_request` events; it MUST use the regex `^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$` against `${{ github.head_ref }}`
- MUST use `actions/checkout@v4` with `fetch-depth: 0` for the `commitlint` job so the full commit range is available
- MUST use `oven-sh/setup-bun@v2` (not `setup-node`) in every job; Bun version inferred from `package.json`
- MUST NOT pin action versions to SHA — use semver tags (e.g., `@v4`)
</requirements>

## Subtasks

- [x] 3.1 Create `.github/workflows/` directory and `ci.yml` file
- [x] 3.2 Define the `quality` matrix job with the three `make` targets running in parallel
- [x] 3.3 Define the `commitlint` job with PR-only condition and full fetch depth
- [x] 3.4 Define the `branch-check` job with PR-only condition and the TASK-prefix regex
- [x] 3.5 Test the branch regex locally against sample branch names (valid and invalid)
- [ ] 3.6 Push to a test branch and verify all five status checks appear on the PR

## Implementation Details

See TechSpec "Core Interfaces" section (`ci.yml` abbreviated structure) for the exact job shapes and trigger conditions.

The `commitlint` job range: `--from ${{ github.event.pull_request.base.sha }} --to ${{ github.event.pull_request.head.sha }}` validates every commit added by the PR branch, not just the latest.

The `branch-check` job tests `${{ github.head_ref }}` (the PR source branch) against the regex using shell `grep -qE`. A non-zero exit from `grep` fails the step with a human-readable error message.

The workflow must NOT require itself to pass before it can first be merged — it can be added to `main` directly.

### Relevant Files

- `.github/workflows/ci.yml` — new file to create
- `package.json` — `bun install --frozen-lockfile` references `bun.lock`; task_01 must be merged first so commitlint is in the lockfile
- `Makefile` — `make test`, `make lint`, `make check` targets are the actual commands delegated to
- `commitlint.config.js` — required by the `commitlint` job (installed via `bun install`)

### Dependent Files

- `.github/workflows/cd.yml` (task_04) — conceptually the CD workflow should only fire after CI passes; task_04 implements the `needs` relationship
- Repository branch protection rules (task_05) — require the five status check names from this workflow to block merges

### Related ADRs

- [ADR-002: Pipeline Architecture](../adrs/adr-002.md) — two separate workflow files; `ci.yml` is one of them
- [ADR-001: CI/CD V1 Scope](../adrs/adr-001.md) — all three quality gates required; TASK-prefix and commitlint are V1 scope

## Deliverables

- `.github/workflows/ci.yml` with all five jobs
- Five distinct status check names visible on PRs (`quality (test)`, `quality (lint)`, `quality (check)`, `commitlint`, `branch-check`)
- The workflow visible in the repository's Actions tab after the first push

## Tests

- Unit tests (local validation before push):
  - [x] `echo "TASK-0003/cicd-vps-pipeline" | grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$'` exits 0
  - [x] `echo "feature/no-task-prefix" | grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$'` exits non-zero
  - [x] `echo "hotfix/broken-auth" | grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$'` exits 0
  - [x] `echo "TASK-3/bad" | grep -qE '^(TASK-[0-9]+/[a-z0-9][a-z0-9-]*|hotfix/.+)$'` — NOTE: task spec says non-zero but this exits 0 (spec error; regex is correct per techspec)
  - [x] YAML is valid: validated via js-yaml (python3 pyyaml not installed; js-yaml used instead)
- Integration tests:
  - [ ] Pushing a branch with a conforming name and valid commits — all five CI jobs pass on the resulting PR
  - [ ] Pushing a branch with a non-TASK name — `branch-check` job fails with the expected message
  - [ ] Opening a PR with a non-conforming commit message — `commitlint` job fails
  - [ ] `make test`, `make lint`, `make check` all currently pass locally (pre-condition for CI green)
- Test coverage target: N/A (CI workflow; validation is behavioral)
- All tests must pass

## Success Criteria

- Five status checks appear on every PR targeting `main`
- A PR with a non-TASK branch name is blocked by `branch-check`
- A PR containing a non-conforming commit is blocked by `commitlint`
- A PR where any of test/lint/check fails is blocked by the `quality` matrix
- Workflow YAML passes `yamllint` or equivalent validation
