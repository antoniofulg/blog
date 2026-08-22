# Bun Native Test Runner Migration Specification

## Problem Statement

The Blog runs production on Bun 1.4, but its unit, component, and integration
tests use Vitest through a Node shebang. A candidate `bun:test` tree exists, but
it is incomplete, fails project gates, and cannot yet produce a fair comparison
against the Node 24 reference. We need two trustworthy test paths during the
migration, evidence that separates runtime effects from runner effects, and a
reversible cutover.

## Goals

- [ ] Keep a green Vitest-on-Node-24 reference while Bun Test matures.
- [ ] Provide explicit A/B/C commands that prove which runtime and runner execute.
- [ ] Preserve every existing test outcome, fixture, assertion, setup, and teardown.
- [ ] Produce repeatable time, memory, result-count, and flakiness comparisons.
- [ ] Run Bun Test in CI shadow mode before any cutover.
- [ ] Make the final cutover reversible until no justified Vitest-only tests remain.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Replacing Playwright with Bun.WebView | WebView is experimental and does not replace the current E2E strategy. |
| Adding Firefox or WebKit projects | Browser-matrix expansion is independent from the unit runner migration. |
| Forcing Playwright's supported runner from Node to Bun | Playwright documents Node as its supported JavaScript runtime; the Blog server already runs under Bun during E2E. |
| Changing application behavior to satisfy Bun Test | This migration must preserve production behavior. |
| Removing tests, assertions, or fixtures | Lower test coverage is not an acceptable compatibility fix. |
| Publishing or deploying | The workflow authorizes local code and commits only. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Reference environment | Vitest 4.1.5 executed explicitly by Node 24 | It represents the supported reference without relying on an ambient Node shebang. | y |
| Runtime control | Every comparison records `process.execPath`, Node/Bun version, runner, and commit | A label is not evidence that the intended runtime executed. | y |
| Candidate environment | `bun:test` executed by Bun 1.4.0 | Production is pinned to Bun 1.4.0 and the migration targets its native runner. | y |
| Control environment | Vitest executed explicitly by Bun 1.4.0 | This separates the runtime effect from the runner effect. | y |
| Existing Bun twins | Preserve the current files and repair them in cohorts | Deleting the existing work would lose useful migration effort; validating everything at once is too risky. | y |
| DOM implementation | Import happy-dom setup explicitly only in Bun Test files that use DOM APIs; retain jsdom for Vitest-only cases | A global preload replaces Bun's native Request/Headers/Response and breaks server-side cookie behavior. Per-file setup keeps DOM shims local to component tests. | y |
| CI promotion threshold | Ten consecutive green Bun Test shadow runs with identical result inventory | Ten runs provide a concrete initial flakiness window without pretending to be statistical proof. | n |
| Candidate CI failure | Report and retain artifacts without blocking the reference gate | Shadow mode must expose gaps without blocking unrelated development. | y |
| Benchmark execution | Run A/B/C sequentially and interleave order on one machine | Parallel runs and separate shared runners confound CPU, memory, and PGLite results. | y |
| Benchmark persistence | Write timestamped JSON and Markdown under `docs/benchmarks/bun-test/` | AD-001 requires cited measurements to remain versioned and non-overwriting. | y |
| Coverage tooling | Preserve current test inventory and result parity; do not add a coverage dependency unless an existing gate requires it | The Blog has no active coverage command or threshold today. | n |
| Vitest removal | Remove only after the Vitest-only inventory reaches zero | A documented fallback is safer than forcing incompatible tests across runners. | y |

**Open questions:** none - all resolved or logged above.

---

## User Stories

### P1: Trustworthy parallel test paths ⭐ MVP

**User Story**: As the Blog maintainer, I want explicit reference, control, and candidate test commands so that I can compare runners without guessing which runtime executed.

**Why P1**: Every compatibility and performance conclusion depends on these commands being honest.

**Acceptance Criteria**:

1. The system SHALL provide `test:vitest:node`, `test:vitest:bun`, and `test:bun` package scripts with stable meanings.
2. WHEN `test:vitest:node` runs under Node 24 THEN the system SHALL execute the Vitest suite through the Node 24 executable and report Node 24 as `process.execPath` provenance.
3. WHEN `test:vitest:bun` runs THEN the system SHALL execute Vitest through Bun 1.4.0 and report Bun as `process.execPath` provenance.
4. WHEN `test:bun` runs THEN the system SHALL execute only the Bun Test tree through Bun 1.4.0.
5. WHILE Bun Test is a shadow candidate, the system SHALL keep `test` mapped to the Node 24 Vitest reference.
6. IF any requested runtime version differs from Node 24 or Bun 1.4.0 THEN the comparison harness SHALL fail before measurement and name the mismatch.

