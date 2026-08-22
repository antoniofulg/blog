# Bun Native Test Runner Migration Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name
and follow its Execute flow and Critical Rules.** Do not proceed without the
per-task gate, atomic commit, traceability update, and final independent
Verifier.

**Design**: `.specs/features/bun-native-test-runner/design.md`
**Status**: In Progress

### Validation fix: isolate DOM setup

The candidate no longer uses a global happy-dom preload. Each DOM-bearing
`app/tests-bun` file imports `./happydom`; server, database, watcher, and
subprocess tests keep Bun-native `Request`, `Response`, and `Headers`.

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found:
> `AGENTS.md`, `.agents/rules/testing.md`, `.agents/rules/cicd.md`,
> `vite.config.ts`, `bunfig.toml`, `package.json`, and `Makefile`. Samples:
> `app/tests/bench-runner.test.ts`, `bench-matrix.test.ts`, `biome.test.ts`,
> `post-enhancements.test.ts`, `watcher-integ.test.ts`, and matching Bun twins.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure migration logic (provenance, parity, cohorts, parsers, shadow history) | unit | All branches; 1:1 to BTR ACs; every listed edge case | `app/tests/*test-{runtime,migration,bench,shadow}*.test.ts` and Bun twins | reference Vitest file + matching `bun test` file |
| Process orchestration (A/B/C runner) | integration | Correct executable/version, ordering, timeout cleanup, result parsing, failure continuation | `app/tests/test-bench-*.test.ts` and Bun twins | reference Vitest file + matching `bun test` file |
| Existing candidate unit/component tests | unit | Same test declarations and assertion count as reference; exact asserted outcomes preserved | `app/tests-bun/*.test.ts`, `*.test.tsx` | `bun test <files>` plus parity gate |
| Existing candidate integration/infra tests | integration | Same lifecycle and external-state outcomes as reference; no leaked DB/fs/env/timer/subprocess state | `app/tests-bun/*{integ,harness,workflow,audit}*.test.ts` | cohort Bun Test plus reference files |
| CI/package/config | unit | Static assertions for exact scripts, versions, blocking semantics, artifact retention, and Playwright boundary | `app/tests/{ci-workflow,biome,makefile,test-migration}.test.ts` and Bun twins | reference Vitest file + matching `bun test` file |
| Thin CLI wrappers | none | Build gate; behavior resides in tested lib modules | `scripts/*.ts` | build gate only |
| Documentation/spec artifacts | none | Structural validators, links, and documented commands agree with implementation | `.specs/**`, `docs/benchmarks/bun-test/**`, `.agents/rules/**` | build gate only |
| Playwright E2E | e2e | Existing 49-test Chromium inventory, workers=1, Node runner and Bun web server unchanged | `tests/e2e/*.spec.ts` | `make test-e2e` |

## Gate Check Commands

> Node 24 gates use the explicit `test:vitest:node` script. If local Node is
> not 24, the provenance guard fails with an install hint; CI pins Node 24.

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | Pure/module task | `bun run test:vitest:node -- <reference-file> && bun test <candidate-file>` |
| Cohort | Candidate migration cohort | `bun run test:parity -- --cohort=<name> && bun run test:bun:cohort <name>` |
| Full | Complete candidate, process, integration, or CI task after T13 | `bun run test:parity && bun run test:vitest:node && bun run test:bun` |
| Build | Phase completion/config/docs | `bun run lint && bunx tsc --noEmit && bun run test:parity && bun run test:vitest:node && bun run test:vitest:bun && bun run test:bun && bun run build && make lint-tests` |
| E2E | Playwright boundary or final verification | `bun run build && make test-e2e` |

---

## Execution Plan

Phases and tasks run strictly sequentially.

### Phase 1: Comparison foundation

Order: T1, T2, T3, T4

```text
T1 → T2
T2 → T3
T3 → T4
```

### Phase 2: Low-risk candidate cohorts

Order: T5, T6, T7

```text
T4 → T5
T5 → T6
T6 → T7
```

### Phase 3: Mock and integration candidate cohorts

Order: T8, T9, T10, T11, T12, T13

```text
T7 → T8
T8 → T9
T9 → T10
T10 → T11
T11 → T12
T12 → T13
```

### Phase 4: Measurement and eligibility

