---
status: complete
title: App-audit CLI + app-audit.yml workflow + Makefile + gitignore
type: infra
complexity: medium
dependencies:
  - task_18
feature: audit/app-audit-cli
---

# Task 19: App-audit CLI + app-audit.yml workflow + Makefile + gitignore

## Overview

Wire the app-audit CLI surface: create `scripts/audit-fe.ts` as the Bun entry point with `--trigger`, `--routes`, `--lighthouse` / `--no-lighthouse` flags (defaults per ADR-006); add `.github/workflows/app-audit.yml` with `workflow_dispatch` (lighthouse choice input) + paths-filtered PR trigger; extend `package.json` scripts + `Makefile` (`audit-fe`, `app-audit` alias, composite `audit`); update `.gitignore` for the per-run app-audit report files.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `scripts/audit-fe.ts` as a Bun TypeScript script that imports `runAppAudit()` + `writeReport()` from task_18, accepts CLI flags `--trigger=<label>`, `--routes=<csv>`, `--lighthouse`, `--no-lighthouse`, and emits exit code 1 on any `blocker` finding.
- MUST default Lighthouse per ADR-006: ON when `process.env.CI !== "true"`, OFF when `process.env.CI === "true"`. Explicit `--lighthouse` / `--no-lighthouse` overrides the default.
- MUST emit a `[audit-counts] blockers=N majors=N minors=N` machine-readable line to stdout regardless of exit code (mirrors round 2 issue 003 pattern from content-audit).
- MUST add `audit:fe` and `audit` (composite) scripts to `package.json`. The composite `audit` runs `bun run audit:content && bun run audit:fe` sequentially.
- MUST add `audit-fe`, `app-audit` (alias of `audit-fe`), and `audit` (composite) targets to `Makefile`.
- MUST add `docs/_reports/app-audit-*.md` to `.gitignore`.
- MUST create `.github/workflows/app-audit.yml` with: `workflow_dispatch.inputs.lighthouse` (choice `["false", "true"]`, default `"false"`); `pull_request.paths` filter on `app/routes/**`, `app/components/**`, `app/lib/**`, `app/db/schema.ts`; steps that checkout → setup-bun → install → build → spawn preview server → run `bun run audit:fe` with appropriate flag → upload artifacts → post delta-only PR comment via `peter-evans/create-or-update-comment@v4` with `body-includes` using the shared `FINGERPRINT_GREP_LITERAL` pattern.
- MUST NOT block PR merge — this workflow is informational; e2e gate from Phase 1 remains the only merge-blocker.
</requirements>

## Subtasks

- [x] 19.1 Create `scripts/audit-fe.ts` with argv parsing + audit invocation + exit-code logic + `[audit-counts]` line.
- [x] 19.2 Add `audit:fe` + `audit` (composite) scripts to `package.json`.
- [x] 19.3 Add `audit-fe`, `app-audit` (alias), `audit` (composite) targets to `Makefile`.
- [x] 19.4 Update `.gitignore` to include `docs/_reports/app-audit-*.md`.
- [x] 19.5 Create `.github/workflows/app-audit.yml` with all triggers, steps, artifact uploads, and PR-comment integration per ADR-006 fingerprint shape.
- [x] 19.6 Create `app/tests/audit-fe-cli.test.ts` covering argv flag parsing + exit-code logic + Lighthouse default per environment.
- [x] 19.7 Create `app/tests/app-audit-workflow.test.ts` parsing the YAML file and asserting structural invariants.

## Implementation Details

See TechSpec "Build Order Phase 4 — steps 50-53" and "API Endpoints" for surface conventions. The CLI surface mirrors content-audit (`audit-content.ts`); the workflow file mirrors `.github/workflows/content-audit.yml` with the differentiated trigger paths + fingerprint marker.

### Relevant Files

- `app/lib/app-audit/checks.server.ts` (task_18) — `runAppAudit()` invoked by the CLI.
- `app/lib/app-audit/reporter.server.ts` (task_18) — `writeReport()` invoked by the CLI.
- `tests/e2e/audit-fingerprint.ts` (task_16) — `FINGERPRINT_GREP_LITERAL` consumed by the workflow.
- `scripts/audit-content.ts` (task_13) — reference pattern for Bun script shape + `[audit-counts]` emission.
- `.github/workflows/content-audit.yml` (task_14) — reference pattern for workflow structure + delta PR comment.
- `package.json` — scripts block; add `audit:fe` + `audit`.
- `Makefile` — existing targets for `test-e2e`, `lint-tests`, `audit-content`; add `audit-fe`, `app-audit`, `audit`.
- `.gitignore` — existing entries cover content-audit reports; add app-audit.

