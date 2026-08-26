# Bun Test Revalidation Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: activate it by name and
follow its Execute flow, per-task gates, atomic commits, traceability updates,
independent verifier, and discrimination sensor.

**Design**: `.specs/features/bun-test-revalidation/design.md`
**Status**: Approved / In Progress

The user approved autonomous execution. Implementation batches use Luna high;
the fresh final verifier uses Sol medium. Official Bun documentation is the
technical source; Context7 was attempted first and was quota-limited.

## Test Coverage Matrix

> Generated from `AGENTS.md`, `.agents/rules/testing.md`,
> `.agents/rules/cicd.md`, `package.json`, `vitest.config.ts`, the historical
> candidate at `711f18d`, and representative tests in both trees.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Inventory/profile/benchmark domain logic | unit | All branches; 1:1 to BTRV ACs; mismatch, exclusion, process-tree RSS and report edge cases | `app/tests/*bun-test-revalidation*.test.ts` and Bun twins where compatible | focused Vitest and Bun Test routes |
| Canonical product suite | unit/integration/component | Existing inventory and outcomes preserved | `app/tests/**/*.test.ts?(x)` | `bun run test:vitest:bun` |
| Native candidate suite | unit/integration/component | One candidate per canonical product test or explicit evidence-backed disposition; native mocks/hooks/DOM cleanup | `app/tests-bun/**/*.test.ts?(x)` | controlled `bun test` profiles |
| Runner/config scripts | integration | Exact runtime, runner, worker, isolation, timeout and environment provenance | `scripts/*bun-test*.ts` | focused script tests plus smoke commands |
| Benchmark reports/spec/docs | none | Structural validators, raw/summary agreement and non-overwriting evidence | `.specs/**`, `docs/benchmarks/bun-test-revalidation/**` | build gate |
| Playwright | none for this feature | Existing E2E boundary unchanged | `tests/e2e/**` | final regression gate only |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Domain/script task | `bun run test:vitest:bun -- <focused-files> && bunx biome check <changed-files> && bunx tsc --noEmit` |
| Candidate | Candidate cohort task | `TZ=UTC bun test <candidate-files> --isolate && bun run test:parity` |
| Full | Suite/profile task | `bun run test:vitest:bun && TZ=UTC bun run test:bun:parity && bun run test:parity` |
| Build | Phase completion | `bun run lint && bunx tsc --noEmit && bun run build && bun run lint:tests` |
| Final | Before validation | full + build + selected benchmark fixture + unchanged Playwright Chromium smoke |

## Execution Plan

Phases and their tasks run sequentially.

### Phase 1: Rebuild trustworthy suites

```text
T1 → T2 → T3
```

### Phase 2: Controlled execution and evidence

```text
T3 → T4 → T5 → T6
```

### Phase 3: Long measurement and decision

```text
T6 → T7 → T8 → T9
```

## Task Breakdown

### T1: Restore the Bun-first candidate tree

**What**: Recover the product-test candidate tree from `711f18d` without restoring retired CI/shadow policy.
**Where**: `app/tests-bun/`
**Depends on**: None
**Reuses**: Git object `711f18d:app/tests-bun`
**Requirement**: BTRV-01

**Done when**:

- [x] Candidate product tests and fixtures are restored as a separate tree
- [x] Historical benchmark/shadow tests are excluded or clearly classified as experiment infrastructure
- [x] Imports resolve against current application code
- [x] Candidate smoke inventory is documented
- [x] Candidate gate passes for a representative pure file

**Tests**: candidate smoke/inventory
**Gate**: candidate
**Commit**: `test(bun): restore native candidate suite`

**Status**: ✅ Complete. The representative smoke and full isolated candidate
run are green; outcome parity remains a T4 responsibility.

### T2: Add scoped Bun DOM environment

**What**: Restore and harden the Bun-first Happy DOM helper with deterministic cleanup and native web-API preservation.
**Where**: `app/tests-bun/happydom.ts`
**Depends on**: T1
**Reuses**: historical helper and official Bun DOM guidance
**Requirement**: BTRV-02

**Done when**:

- [x] Only DOM-bearing files load Happy DOM
- [x] Bun-native `Request`, `Response`, and `Headers` remain available to server tests
- [x] RTL/body/global cleanup passes repeated-run tests
- [x] Required browser shims are minimal and tested
- [x] DOM cohort smoke and quick gate pass

**Tests**: component/integration
**Gate**: candidate
**Commit**: `test(bun): scope happy dom environment`

**Status**: ✅ Complete. The 30-file DOM cohort passes in isolated mode, and
the TypeScript/Biome gates are green.

### T3: Audit candidate native semantics