Order: T14, T15, T16, T17, T18

```text
T13 → T14
T14 → T15
T15 → T16
T16 → T17
T17 → T18
```

### Phase 5: CI shadow and handoff

Order: T19, T20

```text
T13 → T19
T18 → T19
T19 → T20
```

---

## Task Breakdown

### T1: Add runtime provenance guard

**What**: Implement runtime/version inspection that fails mislabeled Node/Bun test arms and emits stable provenance.
**Where**: `scripts/check-test-runtime.ts`
**Depends on**: None
**Reuses**: `process.execPath`, `process.versions`, probe documented in `docs/benchmarks/node-vs-bun/README.md`
**Requirement**: BTR-02

**Tools**: MCP: Context7 for Bun runtime semantics — Skill: Bun, ponytail

**Done when**:

- [x] Guard distinguishes Node from Bun without relying only on executable filename
- [x] Exact Node major 24 and Bun version 1.4.0 are enforced
- [x] Failure names expected version, detected version, and executable path
- [x] Machine-readable provenance includes runtime, version, executable, runner, and runner version
- [x] Reference and candidate unit tests cover correct runtime, mismatch, and malformed expectation
- [x] Gate check passes for both test files
- [x] Test count: 8 new tests pass; no reference count decreases

**Tests**: unit
**Gate**: quick

**Commit**: `feat(test): add runtime provenance guard`

---

### T2: Wire explicit A/B/C package scripts

**What**: Add stable scripts for Vitest/Node 24, Vitest/Bun 1.4, and Bun Test/Bun 1.4 while keeping `test` on the reference.
**Where**: `package.json`
**Depends on**: T1
**Reuses**: installed Vitest entry point, existing `bunfig.toml` candidate root
**Requirement**: BTR-01, BTR-02

**Tools**: MCP: Context7 — Skill: Bun, ponytail

**Done when**:

- [x] `test:vitest:node`, `test:vitest:bun`, and `test:bun` exist with explicit runtimes
- [x] `test` delegates to `test:vitest:node`
- [x] Candidate Bun timeout is explicit and justified by existing integration budgets
- [x] Dependency versions remain pinned
- [x] Static reference and candidate tests assert exact script semantics
- [x] Gate check passes
- [x] Test count: 5 new/updated script assertions pass in both runners

**Tests**: unit
**Gate**: build

**Commit**: `chore(test): add parallel node and bun test scripts`

---

### T3: Implement AST test parity analyzer

**What**: Compare twin test trees by relative path, test declarations, assertions, fixtures, forbidden omission markers, and explicit dispositions.
**Where**: `app/lib/test-migration/parity.ts`
**Depends on**: T2
**Reuses**: installed TypeScript compiler API and project test path conventions
**Requirement**: BTR-03, BTR-04

**Tools**: MCP: NONE — Skill: typescript-advanced, ponytail

**Done when**:

- [x] Analyzer returns deterministic inventories sorted by relative path
- [x] Missing twin, missing fixture, lower test/assertion count, residual Vitest API, and omission marker each fail with a precise reason
- [x] Explicit Vitest-only disposition requires file, reason, evidence, and owner/follow-up
- [x] Invalid or stale dispositions fail
- [x] Reference and Bun twin unit tests cover every branch and edge case
- [x] Gate check passes
- [x] Test count: 12 new tests pass in each runner

**Tests**: unit
**Gate**: quick

**Commit**: `feat(test): add test tree parity analyzer`

---

### T4: Add parity and cohort CLI

**What**: Expose parity and deterministic cohort selection through package scripts without moving test files.
**Where**: `scripts/check-test-parity.ts`
**Depends on**: T3
**Reuses**: parity analyzer, existing thin-script convention
**Requirement**: BTR-03, BTR-04

**Tools**: MCP: NONE — Skill: Bun, ponytail

**Done when**:

- [x] `test:parity` checks the full twin inventory
- [x] Cohorts classify as pure, DOM, mocks/timers, or integration/infra using source evidence
- [x] `test:bun:cohort -- <name>` runs only the selected deterministic file list
- [x] Unknown/empty cohorts fail with known names
- [x] Reference and candidate tests cover classification and CLI argument behavior
- [x] Gate check passes
- [x] Test count: 8 new tests pass in each runner

