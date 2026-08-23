# Bun Migration Follow-up Specification

**Execution status**: T8 complete; T9–T10 pending.

## Problem Statement

The Bun runtime cutover is merged, but local memory tuning, Bun Test skip
accounting, complete Playwright runtime evidence, cross-browser validation, and
publication-ready documentation remain incomplete. This follow-up closes those
gaps without removing the Node 24 and Vitest rollback paths prematurely.

## Goals

- [x] Produce reproducible, persisted runtime and worker benchmarks.
- [ ] Provide a low-memory local test profile for multi-worktree development.
- [ ] Explain and remove the five-result Bun Test skip discrepancy without losing coverage.
- [x] Validate the full Playwright suite in Chromium, Firefox, and WebKit.
- [ ] Publish a bilingual engineering post backed by committed evidence.
- [ ] Leave explicit, testable criteria for the eventual Vitest removal.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Replace Vitest now | Bun Test has not completed ten valid shadow runs. |
| Remove Node from the entire toolchain | Node remains a Playwright and unit-test rollback path. |
| Change GitHub Actions browser matrix | CI structure will be decided after local cross-browser evidence. |
| Restore Bun.WebView | The experiment is retired and preserved only as evidence. |
| Push or delete remote branches | Remote mutations require a separate explicit action. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Benchmark sample size | One discarded warmup plus five measured runs per profile/arm | Enough samples for a median while keeping the local run bounded. | y |
| Noisy host handling | Preserve raw samples but suppress conclusions when the comparison is invalid | Multi-worktree load must not become a false performance claim. | y |
| Local test priority | Select a passing profile with the lowest practical memory cost; prefer reliability when RSS is effectively tied | The two-worker RSS median was only 2.0 MiB (0.12%) lower, while a fresh run exposed a port/PID race. | y |
| Browser concurrency | Keep one Playwright worker | Existing project constraint and 2-vCPU CI target. | y |
| Bun Test discrepancy | Fix missed coverage if present; otherwise normalize runner accounting and document it | Tests must not be changed only to manipulate summary counts. | y |
| Existing historical evidence | Preserve and label it instead of deleting it | Published metrics require an audit trail. | y |

**Open questions:** none - all resolved or logged above.

## User Stories

### P1: Low-memory local testing

**User Story**: As a developer using several worktrees, I want a measured low-memory test profile so that parallel work does not exhaust the machine.

**Acceptance Criteria**:

1. WHEN the worker benchmark runs THEN the system SHALL execute Bun 1.4 plus Vitest with `1`, `2`, `4`, and omitted `--maxWorkers` profiles.
2. WHEN each worker profile is measured THEN the system SHALL discard one warmup and persist five measured samples with duration, process-group peak RSS, load, command, versions, and outcome counts.
3. IF any measured sample fails, times out, changes the test outcome, or has a missing summary THEN the system SHALL mark that profile `memoryValid: false`, persist profile-specific reasons, and exclude only that profile from memory-winner selection; `validMemoryComparison` SHALL be true only when at least two `memoryValid` profiles have equivalent outcomes. IF ambient load exceeds the documented host-load validity bound, or any selected profile is memory-invalid, THEN the system SHALL mark timing comparison invalid. The system SHALL publish an overall winner only when memory and timing comparisons are valid, while retaining a memory winner from the remaining valid profiles when memory comparison alone is valid.
4. WHEN the benchmark has valid results THEN the system SHALL map `test:local` to a passing profile with the lowest practical median peak RSS; when medians are effectively tied, it SHALL prefer the more reliable serialized profile, and SHALL leave `test` unchanged.

**Independent Test**: Run the worker benchmark, inspect its JSON/Markdown, then run `bun run test:local` and the default test command.

### P1: Bun Test outcome parity

**User Story**: As a maintainer, I want the five extra Bun Test skips explained and resolved so that shadow evidence measures equivalent outcomes.

**Acceptance Criteria**:

1. WHEN Vitest and Bun Test outcomes are compared THEN the system SHALL distinguish skipped leaf tests from runner-only skipped suite accounting.
2. IF the five additional skips represent unexecuted leaf tests THEN the system SHALL restore their execution without deleting or weakening tests.
3. IF the five additional skips are runner-only suite accounting THEN the system SHALL compare equivalent leaf outcomes and SHALL preserve the raw runner count in evidence.
4. The system SHALL keep static source/assertion parity as a separate prerequisite for any outcome comparison.

