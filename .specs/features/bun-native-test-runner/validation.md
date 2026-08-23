# Bun Native Test Runner Migration Validation

> Historical status amendment (2026-08-23): implementation and validation are
> complete for the shadow-migration scope. Current worker, Playwright, browser,
> skip-accounting, and cutover-readiness evidence is consolidated in
> `docs/benchmarks/testing-runtimes/2026-08-22-summary.md`; raw historical
> measurements below are not rewritten.

> Historical evidence notice: this report validates the original Node-blocking
> shadow state. On 2026-08-22, the blocking alias moved to Bun 1.4 + Vitest due
> to its 452 MB lower median peak RSS. Node 24 + Vitest remains available as the
> reference and rollback route; Bun Test remains shadow-only.

**Verdict**: PASS
**Iteration**: 2
**Date**: 2026-08-22
**Spec**: `.specs/features/bun-native-test-runner/spec.md`
**Diff range**: `2e65d2a..2d92bae`
**Verifier**: independent sub-agent (author != verifier)

The implementation satisfies all 34 acceptance criteria. All mandatory gates
passed in fresh executions against HEAD. All three required adversarial mutations
were killed in an isolated worktree. This verifies shadow-mode capability; it
does not approve cutover before ten real consecutive green CI runs.

## Task and Structural State

- T1-T26 are present and all Done-when boxes are complete in
  `.specs/features/bun-native-test-runner/tasks.md:135` through `:822`.
- Range contains 31 commits; all 31 pass TLC `check_commit.py`.
- `validate_spec.py`: 0 errors, 0 warnings.
- `validate_tasks.py`: 0 errors, 2 expected warnings for T17/T20 `Tests: none`;
  both match the Test Coverage Matrix's thin-CLI/documentation rows.
- `test` remains `bun run test:vitest:node` at `package.json:13`, proven by
  `app/tests/test-scripts.test.ts:28` and a fresh focused invocation.

## Spec-Anchored Acceptance Criteria

### P1: Trustworthy parallel test paths

| AC | Spec-defined outcome | Evidence and exact assertion | Result |
| --- | --- | --- | --- |
| Parallel-1 | Stable A/B/C scripts exist | `app/tests/test-scripts.test.ts:32-56` asserts each exact guard/root/version | PASS |
| Parallel-2 | A is Vitest on Node 24 with executable provenance | `app/tests/test-runtime.test.ts:18-32` asserts Node major 24, `process.execPath`, Vitest 4.1.5; fresh A used Node 24.19.0 | PASS |
| Parallel-3 | B is Vitest on Bun 1.4.0 | `app/tests-bun/test-runtime.test.ts:18-32` asserts Bun 1.4.0, `process.execPath`, Vitest 4.1.5; fresh B emitted the Bun executable path | PASS |
| Parallel-4 | C runs only Bun Test tree on Bun 1.4.0 | `app/tests/test-scripts.test.ts:44-47` asserts `app/tests-bun` and `--isolate`; `app/tests-bun/test-runtime.test.ts:31-32` asserts `bun:test` 1.4.0 | PASS |
| Parallel-5 | `test` stays Node/Vitest in shadow mode | `app/tests/test-scripts.test.ts:28` uses `expect(scripts.test).toBe("bun run test:vitest:node")`; focused `bun run test` executed the Node guard | PASS |
| Parallel-6 | Wrong runtime fails before measurement and names mismatch | `app/tests/test-runtime.test.ts:40-49` and `app/tests-bun/test-runtime.test.ts:40-56` assert expected/detected/path; Node mismatch includes setup hint | PASS |

### P1: Behavior-equivalent Bun Test cohorts