**Tests**: unit
**Gate**: quick

**Commit**: `feat(test): add parity and cohort commands`

---

### T5: Stabilize Bun DOM setup and fixtures

**What**: Make the candidate tree parse, typecheck, lint, load required fixtures, and expose only required happy-dom shims.
**Where**: `app/tests-bun/`
**Depends on**: T4
**Reuses**: reference fixtures under `app/tests/fixtures`, current `happydom.ts`
**Requirement**: BTR-04, BTR-05

**Tools**: MCP: Context7 for Bun DOM behavior — Skill: Bun, no-workarounds, ponytail

**Done when**:

- [x] `@happy-dom/global-registrator` is pinned exactly
- [x] Candidate files parse, typecheck, lint, and format
- [x] Fixture consumers use one verified source instead of missing duplicate paths
- [x] ResizeObserver and matchMedia shims have focused assertions and cleanup
- [x] No production/application behavior changes
- [x] Focused Vitest/Bun fixture and DOM-setup tests plus Biome checks pass
- [x] Test count: setup tests pass and no reference/candidate inventory count decreases

**Tests**: integration
**Gate**: quick

**Commit**: `fix(test): stabilize bun dom setup and fixtures`

---

### T6: Validate pure Bun cohort

**What**: Repair and prove parity for tests without DOM, module mocks, timers, DB, network, filesystem mutation, or subprocesses.
**Where**: `app/tests-bun/`
**Depends on**: T5
**Reuses**: reference assertions and the pure cohort selector
**Requirement**: BTR-03, BTR-04

**Tools**: MCP: NONE — Skill: Bun, no-workarounds, ponytail

**Done when**:

- [x] Every pure candidate file passes individually and as one cohort
- [x] Parity reports equal file, test, and assertion inventories for the cohort
- [x] No reference assertion or test is removed or weakened
- [x] Candidate imports use supported Bun Test APIs
- [x] Cohort gate passes twice consecutively
- [x] Test count: candidate pure count equals reference pure count exactly

**Tests**: unit
**Gate**: cohort

**Commit**: `test(bun): validate pure test cohort`

---

### T7: Validate DOM tests without module mocks

**What**: Prove happy-dom equivalence for the component tests that do not also depend on module mocking.
**Where**: `app/tests-bun/`
**Depends on**: T6
**Reuses**: React Testing Library, happy-dom, reference component assertions
**Requirement**: BTR-04, BTR-05

**Tools**: MCP: Context7 — Skill: Bun, react, no-workarounds, ponytail

**Done when**:

- [x] All 12 DOM-without-mocks files are selected deterministically
- [x] Accessible roles, text, interaction, cleanup, and required shims match reference outcomes
- [x] Real timers and DOM globals are restored after every file
- [x] Cohort passes twice consecutively with exact parity
- [x] No jsdom-only behavior is replaced by a weaker assertion
- [x] Test count: candidate DOM-simple count equals reference count exactly

**Tests**: unit
**Gate**: cohort

**Commit**: `test(bun): validate simple dom cohort`

---

### T8: Validate DOM tests with module mocks

**What**: Restore component behavior for DOM tests that also mock router, locale, charts, server modules, or dynamic imports.
**Where**: `app/tests-bun/`
**Depends on**: T7
**Reuses**: reference Vitest mock factories, React Testing Library, happy-dom
**Requirement**: BTR-04, BTR-05

**Tools**: MCP: Context7 — Skill: Bun, react, no-workarounds, ponytail

**Done when**:

- [x] All 22 DOM+mock files are selected deterministically
- [x] Mock factories export every symbol consumed by the subject
- [x] Partial module behavior uses supported import-original semantics or remains explicitly Vitest-only
- [x] DOM cleanup, mock restoration, and real timers run after each test
- [x] Cohort passes twice consecutively with exact parity
- [x] Test count: candidate DOM+mock count equals reference count exactly

**Tests**: unit
**Gate**: cohort

**Commit**: `test(bun): validate mocked dom cohort`

---

### T9: Validate non-DOM mock and timer tests

**What**: Restore equivalent module mocks, fake timers, async waits, and import-original behavior for the ten non-DOM mock-heavy files.
**Where**: `app/tests-bun/`
**Depends on**: T8
**Reuses**: reference Vitest factories and asserted outcomes
**Requirement**: BTR-04, BTR-05