**Independent Test**: Run all three scripts and verify their test roots, runner labels, executable paths, and versions.

---

### P1: Behavior-equivalent Bun Test cohorts ⭐ MVP

**User Story**: As the Blog maintainer, I want each Bun Test cohort to preserve the reference outcomes so that migration does not create false confidence.

**Why P1**: Faster tests are worthless if mocks, assertions, or lifecycle behavior change silently.

**Acceptance Criteria**:

1. The system SHALL maintain a machine-checkable one-to-one inventory between migrated Vitest files and Bun Test files.
2. WHEN a test file is declared migrated THEN the system SHALL preserve its test cases, assertions, fixtures, setup, and teardown outcomes.
3. IF Bun Test cannot reproduce a Vitest behavior THEN the system SHALL keep that file in the Vitest-only inventory and record the incompatibility and evidence.
4. The system SHALL NOT mark a file equivalent when a partial mock, assertion, fixture, setup, or teardown was omitted.
5. WHEN component tests run under Bun Test THEN the system SHALL preload happy-dom and provide only the browser API shims required by migrated tests.
6. WHEN integration tests run under Bun Test THEN the system SHALL clean database, filesystem, environment, mocks, timers, and subprocess state between tests.
7. IF a hook or test exceeds its declared timeout THEN the system SHALL fail with the responsible file and hook instead of increasing timeouts without evidence.
8. WHEN a cohort is complete THEN Bun Test, Vitest, typecheck, lint, and the cohort parity gate SHALL pass.

**Independent Test**: Run each cohort and its parity gate, then compare the reference and candidate inventories with zero silent omissions.

---

### P1: Comparable A/B/C measurements ⭐ MVP

**User Story**: As the Blog maintainer, I want measurements that isolate runtime and runner changes so that later performance claims are attributable.

**Why P1**: Comparing Node/Vitest directly with Bun/Bun Test changes two variables and cannot explain a delta.

**Acceptance Criteria**:

1. The system SHALL define A as Vitest on Node 24, B as Vitest on Bun 1.4.0, and C as Bun Test on Bun 1.4.0.
2. WHEN a comparison run starts THEN the system SHALL execute A, B, and C sequentially on the same machine.
3. WHEN multiple repetitions run THEN the system SHALL interleave arm order so ambient drift does not always favor one arm.
4. WHEN an arm completes THEN the system SHALL record wall time, peak RSS, passed, failed, skipped, test-file count, runtime version, executable path, runner version, commit, timestamp, and host load.
5. IF an arm fails or times out THEN the system SHALL record the failure as compatibility evidence and continue with the remaining arms.
6. IF the reference and candidate inventories differ THEN the report SHALL label performance comparison invalid and SHALL NOT report a winner.
7. WHEN a comparison is written THEN the system SHALL create unique timestamped JSON and Markdown files under `docs/benchmarks/bun-test/` without overwriting prior runs.
8. The system SHALL exclude dependency installation and Playwright browser time from the A/B/C unit-runner comparison.

**Independent Test**: Run a short comparison fixture and verify complete provenance, interleaved ordering, invalid-comparison detection, and unique reports.

---

### P2: CI shadow validation and reversible cutover

**User Story**: As the Blog maintainer, I want Bun Test exercised in CI without replacing the trusted gate immediately so that incompatibilities appear before cutover.

**Why P2**: Local compatibility is not enough evidence for CI stability.

**Acceptance Criteria**:

1. WHILE Bun Test is in shadow mode, the CI SHALL keep Vitest on Node 24 as a blocking quality gate.
2. WHILE Bun Test is in shadow mode, the CI SHALL execute Bun Test as a non-blocking candidate and retain its logs and result artifacts.
3. WHEN Bun Test records ten consecutive green shadow runs with matching inventory THEN the system SHALL make it eligible for an explicit cutover decision.
4. IF any shadow run fails or its inventory differs THEN the system SHALL reset the consecutive-green count to zero.
5. WHEN cutover is approved THEN the system SHALL map `test` to Bun Test while retaining an explicit Vitest fallback command.
6. IF a post-cutover Bun Test regression occurs THEN the system SHALL allow the blocking gate to return to Vitest without deleting migrated tests or benchmark history.
7. The system SHALL NOT remove Vitest while the Vitest-only inventory is non-empty.