| AC | Spec-defined outcome | Evidence and exact assertion | Result |
| --- | --- | --- | --- |
| Cohort-1 | One-to-one migrated inventory | Fresh AST scan: both trees have 138 files, 2,289 static test declarations, and 3,761 assertions; `app/lib/test-migration/parity.ts:349-356,397-402` enforces exact counts/files | PASS |
| Cohort-2 | Tests, assertions, fixtures, setup and teardown preserved | `app/tests/test-migration-parity.test.ts:86-110` rejects lower or higher counts; full A/C suites pass; no test file was deleted in the range | PASS |
| Cohort-3 | Incompatible files require a complete Vitest-only disposition | `app/tests/test-migration-parity.test.ts:172-205` asserts complete disposition acceptance and missing-evidence rejection | PASS |
| Cohort-4 | Partial mocks/assertions/fixtures/lifecycle cannot pass as equivalent | `app/tests/test-migration-parity.test.ts:76-168` covers fixtures, exact counts, missing static mock exports, residual Vitest APIs, and omission markers | PASS |
| Cohort-5 | DOM tests use local happy-dom with only required shims | `app/tests-bun/dom-setup.test.ts:11-30` asserts ResizeObserver, matchMedia, and Bun-native Request/Headers; `:35-39` asserts cleanup | PASS |
| Cohort-6 | Integration state is cleaned between tests | Full C gate passed; `app/tests-bun/dom-setup.test.ts:35-39` proves DOM cleanup and `app/tests/bench-runner.test.ts:51-58` proves timed-out process-group cleanup | PASS |
| Cohort-7 | Hook timeout identifies file and hook | `app/tests/hook-timeout-diagnostics.test.ts:31-36` asserts non-zero Bun exit, bounded execution, fixture basename, lifecycle hook, and timeout text; mirrored Bun test passes | PASS |
| Cohort-8 | Complete cohort passes all required gates | Fresh parity, A, B, C, typecheck, lint, lint-tests, build, and E2E all exited 0 | PASS |

### P1: Comparable A/B/C measurements

| AC | Spec-defined outcome | Evidence and exact assertion | Result |
| --- | --- | --- | --- |
| Compare-1 | A/B/C definitions are exact | `app/tests/test-bench-types.test.ts:12-41` asserts runtime, version, runner, command, and arm order | PASS |
| Compare-2 | Arms run sequentially on one machine | `app/tests/test-bench-runner.test.ts:180-198` asserts A,B,C,C,B,A order; runner awaits each arm at `app/lib/test-bench/runner.server.ts:269-275` | PASS |
| Compare-3 | Repetitions interleave order | Same `app/tests/test-bench-runner.test.ts:180-198` assertion proves reversal on repetition two | PASS |
| Compare-4 | Samples record time, RSS, outcomes and provenance | `app/tests/test-bench-runner.test.ts:147-151` asserts time/RSS/load/executable/outcome; `app/tests/test-bench-reporter.test.ts:67-70,139-140` asserts rendered/raw provenance | PASS |
| Compare-5 | Failure/timeout is retained and later arms continue | `app/tests/test-bench-runner.test.ts:154-173,201-214` asserts failure excerpt, timeout/null exit, three calls, three samples, and invalid result | PASS |
| Compare-6 | Unequal A/C outcome inventory invalidates comparison and suppresses winner | `app/tests/test-bench-runner.test.ts:234-299` asserts file/pass/fail/skip mismatches and equal repetitions; `app/tests/test-bench-reporter.test.ts:81-83` forbids winner language | PASS |
| Compare-7 | JSON/Markdown reports are unique and non-overwriting | `app/tests/test-bench-reporter.test.ts:106-130` asserts extensions, timestamp, and distinct collision paths | PASS |
| Compare-8 | Dependency install and Playwright time are excluded | `app/tests/test-bench-types.test.ts:12-38` asserts unit-only arm commands; `docs/benchmarks/bun-test/README.md:35-39` documents exclusion | PASS |

### P2: CI shadow validation and reversible cutover

| AC | Spec-defined outcome | Evidence and exact assertion | Result |
| --- | --- | --- | --- |
| Shadow-1 | Node 24/Vitest remains blocking | `app/tests/ci-bun-test-shadow.test.ts:11-16` asserts matrix test entry and setup-node 24; `.github/workflows/ci.yml:31-36` scopes Node 24 to blocking test | PASS |
| Shadow-2 | Bun Test is non-blocking and artifacts are retained | `app/tests/ci-bun-test-shadow.test.ts:20-46` asserts `continue-on-error`, Bun 1.4.0, parity/C, JSON/log upload, and seven days | PASS |
| Shadow-3 | Ten distinct green matching runs become eligible | `app/tests/test-bench-shadow.test.ts:52-70,100-114` asserts 10/11 and distinct commits; fresh workflow-shaped artifact history returned `{eligible:true, consecutiveGreen:10}` | PASS |
| Shadow-4 | Failure, mismatch, timeout or noise resets suffix | `app/tests/test-bench-shadow.test.ts:73-97,132-146` asserts reset and PGLite classification; fresh otherwise-green PGLite timeout history returned zero | PASS |
| Shadow-5 | Approved cutover remaps `test` while retaining fallback | `docs/benchmarks/bun-test/README.md:63-70` gives explicit cutover mapping; current checkout remains pre-cutover | PASS |
| Shadow-6 | Post-cutover rollback preserves migrated evidence | `docs/benchmarks/bun-test/README.md:71-72` gives exact rollback and retention | PASS |
| Shadow-7 | Vitest cannot be removed with non-empty Vitest-only inventory | `docs/benchmarks/bun-test/README.md:74-76` states the empty-inventory condition | PASS |