**Tools**: MCP: Context7 — Skill: Bun, no-workarounds, ponytail

**Done when**:

- [x] `jest.importActual`, unavailable async timer helpers, residual `vi`, and unsupported waits are removed through equivalent APIs
- [x] All six `partial mock skipped` markers are removed only after behavior is restored
- [x] Static imports do not bypass intended `mock.module` factories
- [x] Mocks and timers are restored after each file
- [x] Cohort passes twice consecutively with exact parity
- [x] Test count: candidate non-DOM mock count equals reference count exactly

**Tests**: unit
**Gate**: cohort

**Commit**: `test(bun): validate mocks and timers`

---

### T10: Validate DB, PGLite, and auth integrations

**What**: Restore equivalent database schema/query, PGLite, migration, auth, analytics-recording, and seeded-session integration behavior.
**Where**: `app/tests-bun/`
**Depends on**: T9
**Reuses**: `tests/e2e/db.ts`, reference PGLite setup, existing hook/test timeout budgets
**Requirement**: BTR-04, BTR-05

**Tools**: MCP: NONE — Skill: Bun, drizzle-postgres, no-workarounds, ponytail

**Done when**:

- [ ] Every DB/PGLite/auth file uses isolated database state and closes it in teardown
- [ ] Schema, migration, query, auth, and error outcomes match reference assertions
- [ ] No integration depends on execution order or a production database
- [ ] Cohort passes twice consecutively on an idle machine with exact parity
- [ ] No timeout is raised without measured evidence
- [ ] Test count: candidate DB/auth count equals reference count exactly

**Tests**: integration
**Gate**: cohort

**Commit**: `test(bun): validate database and auth integrations`

---

### T11: Validate HTTP, route, and audit integrations

**What**: Restore route loaders, HTTP calls, app/content audit, Lighthouse adapter, sitemap, robots, and E2E-harness contract tests.
**Where**: `app/tests-bun/`
**Depends on**: T10
**Reuses**: reference route/server mocks, audit fixtures, Playwright contract fixtures
**Requirement**: BTR-04, BTR-05, BTR-12

**Tools**: MCP: NONE — Skill: Bun, tanstack-router, no-workarounds, ponytail

**Done when**:

- [ ] Route and server-module mocks export exact consumed contracts
- [ ] HTTP success/error, audit finding, sitemap, robots, and harness outcomes match reference
- [ ] Fetch, env, server, and mock state are restored after each file
- [ ] Playwright remains a contract dependency, not replaced by Bun.WebView
- [ ] Cohort passes twice consecutively with exact parity
- [ ] Test count: candidate HTTP/route/audit count equals reference count exactly

**Tests**: integration
**Gate**: cohort

**Commit**: `test(bun): validate route and audit integrations`

---

### T12: Validate filesystem, subprocess, and watcher integrations

**What**: Restore fixture IO, sync/indexer/OG generation, subprocess, CLI, file watcher, and cleanup behavior.
**Where**: `app/tests-bun/`
**Depends on**: T11
**Reuses**: reference fixture tree, temp-directory patterns, watcher implementation
**Requirement**: BTR-04, BTR-05

**Tools**: MCP: NONE — Skill: Bun, no-workarounds, ponytail

**Done when**:

- [ ] Every fixture path resolves to intentional shared or candidate data
- [ ] Watcher waits use supported polling without fixed sleeps
- [ ] Temporary files/directories and subprocess groups are always reaped
- [ ] CLI exit codes and output match reference assertions
- [ ] Cohort passes twice consecutively with exact parity
- [ ] Test count: candidate filesystem/subprocess count equals reference count exactly

**Tests**: integration
**Gate**: cohort

**Commit**: `test(bun): validate filesystem and watcher integrations`

---

### T13: Validate benchmark, CI, Docker, and full candidate suite

**What**: Restore remaining repository-infrastructure tests and prove the entire candidate tree and project gates are green together.
**Where**: `app/tests-bun/`
**Depends on**: T12
**Reuses**: existing benchmark stubs, config assertions, Docker/Makefile fixtures
**Requirement**: BTR-03, BTR-04, BTR-05

