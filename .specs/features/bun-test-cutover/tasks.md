# Bun Test Cutover Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: activate it by name and
follow its Execute flow and Critical Rules.

**Design**: `.specs/features/bun-test-cutover/design.md`
**Status**: Approved

## Test Coverage Matrix

> Generated from `.agents/rules/testing.md`, `.agents/rules/cicd.md`, existing
> Bun Test candidates, and CI/package contracts.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Product/domain/component | unit + integration | Preserve all 113 validated files and outcomes | `app/tests/**/*.test.ts(x)` | `bun run test` |
| Test/benchmark infrastructure | unit | Preserve all 20 active files; remove only runner-comparison assertions | `app/tests/bench-*.test.ts`, contract tests | `bun run test` |
| CI/package configuration | unit + build | Assert Bun Test default, no Vitest routes, Playwright boundary unchanged | `app/tests/{ci-runtime-contract,test-scripts}.test.ts` | `bun run test` |
| Browser E2E | e2e | Existing Chromium suite passes; Firefox/WebKit remain configured | `tests/e2e/*.spec.ts` | `bun run test:e2e` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Port/config task | `bun run test` |
| Full | Browser-boundary task | `bun run test && bun run test:e2e` |
| Build | Phase completion | `bun run lint && bunx tsc --noEmit && bun run test && bun run build && bun run lint:tests && bun run test:e2e` |

## Execution Plan

### Phase 1: Canonical suite

```text
T1 -> T2 -> T3
```

### Phase 2: Integration and records

```text
T3 -> T4 -> T5 -> T6
```

## Task Breakdown

### T1: Port active infrastructure tests

**What**: Add native `bun:test` versions of the 20 still-useful infrastructure tests and trim the revalidation-only half of the mixed runner test.
**Where**: `app/tests-bun/`
**Depends on**: None
**Reuses**: Existing Vitest tests and Bun Test porting conventions.
**Requirement**: BTC-02, BTC-05
**Tools**: Bun, filesystem
**Done when**:
- [x] The candidate contains 133 test files.
- [x] Every active infrastructure test imports from `bun:test`.
- [x] Focused candidate suite passes with zero failures (2,263 pass, 101 environmental/raw skips).
**Tests**: unit
**Gate**: quick
**Commit**: `test(bun): port active infrastructure coverage`

### T2: Remove obsolete comparison machinery

**What**: Delete Vitest parity/revalidation-only libraries and scripts while retaining generic benchmark and database helpers.
**Where**: `app/lib/`
**Depends on**: T1
**Reuses**: Versioned reports under `docs/benchmarks/` as the historical record.
**Requirement**: BTC-03
**Tools**: filesystem
**Done when**:
- [x] No live import references the deleted parity/revalidation modules.
- [x] Historical reports remain unchanged.
- [x] Transitional 133-file gate passes (2,263 pass, 84 normalized skips, zero failures).
**Tests**: unit
**Gate**: quick
**Commit**: `refactor(test): remove retired runner comparison harness`

### T3: Promote Bun Test and remove Vitest

**What**: Make the Bun-first tree canonical, switch scripts/config/runtime provenance, and remove Vitest/jsdom dependencies and config.
**Where**: `app/tests/`
**Depends on**: T2
**Reuses**: HappyDOM preload and the measured isolated two-worker profile.
**Requirement**: BTC-01, BTC-03, BTC-04
**Tools**: Bun, filesystem
**Done when**:
- [x] `bun run test` runs `app/tests` through Bun Test with two isolated workers.
- [x] 133 files pass with zero failures (2,256 pass, 101 raw skips).
- [x] Vitest/jsdom/config/package routes are absent.
- [x] `bun install --frozen-lockfile` succeeds after lockfile regeneration.
**Tests**: unit + integration
**Gate**: quick
**Commit**: `test(bun): make native runner canonical`

**Test-count note**: Seven runner-only leaves were removed when Vitest profile,
parity, and rollback assertions became impossible by design. All 113 product
files and 20 active infrastructure files remain represented.

### T4: Update blocking CI contracts

**What**: Update Make/GitHub Actions contracts and their Bun Test assertions without changing workflow topology.
**Where**: `.github/workflows/`
**Depends on**: T3
**Reuses**: Existing `make test` quality matrix entry and Playwright commands.
**Requirement**: BTC-01, BTC-05
**Tools**: Bun, filesystem
**Done when**:
- [ ] CI text and contract tests identify Bun Test as the blocking runner.
- [ ] Playwright stays Bun-driven with the Node fallback.
- [ ] Full gate passes.
**Tests**: unit + e2e
**Gate**: full
**Commit**: `ci(test): run native Bun Test by default`

### T5: Reconcile living documentation and decisions

**What**: Supersede the old Vitest decisions and update rules, README, benchmark amendment, handoff, and migration posts.
**Where**: `docs/`
**Depends on**: T4
**Reuses**: Existing controlled benchmark tables and browser report.
**Requirement**: BTC-06
**Tools**: filesystem
**Done when**:
- [ ] AD-003 and AD-004 are superseded by a new active decision.
- [ ] Living docs call Bun Test canonical and preserve historical numbers.
- [ ] Direct five-route WebView/Playwright comparison discloses scope and lifecycle differences.
- [ ] Documentation checks pass.
**Tests**: unit
**Gate**: quick
**Commit**: `docs(test): record native Bun Test cutover`

### T6: Run final local CI gate

**What**: Execute all local merge gates and record the fresh results for independent verification.
**Where**: `.specs/features/bun-test-cutover/`
**Depends on**: T5
**Reuses**: Project Make/package gates.
**Requirement**: BTC-01, BTC-02, BTC-03, BTC-04, BTC-05, BTC-06
**Tools**: Bun, Playwright
**Done when**:
- [ ] Lint, typecheck, 133-file Bun Test, build, annotation lint, and Chromium E2E pass.
- [ ] Test counts/skips are recorded with justification.
- [ ] Independent verifier returns PASS.
**Tests**: unit + integration + e2e
**Gate**: build
**Commit**: `docs(test): record Bun Test cutover validation`

## Phase Execution Map

```text
Phase 1 -> Phase 2
T1 -> T2 -> T3 -> T4 -> T5 -> T6
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | One test-inventory port | Granular |
| T2 | One retired harness removal | Granular |
| T3 | One runner cutover | Granular |
| T4 | One CI contract update | Granular |
| T5 | One decision/documentation reconciliation | Granular |
| T6 | One final evidence gate | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Start | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |
| T5 | T4 | T4 -> T5 | Match |
| T6 | T5 | T5 -> T6 | Match |

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | infrastructure tests | unit | unit | OK |
| T2 | runner support | unit | unit | OK |
| T3 | test runner/config | unit + integration | unit + integration | OK |
| T4 | CI/browser boundary | unit + e2e | unit + e2e | OK |
| T5 | documented contracts | unit | unit | OK |
| T6 | all changed layers | build gate | unit + integration + e2e | OK |