### P2: Preserve the Playwright boundary

| AC | Spec-defined outcome | Evidence and exact assertion | Result |
| --- | --- | --- | --- |
| Playwright-1 | Playwright remains E2E runner | `playwright.config.ts:1-6`; fresh full run discovered and passed 49 Playwright tests | PASS |
| Playwright-2 | E2E web server runs through Bun | `playwright.config.ts:35-40` and `app/tests/ci-bun-test-shadow.test.ts:56` assert `bun run scripts/e2e-server.ts` | PASS |
| Playwright-3 | Blocking Playwright uses supported Node runtime | Full gate ran under Node 24.19.0 and emitted Node worker PIDs; Bun was confined to the web server command | PASS |
| Playwright-4 | Forced-Bun experiment, if added, stays non-blocking and excluded | No forced-Bun runner exists; `docs/benchmarks/bun-test/README.md:80-84` excludes such experiments | PASS |
| Playwright-5 | workers, fixtures, traces, reporters, retries, screenshots/projects remain | `playwright.config.ts:5-30` preserves workers=1, global fixtures, retries, HTML+JSON reporters, trace, setup and Chromium projects; config is unchanged in the feature range | PASS |

**Spec-anchored result**: 34/34 matched, 0 unmatched, 0 spec-precision gaps.

## Explicit Revalidation of Iteration-1 Gaps

1. **CI producer/evaluator contract**: PASS. The exact CLI used by CI produced
   schema-compatible JSON. Ten copies with ten distinct commits evaluated as
   eligible. An otherwise-green PGLite hook timeout evaluated as noisy with a
   zero suffix.
2. **Exact parity**: PASS. Fresh scan is exactly 138/2,289/3,761 for both trees.
3. **A/C outcome mismatch**: PASS. File/pass/fail/skip fields are independently
   asserted and the mutation removing the outcome conjunct was killed.
4. **`inventory.ok` isolation**: PASS. Removing only that conjunct made
   `app/tests/test-bench-runner.test.ts:230` fail; no other invalid reason masked it.
5. **Mock export inventory**: PASS. `app/lib/test-migration/parity.ts:379-393`
   rejects missing statically known symbols. Tests cover missing/equal exports and
   dynamic `importOriginal` spread without false positives at
   `app/tests/test-migration-parity.test.ts:114-149`.
6. **Diagnostics**: PASS. Hook timeout proves fixture + hook + timeout at
   `app/tests/hook-timeout-diagnostics.test.ts:31-36`; wrong Node major proves
   actionable setup guidance at `app/tests/test-runtime.test.ts:46-49`.

## Fresh Gate Evidence

Commands ran on Bun 1.4.0. Node/Vitest and Playwright commands used Node
24.19.0. A/B/C ran sequentially.