**Tools**: MCP: NONE — Skill: Bun, no-workarounds, ponytail

**Done when**:

- [ ] Benchmark, CI, Docker, Makefile, Biome, skill, and policy tests match reference outcomes
- [ ] Full `bun test` passes twice consecutively without unhandled errors
- [ ] Full parity reports 124 original twins plus the repaired pilot with zero unexplained differences
- [ ] Vitest/Node 24, Vitest/Bun 1.4, typecheck, lint, build, and lint-tests pass
- [ ] No test, assertion, fixture, mock behavior, or timeout failure was hidden
- [ ] Test count: full candidate inventory equals reference inventory exactly

**Tests**: integration
**Gate**: build

**Commit**: `test(bun): validate full candidate suite`

---

### T14: Define test comparison arms and result types

**What**: Declare A/B/C arm definitions and result models without altering the existing Bun-version benchmark types.
**Where**: `app/lib/test-bench/types.ts`
**Depends on**: T13
**Reuses**: `app/lib/bench/types.ts` shape and project `type` convention
**Requirement**: BTR-06, BTR-07

**Tools**: MCP: NONE — Skill: typescript-advanced, ponytail

**Done when**:

- [ ] A, B, and C have exact runner/runtime/version contracts
- [ ] Result types include provenance, outcomes, timing, RSS, load, validity, and reasons
- [ ] Existing benchmark public types remain unchanged
- [ ] Reference and candidate type/arm tests pass
- [ ] Gate check passes
- [ ] Test count: 6 new tests pass in each runner

**Tests**: unit
**Gate**: quick

**Commit**: `feat(test-bench): define comparison arms`

---

### T15: Implement A/B/C comparison runner

**What**: Run measured arms sequentially with interleaved repetitions, parse Vitest/Bun summaries, and preserve failures.
**Where**: `app/lib/test-bench/runner.server.ts`
**Depends on**: T14
**Reuses**: `spawnMeasured`, host metadata, stats, runtime guard, parity analyzer
**Requirement**: BTR-06, BTR-07, BTR-08

**Tools**: MCP: NONE — Skill: Bun, no-workarounds, ponytail

**Done when**:

- [ ] Vitest and Bun Test summaries parse pass/fail/skip/file counts
- [ ] Arm order is sequential and reverses/interleaves across repetitions
- [ ] Timeout kills the process group and remaining arms continue
- [ ] Runtime provenance and host load are captured per sample
- [ ] Unequal inventory, missing outcome, timeout, and failed arm invalidate comparison
- [ ] Stub-driven reference and candidate integration tests cover every failure mode
- [ ] Gate check passes
- [ ] Test count: 14 new tests pass in each runner

**Tests**: integration
**Gate**: full

**Commit**: `feat(test-bench): run abc test comparison`

---

### T16: Render non-overwriting test comparison reports

**What**: Write raw JSON and Markdown that refuses to name a winner when comparison is invalid.
**Where**: `app/lib/test-bench/reporter.server.ts`
**Depends on**: T15
**Reuses**: existing benchmark timestamp and reporting conventions, AD-001
**Requirement**: BTR-07, BTR-08

**Tools**: MCP: NONE — Skill: ponytail

**Done when**:

- [ ] Valid report includes per-arm median time/RSS, outcome inventory, provenance, and deltas
- [ ] Invalid report leads with reasons and omits winner/improvement language
- [ ] JSON preserves every raw sample and failure excerpt
- [ ] Two writes in one second cannot overwrite one another
- [ ] Output paths remain under `docs/benchmarks/bun-test/`
- [ ] Reference and candidate unit tests cover valid, invalid, partial, and collision cases
- [ ] Gate check passes
- [ ] Test count: 10 new tests pass in each runner

**Tests**: unit
**Gate**: quick

**Commit**: `feat(test-bench): report comparable test metrics`

---

### T17: Wire the test benchmark CLI

**What**: Add a thin CLI and package entry point for short/full A/B/C measurements.
**Where**: `scripts/bench-tests.ts`
**Depends on**: T16
**Reuses**: `scripts/bench.ts` argument and shutdown conventions
**Requirement**: BTR-06, BTR-07, BTR-08

**Tools**: MCP: NONE — Skill: Bun, ponytail