**What**: Adapt mocks, spies, timers, lifecycle hooks and resource cleanup in the candidate tree to current Bun 1.4 semantics.
**Where**: `app/tests-bun/`
**Depends on**: T2
**Reuses**: official lifecycle, mocks and dates/times documentation
**Requirement**: BTRV-01, BTRV-02

**Done when**:

- [x] Module mocks avoid unintended pre-mock side effects
- [x] Spies, mocks and fake timers restore after tests
- [x] Hook/test timeouts preserve canonical intent
- [x] Environment, database, filesystem, port and subprocess state is isolated or cleaned
- [x] Normal, repeated and reversed-order cohort probes pass or produce explicit dispositions
- [x] Full candidate compatibility run completes with stable outcomes

**Tests**: unit/integration/component
**Gate**: full
**Commit**: `test(bun): align candidate with bun semantics`

**Status**: ✅ Complete. Normal, repeated and reverse isolated runs each pass
2,057 tests with 101 documented environment skips and no failures.

### T4: Restore an outcome-aware parity gate

**What**: Implement deterministic static inventory and runtime-outcome comparison for the two suites.
**Where**: `app/lib/test-migration/parity.ts`
**Depends on**: T3
**Reuses**: historical parity analyzer, TypeScript parser, runner summaries
**Requirement**: BTRV-04

**Done when**:

- [x] Relative files, leaf tests, assertions, fixtures and dispositions are deterministic
- [x] Missing/lower candidate inventory fails precisely
- [x] Runtime file/test/pass/fail/skip/todo differences invalidate comparison
- [x] DOM environment and residual Vitest API mismatches are detected
- [x] All branches and listed mismatch edge cases have tests

**Tests**: unit
**Gate**: quick
**Commit**: `test(bun): add outcome parity gate`

**Status**: ✅ Complete. Static inventories now include deterministic leaf
identities, fixture coverage, lifecycle hooks, resource semantics, mock export
checks and explicit infrastructure dispositions. Runtime outcome comparison
covers file/test/pass/fail/skip/todo counts and optional leaf identities.

### T5: Add controlled runner profiles

**What**: Add explicit package routes for matched workers, isolation, no-isolate probes and memory-first execution while preserving `test`.
**Where**: `package.json`
**Depends on**: T4
**Reuses**: current runtime guard and official Bun/Vitest CLI options
**Requirement**: BTRV-03, BTRV-08

**Done when**:

- [x] `test` remains Bun-hosted Vitest
- [x] One-worker and bounded isolated profiles have explicit stable meanings
- [x] `--no-isolate` and `--smol` are opt-in experiment routes
- [x] All controlled routes fix `TZ=UTC` and prove runtime provenance
- [x] Static package-script tests and smoke commands pass

**Tests**: integration
**Gate**: full
**Commit**: `test(bun): add controlled runner profiles`

**Status**: ✅ Complete. Added matched Vitest worker profiles, isolated and
shared Bun Test probes, a separate `--smol` route, deterministic UTC setup and
runner provenance checks. The default `test` script remains unchanged.

### T6: Implement the revalidation benchmark harness

**What**: Build an interleaved, warm-up-aware process-tree benchmark and non-overwriting report writer.
**Where**: `app/lib/test-bench/revalidation.ts`
**Depends on**: T5
**Reuses**: neutral Vitest parser and historical benchmark provenance patterns
**Requirement**: BTRV-04, BTRV-05, BTRV-06, BTRV-07

**Done when**:

- [x] Warm-up is discarded and measured arm order rotates
- [x] Complete process-tree peak RSS, wall time, load and provenance are recorded
- [x] Inventory/outcome mismatch and contaminated samples invalidate/exclude correctly
- [x] Median and spread are derived from valid samples
- [x] Reports are unique JSON/Markdown and agree exactly
- [x] Unit/integration fixture tests cover success, failure, timeout and invalidation

**Tests**: unit/integration
**Gate**: full
**Commit**: `test(bun): add controlled benchmark harness`

**Status**: ✅ Complete. The harness executes interleaved arms with one retained
warmup per arm, records process-tree RSS/provenance/load, excludes and retains
contaminated or failed samples, invalidates outcome mismatches, aggregates
median/spread, and writes unique JSON/Markdown reports. The thin CLI supports
profile selection and repetition count without changing the default test route.

### T7: Screen cohorts and select finalists

**What**: Generate per-file timings, classify cohorts and screen safe execution profiles.
**Where**: `docs/benchmarks/bun-test-revalidation/cohort-screening.md`
**Depends on**: T6
**Reuses**: parity manifest and benchmark harness
**Requirement**: BTRV-02, BTRV-03, BTRV-04

**Done when**:

