# Bun Test Revalidation Specification

**Status**: Approved for autonomous execution (2026-08-24)

## Problem Statement

The Blog retired its native Bun Test candidate after two full-suite signals were
roughly twice as slow as Bun-hosted Vitest. Those signals were not controlled:
Vitest used its default file parallelism while Bun Test ran serially with
per-file isolation, the inventories/skips diverged, warm-up was not discarded,
and memory evidence was inconclusive. We need a documentation-aligned,
runner-first comparison before treating either runner as the permanent winner.

## Goals

- [ ] Maintain independent Vitest-first and Bun-Test-first suites.
- [ ] Preserve the same product-test inventory and asserted behavior.
- [ ] Evaluate safe serial, isolated-parallel, and memory-oriented profiles.
- [ ] Measure warm and cold behavior with reproducible provenance.
- [ ] Prioritize peak memory for multi-worktree local development, then wall time.
- [ ] Produce committed raw evidence and a decision suitable for a future post.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Replacing Playwright | E2E remains Playwright through Bun and is independent of this runner comparison. |
| Restoring Bun.WebView | Its experiment is retired and unrelated to unit/component/integration runner choice. |
| Changing production behavior | Test migration must adapt the suite, not the application. |
| Immediate CI cutover | CI changes require valid final evidence and a separate explicit decision. |
| Publishing, pushing, or merging | This autonomous run authorizes local implementation and commits only. |

## Assumptions & Open Questions

| Topic | Decision | Rationale |
| --- | --- | --- |
| Reference | Bun 1.4.0 + Vitest 4.1.5 | This is the current canonical runner and runtime. |
| Candidate | Bun 1.4.0 + native `bun:test` | This isolates runner impact while keeping runtime constant. |
| Source layout | `app/tests/` and `app/tests-bun/` remain independent first-class trees | Shared adapters can distort one runner and hide native incompatibilities. |
| Starting point | Recover the historical `711f18d` tree, then re-audit and adapt it | It preserves prior compatibility work without trusting prior methodology. |
| DOM | Keep jsdom for Vitest and use explicit Happy DOM setup for Bun DOM tests | A global DOM preload would replace Bun-native web APIs in server tests. |
| Isolation | Isolated profiles are the correctness baseline | The suite contains module mocks, globals, timers, PGLite, filesystem and subprocess state. |
| `--no-isolate` | Candidate only for cohorts that pass leak/order probes | It is faster but unsafe without evidence. |
| Concurrency | Tune bounded worker counts; do not use automatic maximum as the local default | Several simultaneous worktrees make memory pressure operationally important. |
| Environment | Fix `TZ=UTC`, timeouts, commit, versions, and execution order | Prevent avoidable environmental drift. |
| Samples | One discarded warm-up and at least five interleaved measured repetitions for finalists | One-shot measurements are not decision-quality evidence. |
| Decision | Current Vitest default remains until the final report proves a replacement | Revalidation must not silently reverse AD-004. |

**Open questions**: none. The user approved autonomous execution, independent
suites when needed, and the previously selected implementer/verifier models.

## User Stories

### P1: Equivalent first-class suites

**User Story**: As the maintainer, I want a native suite for each runner so that
both are evaluated on their intended APIs without losing behavior.

1. The system SHALL keep the canonical Vitest suite under `app/tests/` unchanged except for runner-neutral fixes that preserve behavior.
2. The system SHALL provide a Bun-first suite under `app/tests-bun/` using `bun:test` APIs and Bun-compatible fixtures.
3. WHEN a product test exists in the canonical inventory THEN the candidate SHALL contain a corresponding test or an explicit incompatibility disposition.
4. WHEN a candidate test is declared equivalent THEN its test declarations, assertions, fixtures, hooks, mocks, and observable outcomes SHALL remain represented.
5. IF an incompatibility requires removing an assertion or changing application behavior THEN the system SHALL reject that candidate adaptation.
6. WHEN DOM tests execute under Bun THEN the system SHALL use Happy DOM only for DOM-bearing files and SHALL clean DOM state after each test.
7. WHEN mocks, fake time, environment variables, filesystem, database, ports, or subprocesses are changed THEN the suite SHALL restore or isolate that state.

**Independent Test**: Run the inventory/parity gate and both full suites with no
silent omissions, then inspect every disposition.

### P1: Documentation-aligned execution profiles

**User Story**: As the maintainer, I want to test Bun's documented fast paths so
that a conservative serial configuration is not mistaken for Bun's ceiling.

1. The system SHALL measure a one-worker parity profile for Vitest and isolated Bun Test.
2. The system SHALL measure bounded isolated-parallel profiles with matching worker counts for both runners.
3. WHEN a cohort passes state-leak and order-independence probes THEN the system MAY evaluate Bun `--parallel --no-isolate` for that cohort.
4. IF a profile changes inventory, outcomes, skips, leaks state, or introduces resource contention THEN the system SHALL mark it invalid rather than report it as faster.
5. WHEN memory is evaluated THEN the system SHALL include a documented `--smol` candidate and SHALL keep its result separate from normal-throughput profiles.
6. The system SHALL generate per-file timing evidence before choosing representative cohorts or finalists.
7. The system SHALL NOT enable intra-file concurrency for files with shared mutable state without independent proof of safety.

