# Bun Test Revalidation Validation

<!-- verdict: PASS -->

**Verdict**: PASS
**Iteration**: 2
**Date**: 2026-08-24
**Spec**: `.specs/features/bun-test-revalidation/spec.md`
**Diff range**: `615da7d90a542717416c7a49fde89e4fa8b0ae98..be377cb`
**Remediation commits**: `ed5f26d`, `ac12830`, `3d66dcc`, `9d022e7`, `be377cb`
**Verifier**: independent TLC verifier (author != verifier)

All BTRV requirements and T1-T9 pass. The remediation closes every prior
blocker: the final matrix covers isolated 1/2/4 plus `--smol`-2, each arm keeps
all 113 product files, DB-unavailable behavior is symmetric and sanitized,
STATE/testing guidance match the branch, and fresh local gates pass.

## Prior Gap Closure

| Iteration-1 gap | Remediation evidence | Result |
| --- | --- | --- |
| Missing isolated-2, isolated-4, and `--smol` final runs | Four linked raw pairs and five valid samples per arm at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:3` | CLOSED |
| Three product integration files omitted | All arms report 113 files; named fully skipped files and equal 84 leaf skips at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:21` | CLOSED |
| STATE/testing rules contradicted executable candidates | AD-004 and handoff reconciled at `.specs/STATE.md:30`; opt-in candidate policy at `.agents/rules/testing.md:28` | CLOSED |
| Final Vitest gate failed against an unrelated listener | Loopback DB URL is fixed in `package.json:17`; availability is probed before suite execution, and fresh full gates pass | CLOSED |

## Task Completion

| Task | Status | Evidence and outcome |
| --- | --- | --- |
| T1 | PASS | Separate Bun-first tree remains present; live parity reports 133 reference files, 113 candidate product files, and 20 explicit infrastructure dispositions. |
| T2 | PASS | Scoped Happy DOM candidate remains isolated; fresh Bun suite completes 2,057 pass / 101 raw skip lines / 0 fail. |
| T3 | PASS | Native lifecycle/resource semantics remain represented; fresh isolated candidate run is green and static parity passes. |
| T4 | PASS | Leaf/hook/resource and runtime-outcome mismatches are rejected by exact assertions at `app/tests/test-migration-parity.test.ts:95` and `app/tests/test-migration-parity.test.ts:175`. |
| T5 | PASS | Explicit matched 1/2/4, shared probes, and isolated `--smol` routes are asserted at `app/tests/test-scripts.test.ts:57`; `test` remains Vitest at `package.json:15`. |
| T6 | PASS | Sanitization, skipped-file normalization, warm-up, rotation, contamination, timeout, outcome invalidation, RSS descendants, and unique reports are covered at `app/tests/bench-runner.test.ts:40`, `app/tests/bench-runner.test.ts:57`, `app/tests/bench-runner.test.ts:216`, `app/tests/bench-runner.test.ts:243`, and `app/tests/bench-runner.test.ts:301`. |
| T7 | PASS | Cohort screens and no-isolate rejections remain versioned; finalists are explicitly promoted in `docs/benchmarks/bun-test-revalidation/cohort-screening.md:100`. |
| T8 | PASS | Four final pairs, complete 113-file inventory, five valid samples per arm, warm-ups, excluded contamination, and internally consistent JSON/Markdown are recorded at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:3`. |
| T9 | PASS | Profile-scoped decision, memory-first interpretation, defaults/CI preservation, STATE, and testing guidance agree at `docs/benchmarks/bun-test-revalidation/README.md:6`, `.specs/STATE.md:30`, and `.agents/rules/testing.md:28`. |

## Spec-Anchored Requirement Check

| Requirement | Spec-defined outcome | Evidence (`file:line` + assertion/outcome) | Result |
| --- | --- | --- | --- |
| BTRV-01 | Independent equivalent runner-first suites | `app/tests/test-migration-parity.test.ts:95` asserts `expect(result.ok).toBe(false)` for drift; live parity passes 133/113 with 20 complete dispositions. | PASS |
| BTRV-02 | Native DOM, mocks, lifecycle, time, and state cleanup | `app/tests/test-migration-parity.test.ts:97` asserts exact leaf/hook/resource mismatch reasons; fresh isolated Bun run is 2,057 pass / 0 fail. | PASS |
| BTRV-03 | Safe documented serial, bounded parallel, and memory profiles | `app/tests/test-scripts.test.ts:61` asserts matched 1/2/4 routes; `app/tests/test-scripts.test.ts:76` asserts opt-in shared and isolated `--smol`; four final profiles appear at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:9`. | PASS |
| BTRV-04 | Inventory/outcome differences invalidate comparison | `app/tests/test-migration-parity.test.ts:175` asserts mismatch invalidation; every raw run has `validComparison: true`, no invalid reasons, and equal 113/2,057/84/0 outcomes summarized at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:21`. | PASS |
| BTRV-05 | One discarded warm-up and >=5 interleaved measured samples per finalist | Each raw JSON records `repetitions: 5`, two arm warm-ups, and `sampleCount: 5`; isolated-1 evidence starts at `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T21-12-52-666Z.json:67`, with the other three pairs linked at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:16`. | PASS |
| BTRV-06 | Peak-memory-first local decision with wall time secondary | Exact per-profile peak RSS, wall-time, throughput, and RSS*time calculations are reported at `docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md:37`; operational caveat preserves peak RSS as primary at `docs/benchmarks/bun-test-revalidation/README.md:51`. | PASS |
| BTRV-07 | Non-overwriting raw and narrative evidence | Four JSON/Markdown pairs are linked at `docs/benchmarks/bun-test-revalidation/README.md:41`; unique-path behavior is asserted at `app/tests/bench-runner.test.ts:389`. | PASS |
| BTRV-08 | Reversible recommendation; no silent default/CI cutover | `package.json:15` keeps `test` on Bun-hosted Vitest; AD-004 stays active at `.specs/STATE.md:30`; opt-in-only policy is explicit at `.agents/rules/testing.md:28`. | PASS |