**Independent Test**: Evaluate the workflow and state tracker against green, failing, mismatched, cutover, and rollback fixtures.

---

### P2: Preserve the Playwright boundary

**User Story**: As the Blog maintainer, I want E2E to keep testing the Bun-served application with the supported Playwright runner so that unit migration does not destabilize browser coverage.

**Why P2**: Playwright runner migration is not required to exercise the production runtime.

**Acceptance Criteria**:

1. The system SHALL keep Playwright as the E2E runner.
2. WHEN Playwright starts its web server THEN the system SHALL run the Blog server through Bun.
3. The blocking Playwright command SHALL execute through its supported Node runtime.
4. WHERE a forced-Bun Playwright experiment exists, the CI SHALL mark it non-blocking and SHALL not use it as cutover evidence for Bun Test.
5. The migration SHALL preserve `workers: 1`, fixtures, traces, reporters, retries, screenshots, and configured browser projects.

**Independent Test**: List and run the configured Playwright project, verifying Node runner provenance and Bun server provenance.

---

## Edge Cases

- IF a Bun twin references a missing fixture THEN the parity gate SHALL fail with both expected paths.
- IF a Bun mock exports fewer symbols than the reference mock THEN the parity gate SHALL fail or the file SHALL remain Vitest-only.
- IF PGLite contention causes a non-deterministic timeout THEN the run SHALL be recorded as noisy and SHALL not count toward the ten-run cutover window.
- IF a benchmark process survives its arm THEN the harness SHALL terminate it before starting the next arm.
- IF the worktree contains unrelated changes THEN each task commit SHALL include only files owned by that task.
- IF Node 24 is unavailable THEN the reference measurement SHALL fail with an installation hint instead of using ambient Node.

---

## Implicit Requirement Dimensions

| Dimension | Resolution |
| --------- | ---------- |
| Input validation & bounds | Runtime versions, arm IDs, repetition counts, and report paths are validated; no user data enters the feature. |
| Failure / partial-failure states | Candidate failures are recorded and non-blocking until cutover; reference failures remain blocking. |
| Idempotency / retry / duplicate handling | Reports are uniquely timestamped; reruns never overwrite earlier evidence. |
| Auth boundaries & rate limits | N/A because this migration does not change auth behavior or external endpoints. Existing E2E credentials remain unchanged. |
| Concurrency / ordering | Benchmark arms run sequentially and interleave order across repetitions. |
| Data lifecycle / expiry | Versioned benchmark evidence is retained under AD-001; transient CI artifacts follow existing retention. |
| Observability | Every arm records provenance, results, timing, RSS, load, and failure evidence. |
| External-dependency failure | Missing Node/Bun, PGLite contention, Playwright startup, and subprocess failures are explicit results, never silent fallback. |
| State-transition integrity | Shadow candidate becomes cutover-eligible only after ten matching green runs; any failure resets the count. |

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| BTR-01 | P1: Parallel paths | Tasks | Implementing (T2) |
| BTR-02 | P1: Runtime provenance | Tasks | Implementing (T1-T2) |
| BTR-03 | P1: Cohort inventory | Tasks | Implementing (T3-T6) |
| BTR-04 | P1: Behavioral parity | Tasks | Implementing (T3-T12) |
| BTR-05 | P1: DOM and lifecycle | Tasks | Implementing (T5-T12) |
| BTR-06 | P1: A/B/C harness | Tasks | In Tasks |
| BTR-07 | P1: Measurement provenance | Tasks | In Tasks |
| BTR-08 | P1: Valid comparison | Tasks | In Tasks |
| BTR-09 | P2: CI shadow | Tasks | In Tasks |
| BTR-10 | P2: Cutover state | Tasks | In Tasks |
| BTR-11 | P2: Rollback and Vitest removal | Tasks | In Tasks |
| BTR-12 | P2: Playwright boundary | Tasks | Implementing (T11) |

**Coverage:** 12 total, 12 mapped to tasks, 0 unmapped.

---

## Success Criteria

- [ ] Node 24/Vitest remains green throughout shadow migration.
- [ ] Every migrated Bun Test file has machine-checked behavioral parity or a documented Vitest-only disposition.
- [ ] A/B/C reports reject unequal inventories instead of claiming invalid performance wins.
- [ ] Bun Test completes ten matching green CI shadow runs before cutover eligibility.
- [ ] Typecheck, lint, unit, integration, E2E, build, and project-specific gates pass after cutover.
- [ ] Vitest remains available until the Vitest-only inventory reaches zero.