**Independent Test**: Execute the profile matrix on representative pure,
mocks/timers, DOM, and integration cohorts and validate every finalist.

### P1: Controlled benchmark evidence

**User Story**: As the maintainer, I want repeatable measurements so that the
runner decision is supported by numbers rather than presentation claims.

1. WHEN a benchmark arm starts THEN the system SHALL record runtime, runner, versions, executable, commit, command, worker count, isolation mode, host load, and timestamp.
2. WHEN finalists are measured THEN the system SHALL discard at least one warm-up and record at least five interleaved measured samples per arm.
3. WHEN an arm completes THEN the system SHALL record wall time, peak RSS, exit status, passed, failed, skipped, file count, and test count.
4. IF inventories or outcomes differ THEN the system SHALL invalidate the performance comparison and SHALL NOT name a winner.
5. IF ambient load or another known shared-resource run contaminates a sample THEN the system SHALL retain it as excluded evidence with the reason.
6. WHEN reports are written THEN the system SHALL create non-overwriting JSON and Markdown artifacts under `docs/benchmarks/bun-test-revalidation/`.
7. WHEN results are summarized THEN the system SHALL report medians and spread, not only the best run.
8. WHEN a decision is made THEN memory SHALL be the primary local/worktree metric, wall time the secondary metric, and CI implications a separate assessment.

**Independent Test**: Run a fixture benchmark to prove invalidation and report
generation, then run the complete finalist benchmark.

### P2: Reversible decision

**User Story**: As the maintainer, I want a clear adoption rule so that the
experiment cannot destabilize the current stack.

1. WHILE final evidence is incomplete, the system SHALL keep `test` mapped to Bun-hosted Vitest.
2. IF Bun Test wins with equivalent results and materially better operational metrics THEN the final report SHALL propose the smallest safe adoption boundary.
3. IF different cohorts favor different runners THEN the report SHALL permit a split recommendation without duplicating CI work by default.
4. IF Bun Test does not win or maintenance cost is disproportionate THEN the system SHALL preserve Vitest and archive the candidate evidence.
5. WHEN the decision is complete THEN `.specs/STATE.md` and testing documentation SHALL state which prior decision remains active or is superseded.

**Independent Test**: Verify package scripts, active decision records, and the
final report agree.

## Edge Cases

- Candidate file exists but silently has fewer leaf tests or assertions.
- A module mock is registered after the real module has already executed side effects.
- Happy DOM replaces Bun-native `Request`, `Response`, or `Headers` in server tests.
- `--no-isolate` passes once but fails under reversed/randomized file order.
- Parallel PGLite, port, temp-file, or Docker tests contend across workers/worktrees.
- Fake timers or system time remain active after a test.
- Bun and Vitest apply different test/hook timeout semantics.
- Warm-up, filesystem cache, host load, or arm order systematically favors one runner.
- RSS aggregation omits child worker processes.
- A faster arm has different skips, files, or leaf-test outcomes.

## Requirement Traceability

| ID | Requirement | Phase |
| --- | --- | --- |
| BTRV-01 | Independent equivalent runner-first suites | Tasks/Execute |
| BTRV-02 | Native DOM, mocks, lifecycle and time semantics | Tasks/Execute |
| BTRV-03 | Safe documented execution profiles | Tasks/Execute |
| BTRV-04 | Inventory and outcome invalidation | Tasks/Execute |
| BTRV-05 | Warm-up and interleaved multi-sample measurement | Tasks/Execute |
| BTRV-06 | Peak-memory-first local decision | Tasks/Execute |
| BTRV-07 | Versioned raw and narrative evidence | Tasks/Execute |
| BTRV-08 | Reversible final recommendation | Validation |

## Final traceability

| Requirement | Evidence | Status |
| --- | --- | --- |
| BTRV-01 | `bun run test:parity`: 133 reference / 113 candidate files; explicit infrastructure dispositions | ✅ Verified |
| BTRV-02 | Native DOM/resource semantics plus isolated candidate run: 2,057 pass / 84 skips / 0 failures | ✅ Verified |
| BTRV-03 | `matrix-2026-08-24.md`: matched isolated 1/2/4 and Bun `--smol`-2 profiles | ✅ Verified |
| BTRV-04 | All finalist raw outcomes agree at 113 files, 2,057 pass, 84 skips, 0 failures; fully skipped DB files are named | ✅ Verified |
| BTRV-05 | Four raw runs each retain one warm-up and five valid interleaved samples per arm | ✅ Verified |
| BTRV-06 | Final matrix reports process-tree peak RSS, RSS·time, wall time, and serialized throughput | ✅ Verified |
| BTRV-07 | Non-overwriting JSON/Markdown pairs are linked from `README.md` | ✅ Verified |
| BTRV-08 | `README.md`, `.specs/STATE.md`, and `.agents/rules/testing.md` preserve AD-004 and opt-in candidates | ✅ Verified |