## Raw Matrix Verification

All figures below were independently recalculated from the four raw JSON
artifacts using Vitest as the baseline.

| Profile | Vitest median / peak RSS | Bun median / peak RSS | Bun wall time | Bun throughput | Bun peak RSS | Bun RSS*time |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| isolated-1 | 55,548.861 ms / 2,278.6 MiB | 38,270.695 ms / 2,777.5 MiB | 31.104% faster | 45.147% higher | 21.897% higher | 16.018% lower |
| isolated-2 | 33,080.083 ms / 2,751.9 MiB | 25,922.183 ms / 2,841.1 MiB | 21.638% faster | 27.613% higher | 3.239% higher | 19.100% lower |
| isolated-4 | 20,433.191 ms / 3,394.8 MiB | 21,318.027 ms / 3,031.2 MiB | 4.330% slower | 4.151% lower | 10.709% lower | 6.842% lower |
| `--smol`-2 | 38,189.608 ms / 2,631.5 MiB | 32,915.625 ms / 2,728.3 MiB | 13.810% faster | 16.023% higher | 3.679% higher | 10.639% lower |

Raw aggregate citations:

- isolated-1: `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T21-12-52-666Z.json:463`
- isolated-2: `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T21-37-17-650Z.json:463`
- isolated-4: `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T21-45-50-205Z.json:866`
- `--smol`-2: `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T22-04-15-738Z.json:664`

Each artifact has `validComparison: true`, empty `invalidReasons`, five valid
samples for each arm, one warm-up per arm, and the complete 113-file product
inventory. Isolated-4 retains 12 contaminated attempts; `--smol`-2 retains 6.
They do not contribute to medians.

The user's 31% statement is now supported specifically for isolated-1:
31.104% less wall time. Bun also lowers the peak-RSS*time approximation in all
four profiles. This remains an occupancy approximation, not proof that another
worktree can always start immediately; peak RSS is higher for Bun at 1/2 and
`--smol`-2 and lower only at isolated-4.

## Inventory and Outcome Parity

- Static inventory: 133 canonical files, 113 candidate product files, 20
  explicit Vitest-only infrastructure dispositions, zero unexplained files.
- Every valid benchmark sample: 113 files, 2,057 passed, 84 skipped, 0 failed,
  0 todo.
- `auth-integ.test.ts`, `indexer-integ.test.ts`, and `sync-integ.test.ts` are
  present in both commands. On this host, the local PostgreSQL probe marks each
  fully skipped in both arms; leaf identities remain in the manifest.
- Bun's raw console emits 101 skip lines because skipped `describe` wrappers are
  repeated. Parser tests normalize this to the same 84 skipped leaves asserted
  by Vitest at `app/tests/bench-runner.test.ts:232` and
  `app/tests/bench-runner.test.ts:243`.
- Benchmark subprocesses discard inherited DB credentials and use the fixed
  loopback fixture; exact assertions are at `app/tests/bench-runner.test.ts:216`.

## Discrimination Sensor, Iteration 2

**Depth**: lightweight, one behavior-level mutation targeting the new DB
sanitization boundary.