- [x] Pure, DOM, mocks/timers and integration/infra cohorts are reproducible
- [x] Representative light/medium/heavy files are identified from timings
- [x] Matched 1/2/4-worker isolated profiles are screened
- [x] No-isolate runs only for cohorts that pass repeated/reversed/randomized probes
- [x] `--smol` receives a memory-oriented screen
- [x] Invalid/dominated profiles and finalist rationale are recorded

**Tests**: integration/benchmark evidence
**Gate**: full
**Commit**: `docs(test): record bun cohort screening`

**Status**: ✅ Complete. All 113 candidate files were timed successfully and
classified into four reproducible cohorts. Representative 1/2/4-worker
isolated screens and a separate `--smol` screen are recorded. Repeated,
reversed and seeded-random `--no-isolate` probes promoted only the pure cohort;
DOM, mocks/timers and integration/infra were rejected for state/resource
leaks. The first full-suite screen is retained as contaminated/failed evidence
and is not used as a winner.

### T8: Run the full finalist benchmark

**What**: Execute and preserve the long controlled full-suite measurement for all valid finalists.
**Where**: `docs/benchmarks/bun-test-revalidation/runs/`
**Depends on**: T7
**Reuses**: benchmark harness and selected profiles
**Requirement**: BTRV-04, BTRV-05, BTRV-06, BTRV-07

**Done when**:

- [x] Each finalist has one discarded warm-up and at least five interleaved samples
- [x] Raw provenance, time, process-tree RSS, inventory and outcomes are complete
- [x] Contaminated/failed runs are retained and excluded explicitly
- [x] All compared finalists have equivalent inventories/outcomes
- [x] JSON and Markdown artifacts are non-overwriting and internally consistent

**Tests**: full benchmark evidence
**Gate**: final
**Commit**: `docs(test): record bun test revalidation runs`

**Status**: ✅ Complete. The final matrix is summarized in
`docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md` and links four
raw JSON/Markdown pairs. Isolated-1, isolated-2, isolated-4, and Bun
`--smol`-2 each have one discarded warmup and five valid interleaved samples
per arm. Every valid sample reports the complete 113-file product inventory,
2,057 pass, 84 equal environmental skips, and zero failures; contaminated
attempts are retained and excluded in the raw artifacts.

### T9: Record the runner decision

**What**: Summarize compatibility, memory, time, maintenance and CI implications and update active project decisions.
**Where**: `docs/benchmarks/bun-test-revalidation/README.md`
**Depends on**: T8
**Reuses**: raw run artifacts and AD-004
**Requirement**: BTRV-06, BTRV-07, BTRV-08

**Done when**:

- [x] Summary reports medians/spread and links every material claim to raw evidence
- [x] Multi-worktree memory recommendation is explicit
- [x] Matched-profile and best-safe-profile conclusions are separate
- [x] Maintenance and future CI implications are documented
- [x] `.specs/STATE.md` preserves or supersedes AD-004 consistently
- [x] Full local gates pass before independent verification

**Tests**: documentation/decision consistency
**Gate**: final
**Commit**: `docs(test): decide native bun test adoption`

**Status**: ✅ Complete. The complete matrix favors Bun Test for elapsed time at
isolated-1, isolated-2, and `--smol`-2, while Vitest is faster at isolated-4
and has the lower peak RSS at 1/2 workers. AD-004 remains active: defaults, CI,
and Playwright remain unchanged. Explicit Bun routes are retained as reversible
local candidates, and the profile-scoped recommendation plus RSS·time,
time-to-release, and throughput evidence is recorded in
`docs/benchmarks/bun-test-revalidation/README.md`.

## Diagram-Definition Cross-Check

| Task | Diagram predecessor | `Depends on` | Result |
| --- | --- | --- | --- |
| T1 | None | None | ✅ |
| T2 | T1 | T1 | ✅ |
| T3 | T2 | T2 | ✅ |
| T4 | T3 | T3 | ✅ |
| T5 | T4 | T4 | ✅ |
| T6 | T5 | T5 | ✅ |
| T7 | T6 | T6 | ✅ |
| T8 | T7 | T7 | ✅ |
| T9 | T8 | T8 | ✅ |

## Test Co-location Validation

| Task | Layer | Required tests | Co-located in task | Result |
| --- | --- | --- | --- | --- |
| T1 | candidate suite | smoke/inventory | yes | ✅ |
| T2 | DOM environment | component/integration | yes | ✅ |
| T3 | candidate suite | all affected types | yes | ✅ |
| T4 | domain logic | unit all branches | yes | ✅ |
| T5 | scripts/config | integration/static | yes | ✅ |
| T6 | domain/process | unit/integration all branches | yes | ✅ |
| T7 | evidence | integration benchmark | yes | ✅ |
| T8 | evidence | full benchmark | yes | ✅ |
| T9 | docs/decision | consistency and final gates | yes | ✅ |