**Done when**:

- [ ] `bun run bench:tests` runs all arms with documented defaults
- [ ] `--only` and positive bounded `--repetitions` validation work
- [ ] CLI prints JSON and Markdown artifact paths
- [ ] Interrupts flush completed samples and restore no mutated test state
- [ ] Package/static tests prove registration and arguments
- [ ] Build gate passes
- [ ] Test count: 6 new CLI tests pass in each runner

**Tests**: none
**Gate**: build

**Commit**: `feat(test-bench): wire comparison cli`

---

### T18: Evaluate CI shadow eligibility

**What**: Derive the consecutive-green suffix from timestamped shadow-result JSON and reject noisy or mismatched runs.
**Where**: `app/lib/test-bench/shadow.ts`
**Depends on**: T17
**Reuses**: comparison result model and report directory conventions
**Requirement**: BTR-09, BTR-10, BTR-11

**Tools**: MCP: NONE — Skill: ponytail

**Done when**:

- [ ] Results sort by timestamp, not filesystem order
- [ ] Failure, timeout, noise, or inventory mismatch resets the suffix to zero at that point
- [ ] Eligibility requires ten consecutive valid green candidate results
- [ ] Empty, malformed, duplicate, and mixed-commit histories return explicit ineligible reasons
- [ ] Reference and candidate unit tests cover boundary counts 0, 9, 10, and 11
- [ ] Gate check passes
- [ ] Test count: 8 new tests pass in each runner

**Tests**: unit
**Gate**: quick

**Commit**: `feat(test-bench): evaluate shadow eligibility`

---

### T19: Add Node 24 reference and Bun Test CI shadow

**What**: Pin Node 24 for the blocking reference and publish non-blocking Bun Test parity/results as a separate job.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T13, T18
**Reuses**: current Bun setup, frozen install, artifact retention, quality matrix, E2E secrets
**Requirement**: BTR-09, BTR-10, BTR-12

**Tools**: MCP: Context7 if workflow action semantics need confirmation — Skill: find-rules, Bun, ponytail

**Done when**:

- [ ] Blocking `test` job installs Node 24 and proves Node/Vitest provenance
- [ ] `bun-test-shadow` runs parity and Bun Test under Bun 1.4.0
- [ ] Candidate failure is visible and non-blocking while shadow mode is active
- [ ] Candidate JSON/log artifacts upload with existing retention policy
- [ ] Playwright remains Node-runner, Chromium-only, workers=1, with Bun web server
- [ ] Workflow tests assert exact blocking/non-blocking behavior and versions
- [ ] Build and E2E gates pass locally where credentials permit; list/provenance gate passes otherwise
- [ ] Test count: at least 8 CI/static assertions pass in both runners

**Tests**: integration
**Gate**: build

**Commit**: `ci(test): add bun test shadow job`

---

### T20: Document operation, cutover, and rollback

**What**: Document commands, cohorts, A/B/C interpretation, shadow eligibility, Playwright boundary, cutover, and rollback; reconcile project testing rules and state.
**Where**: `docs/benchmarks/bun-test/README.md`
**Depends on**: T19
**Reuses**: existing benchmark playbook, AD-001, `.agents/rules/testing.md`, `.agents/rules/cicd.md`
**Requirement**: BTR-08, BTR-09, BTR-10, BTR-11, BTR-12

**Tools**: MCP: NONE — Skill: humanizer, ponytail

**Done when**:

- [ ] Commands and runtime meanings match package scripts exactly
- [ ] Report explains why A/B/C is required and when comparison is invalid
- [ ] Shadow eligibility and reset rules are operationally reproducible
- [ ] Cutover keeps explicit Vitest fallback; removal requires empty Vitest-only inventory
- [ ] Playwright Node/Bun-server boundary and deferred browsers are explicit
- [ ] Project testing/CI rules describe the transition without claiming completion early
- [ ] Spec traceability is updated to Implementing/Verified as evidence permits
- [ ] Build, documentation links, structural validators, and final E2E gates pass

**Tests**: none
**Gate**: build

**Commit**: `docs(test): document bun runner migration`

---

## Phase Execution Map