| Mutation | Isolated result | Verdict |
| --- | --- | --- |
| Changed `sanitizedBenchmarkEnv()` to preserve `env.DATABASE_URL` instead of forcing `LOCAL_TEST_DATABASE_URL` | `bun run test:vitest:bun -- app/tests/bench-runner.test.ts` exited 1; exact failure at `app/tests/bench-runner.test.ts:224`: expected loopback URL, received `postgres://remote.example/blog` | KILLED |

Commands:

```text
git worktree add --detach /tmp/btrv-verifier2.73iFFw/scratch HEAD
ln -s /Users/antoniofulg/Projects/blog/node_modules /tmp/btrv-verifier2.73iFFw/scratch/node_modules
bun run test:vitest:bun -- app/tests/bench-runner.test.ts
git worktree remove --force /tmp/btrv-verifier2.73iFFw/scratch
```

The real-tree porcelain was identical before and after the sensor:
`?? docs/_reports/`. That untracked generated directory predated this verifier
iteration and was preserved. The temporary worktree and directory were removed.

## Fresh Gate Evidence

| Command | Fresh result |
| --- | --- |
| `python3 .../validate_spec.py .specs/features/bun-test-revalidation/spec.md` | PASS: 0 errors, 0 warnings |
| `python3 .../validate_tasks.py .specs/features/bun-test-revalidation/tasks.md` | PASS: 0 errors, 0 warnings |
| `bun run test:vitest:bun` | PASS: 130 passed files, 3 intentionally skipped files; 2,273 passed tests, 84 skipped |
| `TZ=UTC bun run test:bun:parity` | PASS: 113 files; 2,057 pass, 101 raw skip lines, 0 fail |
| `bun run test:parity` | PASS: 133 reference / 113 candidate files |
| Focused benchmark/parity/runtime/script tests | PASS: 5 files, 48 tests |
| `bun run lint && bunx tsc --noEmit && bun run build && bun run lint:tests` | PASS; only existing route/chunk/build warnings |
| `bun run test:e2e -- --grep @smoke` | PASS: 44/44 Chromium tests |

No tests were weakened or deleted during remediation. The new checks assert
DB sanitization, fully skipped file normalization, explicit isolation flags,
and descendant RSS aggregation. Test count increased from the iteration-1
focused result of 46 to 48.

## Defaults, CI, and Documentation

- `test` and `test:local` exactly match feature baseline `615da7d` at
  `package.json:15` and `package.json:16`. Their runner remains Bun-hosted
  Vitest; only the underlying test routes now sanitize DB input.
- `git diff --quiet 615da7d..HEAD -- .github/workflows/ci.yml` exits 0. CI is
  unchanged by the feature.
- Playwright routes remain unchanged; fresh Chromium smoke is green.
- `.specs/STATE.md:30`, `.specs/STATE.md:38`,
  `.agents/rules/testing.md:28`, and
  `docs/benchmarks/bun-test-revalidation/README.md:14` agree: AD-004 remains
  active, Vitest stays default/CI, and Bun profiles are opt-in candidates.

## Code Quality

| Principle | Status |
| --- | --- |
| No production behavior change | PASS |
| Independent native suites | PASS |
| Complete product inventory | PASS |
| Outcome-aware invalidation | PASS |
| Safe environment and process cleanup | PASS |
| No default/CI cutover | PASS |
| Surgical remediation of iteration-1 gaps | PASS |
| Documented testing rules and project state agree | PASS |

## Non-blocking Methodology Note

The isolated-1 artifact was collected at `ed5f26d`; the later `ac12830` change
replaced process-group RSS enumeration with explicit descendant traversal for
parallel workers. Isolated-2, isolated-4, and `--smol`-2 use the newer sampler.
This does not block isolated-1: its one-worker arms stayed inside the detached
process group, both arms used the same sampler, and descendant-RSS behavior is
now guarded at `app/tests/bench-runner.test.ts:57`. Future matrix refreshes
should rerun all four profiles at one commit for cleaner cross-profile
provenance.

## Requirement Traceability Update

| Requirement | Previous verifier status | Iteration-2 status |
| --- | --- | --- |
| BTRV-01 | Verified | Verified |
| BTRV-02 | Verified | Verified |
| BTRV-03 | Needed final profile evidence | Verified |
| BTRV-04 | Needed complete product inventory | Verified |
| BTRV-05 | Needed all-finalist samples | Verified |
| BTRV-06 | Needed final memory matrix | Verified |
| BTRV-07 | Isolated-1 only | Verified across all four profiles |
| BTRV-08 | Needed state/docs/gate reconciliation | Verified |