| Gate | Result | Count / elapsed |
| --- | --- | --- |
| TLC `validate_spec.py` | PASS | 0 errors, 0 warnings |
| TLC `validate_tasks.py` | PASS | 0 errors, 2 justified warnings |
| TLC `check_commit.py` | PASS | 31/31 commits |
| Focused iteration-1 regressions, Node/Vitest | PASS | 7 files, 61/61 tests |
| Focused iteration-1 regressions, Bun Test | PASS | 7 files, 61/61 tests, 122 expects |
| `bun run test:parity` | PASS | exact 138 files / 2,289 static tests / 3,761 assertions per tree |
| `bun run test:vitest:node` (A) | PASS | 138 files; 2,343 pass, 52 skip; 66.14 s |
| `bun run test:vitest:bun` (B) | PASS | 137 files; 2,335 pass, 52 skip; 60.96 s |
| `bun run test:bun` (C) | PASS | 138 files; 2,343 pass, 57 skip, 0 fail; 119.71 s |
| `bun run test` focused alias proof | PASS | 1 file, 8/8; delegated to Node24/Vitest |
| `bun run lint` | PASS | 0 errors, 17 pre-existing warnings; 0.39 s |
| `bunx tsc --noEmit` | PASS | 0 errors; 6.59 s |
| `make lint-tests` | PASS | annotations clean; 0.39 s |
| `bun run build` | PASS | client + SSR + Nitro; 8.48 s |
| `make test-e2e` | PASS | 49/49, workers=1; 15.11 s |

A and C have equal passed/file counts but C reports five additional skipped
entries. The comparison harness correctly treats this real A/C outcome mismatch
as invalid compatibility evidence and cannot name a performance winner. No
performance conclusion is drawn from these wall times.

## Discrimination Sensor

Scratch: detached temporary worktree at `2d92bae`, with shared `node_modules`.
Each mutation was restored before the next. The worktree and temp root were
removed. No stash was used.

| Mutation | Expected discriminator | Result |
| --- | --- | --- |
| M1 remove `inventory.ok` from `validComparison` | `app/tests/test-bench-runner.test.ts:230` must reject inventory-only invalidity | KILLED: 1 failed, 15 passed |
| M2 remove `outcomeReasons.length === 0` | `app/tests/test-bench-runner.test.ts:259` must reject unequal A/C outcomes | KILLED: 1 failed, 15 passed |
| M3 emit producer JSON with empty `samples` | `app/tests/write-shadow-result.test.ts:36` must feed evaluator and count one green run | KILLED: 1 failed, 0 passed |

**Sensor result**: 3/3 killed, 0 survived. PASS.

## Edge Cases and Quality

| Edge / quality check | Result |
| --- | --- |
| Missing fixture reports precise candidate path | PASS: `app/tests/test-migration-parity.test.ts:76-83` |
| Missing static mock export fails; dynamic spread avoids false positive | PASS: `app/tests/test-migration-parity.test.ts:114-149` |
| PGLite hook timeout is noisy and never green | PASS: unit assertion plus fresh producer/evaluator probe |
| Surviving subprocess is terminated before next arm | PASS: `app/tests/bench-runner.test.ts:51-58` |
| Missing Node 24 gives installation/version-manager hint | PASS: `app/tests/test-runtime.test.ts:46-49` |
| No tests/files deleted or assertions weakened | PASS: no deleted test files in range; exact twin counts |
| No `// SPEC_DEVIATION` markers | PASS |
| Project testing/CI boundary followed | PASS: `.agents/rules/testing.md`, `.agents/rules/cicd.md` |
| Minimum/surgical architecture | PASS: focused parity, bench, shadow and CLI modules reuse existing process/report helpers |
| Every feature test maps to a spec AC, edge case, or task Done-when | PASS |

## Risks

- Vitest A/B printed `ReferenceError: module is not defined` during Vite module
  shutdown and `close timed out after 10000ms`, while returning exit 0 with all
  tests passed. This is observable runner noise, not a PGLite shadow green, and
  did not change gate status. Keep it visible in future shadow evidence.
- A/C currently differ by five runner-reported skips. The harness now rejects
  the comparison, so no false winner is possible. Cutover eligibility still
  requires ten real clean CI artifacts.
- Lint has 17 existing warnings. It has zero errors and passed the configured
  blocking gate.

## Requirement Traceability Update

| Requirement | Previous | Iteration-2 result |
| --- | --- | --- |
| BTR-01 through BTR-12 | Verified by completed tasks | Verified by independent spec-anchored validation |

## Summary

**Overall**: PASS. Ready for CI shadow operation, not cutover.

- Spec-anchored check: 34/34 matched.
- Mandatory gates: all passed.
- Sensor: 3/3 killed.
- Iteration-1 gaps: 6/6 closed.
- Next operational step: accumulate ten real consecutive green, matching,
  non-noisy CI shadow artifacts before an explicit cutover decision.