```text
Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5

Phase 1: T1 → T2 → T3 → T4
Phase 2: T5 → T6 → T7
Phase 3: T8 → T9 → T10 → T11 → T12 → T13
Phase 4: T14 → T15 → T16 → T17 → T18
Phase 5: T19 → T20
```

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1 | One provenance module | ✅ Granular |
| T2 | One manifest/config surface | ✅ Granular |
| T3 | One parity module | ✅ Granular |
| T4 | One CLI/cohort entry point | ✅ Granular |
| T5 | One setup/fixture stabilization cohort | ✅ Cohesive migration unit |
| T6 | One pure cohort | ✅ Cohesive migration unit |
| T7 | One simple-DOM cohort | ✅ Cohesive migration unit |
| T8 | One DOM+mock cohort | ✅ Cohesive migration unit |
| T9 | One non-DOM mock/timer cohort | ✅ Cohesive migration unit |
| T10 | One DB/auth integration cohort | ✅ Cohesive migration unit |
| T11 | One HTTP/route/audit cohort | ✅ Cohesive migration unit |
| T12 | One filesystem/subprocess/watcher cohort | ✅ Cohesive migration unit |
| T13 | One repository-infrastructure cohort plus full candidate gate | ✅ Cohesive migration unit |
| T14 | One result-model module | ✅ Granular |
| T15 | One comparison runner | ✅ Granular |
| T16 | One reporter | ✅ Granular |
| T17 | One thin CLI | ✅ Granular |
| T18 | One eligibility function | ✅ Granular |
| T19 | One CI workflow | ✅ Granular |
| T20 | One operational document plus rule reconciliation | ✅ Cohesive documentation unit |

---

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| ---- | ---------- | ------------- | ------ |
| T1 | None | none | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T2 | T2 → T3 | ✅ Match |
| T4 | T3 | T3 → T4 | ✅ Match |
| T5 | T4 | T4 → T5 | ✅ Match |
| T6 | T5 | T5 → T6 | ✅ Match |
| T7 | T6 | T6 → T7 | ✅ Match |
| T8 | T7 | T7 → T8 | ✅ Match |
| T9 | T8 | T8 → T9 | ✅ Match |
| T10 | T9 | T9 → T10 | ✅ Match |
| T11 | T10 | T10 → T11 | ✅ Match |
| T12 | T11 | T11 → T12 | ✅ Match |
| T13 | T12 | T12 → T13 | ✅ Match |
| T14 | T13 | T13 → T14 | ✅ Match |
| T15 | T14 | T14 → T15 | ✅ Match |
| T16 | T15 | T15 → T16 | ✅ Match |
| T17 | T16 | T16 → T17 | ✅ Match |
| T18 | T17 | T17 → T18 | ✅ Match |
| T19 | T13, T18 | T13 → T19; T18 → T19 | ✅ Match |
| T20 | T19 | T19 → T20 | ✅ Match |

---

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
| ---- | ----- | --------------- | --------- | ------ |
| T1 | Pure provenance logic | unit | unit | ✅ OK |
| T2 | Package/config | unit | unit | ✅ OK |
| T3 | Pure parity logic | unit | unit | ✅ OK |
| T4 | CLI + cohort logic | unit | unit | ✅ OK |
| T5 | Candidate setup/fixtures | integration | integration | ✅ OK |
| T6 | Candidate pure tests | unit | unit | ✅ OK |
| T7 | Candidate simple DOM | unit | unit | ✅ OK |
| T8 | Candidate DOM+mocks | unit | unit | ✅ OK |
| T9 | Candidate mocks/timers | unit | unit | ✅ OK |
| T10 | Candidate DB/auth | integration | integration | ✅ OK |
| T11 | Candidate HTTP/route/audit | integration | integration | ✅ OK |
| T12 | Candidate fs/subprocess/watcher | integration | integration | ✅ OK |
| T13 | Candidate infrastructure/full suite | integration | integration | ✅ OK |
| T14 | Pure models/arms | unit | unit | ✅ OK |
| T15 | Process orchestration | integration | integration | ✅ OK |
| T16 | Report rendering | unit | unit | ✅ OK |
| T17 | Thin CLI | none | none | ✅ OK |
| T18 | Pure state evaluation | unit | unit | ✅ OK |
| T19 | CI config | integration | integration | ✅ OK |
| T20 | Documentation | none | none | ✅ OK |