**Independent Test**: Run parity plus both runners and verify equal passed/failed leaf outcomes with the raw skip difference explained.

### P1: Complete Playwright evidence

**User Story**: As a maintainer, I want direct Node 24 versus Bun 1.4 Playwright metrics and three-browser results so that the runtime choice is evidence-based.

**Acceptance Criteria**:

1. WHEN the E2E runtime benchmark runs THEN the system SHALL compare Node 24 plus Playwright and Bun 1.4 plus Playwright against the same built app, Bun web server, Chromium suite, one worker, and zero retries.
2. WHEN each E2E arm is measured THEN the system SHALL discard one warmup and persist five interleaved samples with duration, process-group peak RSS, load, versions, browser, and Playwright outcome counts.
3. IF an E2E sample has failed, skipped, flaky, unexpected, timed-out, or different inventory THEN the system SHALL mark the comparison invalid and SHALL publish no winner.
4. WHEN Playwright configuration is validated THEN the system SHALL define `chromium`, `firefox`, and `webkit` projects with the existing authenticated setup dependency.
5. WHEN each browser project runs locally THEN the system SHALL complete the full applicable suite with zero unexpected failures and one worker.

**Independent Test**: Run the persisted runtime benchmark and each named Playwright project.

### P2: Cutover readiness and evidence publication

**User Story**: As a future maintainer and reader, I want one current decision record and a technical post so that the migration can be understood and safely continued.

**Acceptance Criteria**:

1. WHEN migration documentation is audited THEN the system SHALL mark completed specs correctly, preserve historical benchmark evidence, and remove or label obsolete executable guidance.
2. WHEN Bun Test readiness is evaluated THEN the system SHALL require ten valid consecutive shadow runs on distinct commits with parity and equivalent leaf outcomes.
3. IF fewer than ten valid shadow runs exist THEN the system SHALL retain Vitest, Node fallback scripts, and the canonical `app/tests` tree.
4. WHEN the post is produced THEN the system SHALL publish English and Brazilian Portuguese versions with matching claims, links to committed raw evidence, limitations, warmup treatment, and the final stack decision.

**Independent Test**: Run the shadow eligibility tests, content audit, link/frontmatter checks, and inspect all cited benchmark files.

## Edge Cases

- IF another worktree keeps the host load above the validity bound THEN the system SHALL retain the run as diagnostic evidence and SHALL not claim a performance winner.
- IF Firefox or WebKit exposes a genuine browser incompatibility THEN the system SHALL fix the application or test root cause without browser-specific assertion weakening.
- IF a branch is checked out by another worktree THEN the cleanup audit SHALL preserve it and record why.
- IF a historical document describes an old stack state THEN the system SHALL label it historical rather than rewriting measured history.

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BMF-01 | P1: Low-memory local testing | T2 → T3 → T4 | Complete |
| BMF-02 | P1: Bun Test outcome parity | T1 | Complete |
| BMF-03 | P1: Complete Playwright evidence | T5 → T6 → T7 | Complete; cross-browser evidence persisted |
| BMF-04 | P2: Cutover readiness and evidence publication | T8 → T9 → T10 | In progress |

**Coverage:** 4 total, 4 mapped to tasks, 0 unmapped.

## Success Criteria

- [ ] `main` is aligned to `origin/main` with a recoverable backup reference.
- [x] `test:local` passes under the operationally reliable serialized profile; its measured RSS median is effectively tied with the mathematical memory winner.
- [ ] Bun Test skip discrepancy has outcome-level evidence and no lost test coverage.
- [x] Node/Bun Playwright comparison has five valid samples per arm or an explicit invalid verdict. [Evidence: JSON](../../docs/benchmarks/e2e-runtimes/runtimes-2026-08-23T08-20-02-241Z.json) · [report](../../docs/benchmarks/e2e-runtimes/runtimes-2026-08-23T08-20-02-241Z.md)
- [x] Chromium, Firefox, and WebKit project runs have persisted results. [Evidence](../../docs/benchmarks/e2e-browsers/2026-08-23-summary.md)
- [ ] Migration docs, cutover criteria, and bilingual post pass project gates.