### Dependent Files

- `.agents/skills/app-audit/SKILL.md` (task_20) — references the CLI command as the canonical invocation.
- `.agents/rules/cicd.md` (task_20) — documents the new workflow + Lighthouse input.

### Related ADRs

- [ADR-005: Revive app-audit as Phase 4](../adrs/adr-005.md) — defines workflow trigger paths + scope.
- [ADR-006: TechSpec implementation primitives for Phase 4](../adrs/adr-006.md) — locks Lighthouse default behavior + fingerprint scheme + workflow input schema.

## Acceptance Criteria

1. **AC-1**: `bun run audit:fe` invoked locally without `CI` env var defaults Lighthouse ON (verified by observing Lighthouse runner invocation in test output).
2. **AC-2**: `CI=true bun run audit:fe` defaults Lighthouse OFF (no Lighthouse runner output).
3. **AC-3**: `bun run audit:fe --no-lighthouse` always skips Lighthouse regardless of `CI` env.
4. **AC-4**: `bun run audit:fe --lighthouse` always runs Lighthouse regardless of `CI` env.
5. **AC-5**: CLI exit code 1 when at least one `blocker` finding produced; exit 0 otherwise.
6. **AC-6**: `[audit-counts]` line emitted on stdout with format `[audit-counts] blockers=N majors=N minors=N`.
7. **AC-7**: `make audit` runs both `audit-content` and `audit-fe` sequentially; non-zero exit if either fails.
8. **AC-8**: `.github/workflows/app-audit.yml` triggers on `workflow_dispatch` (manual; visible in GH Actions UI with `lighthouse` choice input) and on PRs touching the documented paths filter.
9. **AC-9**: A PR touching only `README.md` does NOT trigger the app-audit workflow (paths filter exclusion works).
10. **AC-10**: PR comment uses literal `body-includes: ${FINGERPRINT_GREP_LITERAL}app:` (no regex semantics; collision with content-audit fingerprint impossible).

## Deliverables

- New file `scripts/audit-fe.ts`.
- New file `.github/workflows/app-audit.yml`.
- Modified `package.json` (2 new scripts).
- Modified `Makefile` (3 new targets).
- Modified `.gitignore` (1 new pattern).
- New file `app/tests/audit-fe-cli.test.ts`.
- New file `app/tests/app-audit-workflow.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for end-to-end CLI run + workflow YAML validity **(REQUIRED)**.

## Tests

- Unit tests:
  - [ ] Argv parsing: `--trigger=foo` is captured; default is `"manual"`.
  - [ ] Argv parsing: `--routes=/a,/b` is parsed into array `["/a", "/b"]`; default is undefined (uses full inventory).
  - [ ] Argv parsing: `--lighthouse` returns `true`; `--no-lighthouse` returns `false`; neither flag with `CI=true` returns `false`; neither flag without `CI` returns `true`.
  - [ ] Exit code: at least one `blocker` finding → `process.exit(1)`; no blockers → `process.exit(0)`.
  - [ ] Stdout: `[audit-counts] blockers=N majors=N minors=N` line present in all invocations.
  - [ ] Workflow YAML parse: triggers include `workflow_dispatch` (with `lighthouse: choice` input default `"false"`) + `pull_request` (paths filter).
  - [ ] Workflow YAML parse: `peter-evans/create-or-update-comment@v4` step present with `body-includes` value starting with `<!-- audit-fingerprint:app:`.
  - [ ] Workflow YAML parse: `actions/upload-artifact@v4` step references `docs/_reports/app-audit-*.md`.
- Integration tests:
  - [ ] `bun run audit:fe` against fixture site (no blockers) exits 0 with `[audit-counts] blockers=0` in stdout.
  - [ ] `bun run audit:fe` against fixture with injected console-error (blocker) exits 1 with `blockers=1` in stdout.
  - [ ] `make audit` end-to-end: both audit scripts run sequentially; SUMMARY.md receives 2 new rows (one `content`, one `app`).
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `scripts/audit-fe.ts`.
- CLI completes in <90s without Lighthouse, <5min with Lighthouse.
- Workflow fires only on path-matched PRs (verified on a fixture branch in task_20's checkpoint).
