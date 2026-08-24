# Bun Test Revalidation Validation

<!-- verdict: FAIL -->

**Verdict**: FAIL
**Date**: 2026-08-24
**Spec**: `.specs/features/bun-test-revalidation/spec.md`
**Diff range**: `615da7d90a542717416c7a49fde89e4fa8b0ae98..94595ef`
**Verifier**: independent TLC verifier (author != verifier)

The isolated one-worker evidence is internally consistent and favors Bun Test
on elapsed time. The feature is not complete against its approved scope. T8
did not measure every finalist promoted by T7, and its only valid run excludes
three product integration files while calling the result a full-suite run.

## Ranked Gaps

1. **T8 did not measure all promoted finalists.** T7 promotes isolated Bun
   profiles 1/2/4 and retains `--smol` as a full-benchmark memory candidate at
   `docs/benchmarks/bun-test-revalidation/cohort-screening.md:100`. T8 records
   only isolated-1, while its own report acknowledges the missing isolated-2,
   isolated-4, and `--smol` matrix at
   `docs/benchmarks/bun-test-revalidation/README.md:40`. This contradicts the
   checked claim that every finalist has five measured samples at
   `.specs/features/bun-test-revalidation/tasks.md:250`.
2. **The T8 artifact is not a complete product full-suite benchmark.** The
   final runner removes `auth-integ.test.ts`, `indexer-integ.test.ts`, and
   `sync-integ.test.ts` from both arms at
   `scripts/run-bun-revalidation-final.ts:32` and
   `scripts/run-bun-revalidation-final.ts:58`. The artifact therefore measures
   110 files although the candidate product inventory contains 113. This
   violates the no-silent-omission independent test at
   `.specs/features/bun-test-revalidation/spec.md:67` and the complete-finalist
   benchmark requirement at `.specs/features/bun-test-revalidation/spec.md:100`.
3. **Decision memory and testing docs are stale/internally inconsistent.**
   AD-004 accurately records the narrowed result at `.specs/STATE.md:30`, but
   the handoff still says the candidate tree, parity tooling, and live commands
   are retired and names branch `chore/retire-bun-test` at
   `.specs/STATE.md:38`. Current testing guidance also says not to restore Bun
   Test parity at `.agents/rules/testing.md:28`, while this branch deliberately
   restores experimental parity/profile routes in `package.json:22`.
4. **The mandatory final local gate is not green.** The fresh Vitest run stopped
   at `app/tests/indexer-integ.test.ts:25` because port 5432 was occupied by no
   reachable PostgreSQL (`ECONNREFUSED ::1:5432` and
   `ECONNREFUSED 127.0.0.1:5432`). It completed 130 passing files and 2,271
   passing tests before reporting one failed suite. This is an environment
   prerequisite failure, not evidence of a Bun implementation regression, but
   it falsifies the checked T9 claim “Full local gates pass” at
   `.specs/features/bun-test-revalidation/tasks.md:283`.

## Task Completion

| Task | Status | Evidence and verdict |
| --- | --- | --- |
| T1 | PASS | Independent `app/tests-bun/` exists; static parity reports 133 reference files, 113 candidate files, and 20 explicit infrastructure dispositions. |
| T2 | PASS | Scoped Happy DOM candidate is present; candidate full run completes 2,057 pass / 101 documented skips / 0 fail. |
| T3 | PASS | Candidate isolated run is stable and parity checks leaf identities, hooks, fixtures, and resource semantics; mismatch assertions are at `app/tests/test-migration-parity.test.ts:80`. |
| T4 | PASS | Runtime count/leaf mismatches are rejected by exact assertions at `app/tests/test-migration-parity.test.ts:152`; the live parity gate passes. |
| T5 | PASS | Matched 1/2/4, isolated/shared, and separate `--smol` routes are asserted at `app/tests/test-scripts.test.ts:51`; default `test` remains Vitest at `package.json:15`. |
| T6 | PASS | Warm-up, rotation, medians, contamination, timeout, mismatch invalidation, and non-overwriting reports have exact assertions at `app/tests/bench-runner.test.ts:260`, `app/tests/bench-runner.test.ts:281`, `app/tests/bench-runner.test.ts:305`, `app/tests/bench-runner.test.ts:329`, and `app/tests/bench-runner.test.ts:348`. |
| T7 | PASS | Cohorts, order/leak probes, matched 1/2/4 screens, and separate `--smol` screen are preserved at `docs/benchmarks/bun-test-revalidation/cohort-screening.md:35`, `docs/benchmarks/bun-test-revalidation/cohort-screening.md:49`, and `docs/benchmarks/bun-test-revalidation/cohort-screening.md:81`. |
| T8 | FAIL | Only isolated-1 has five valid samples; isolated-2, isolated-4, and `--smol` lack final runs. The only final run also excludes three product integration files. |
| T9 | FAIL | Conservative default decision is reasonable for the narrowed evidence, but T8 is incomplete, STATE/testing docs conflict with the branch, and the mandatory final gate is not green. |

## Spec-Anchored Requirement Check

| Requirement | Spec-defined outcome | Evidence (`file:line` + assertion/outcome) | Result |
| --- | --- | --- | --- |
| BTRV-01 | Independent equivalent runner-first suites | `app/tests/test-migration-parity.test.ts:95` - `expect(result.ok).toBe(false)` for semantic drift; live `bun run test:parity` passes 133/113 with 20 dispositions. | PASS |
| BTRV-02 | Native DOM, mocks, lifecycle, and state cleanup | `app/tests/test-migration-parity.test.ts:97` - exact leaf, hook, and resource-semantic mismatch assertions; candidate isolated full run is 2,057 pass / 101 skip / 0 fail. | PASS |
| BTRV-03 | Safe documented execution profiles | `app/tests/test-scripts.test.ts:55` - exact 1/2/4 worker assertions; T7 rejects unsafe no-isolate cohorts, but promoted 2/4 and `--smol` profiles were not finally measured. | PARTIAL |
| BTRV-04 | Inventory/outcome mismatch invalidates comparison | `app/tests/test-migration-parity.test.ts:175` - `expect(result.ok).toBe(false)` for skip/leaf drift; isolated-1 matched 110/2,057/67. Full product inventory was narrowed by three un-dispositioned benchmark exclusions. | FAIL |
| BTRV-05 | Warm-up plus at least five interleaved samples per finalist | `app/tests/bench-runner.test.ts:269` - valid comparison, discarded warm-ups, rotated order, exact medians; JSON records five valid samples per isolated-1 arm at `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T20-36-29-794Z.json:684`. Other finalists have zero decision-quality samples. | FAIL |
| BTRV-06 | Peak-memory-first local decision | JSON medians are 2,104,229,888 vs 2,684,026,880 bytes at `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T20-36-29-794Z.json:684`; report keeps Vitest due higher Bun peak RSS at `docs/benchmarks/bun-test-revalidation/README.md:27`. Missing `--smol` final evidence prevents closure. | FAIL |
| BTRV-07 | Versioned raw and narrative evidence | JSON/Markdown pair exists; non-overwrite and invalidity retention are asserted at `app/tests/bench-runner.test.ts:375`; JSON marks comparison valid with no invalid reasons at `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T20-36-29-794Z.json:14521`. | PASS for isolated-1 evidence |
| BTRV-08 | Reversible, consistent recommendation | `package.json:15` keeps `test` on Bun-hosted Vitest and CI is unchanged from feature baseline. `.specs/STATE.md:38` and `.agents/rules/testing.md:28` conflict with current experimental files/routes. | FAIL |

## Final Artifact Recalculation

Source: `docs/benchmarks/bun-test-revalidation/runs/run-2026-08-24T20-36-29-794Z.json`.

- Vitest median: 55,670.681 ms; median process-tree peak RSS: 2,104,229,888
  bytes (2,006.8 MiB); 5 valid samples.
- Bun Test median: 40,762.489 ms; median process-tree peak RSS:
  2,684,026,880 bytes (2,559.7 MiB); 5 valid samples.
- Wall-time reduction: `(55,670.681 - 40,762.489) / 55,670.681 = 26.779%`.
- Serialized throughput gain: `55,670.681 / 40,762.489 - 1 = 36.573%`.
- Peak-RSS increase: `(2,684,026,880 - 2,104,229,888) / 2,104,229,888 = 27.554%`.
- Peak-RSS x median-time approximation: Vitest 111,717 MiB*s; Bun
  104,339 MiB*s; Bun is 6.604% lower.
- All ten valid samples report the same 110 files, 2,057 passed, 0 failed,
  67 skipped, and 0 todo. Two warm-ups and eight contaminated attempts are
  retained as excluded samples.

The user's occupancy argument is supported only in this narrow sense: Bun
releases a serialized slot 26.8% sooner and has 6.6% lower peak-RSS x time.
It does not prove that another worktree can start safely sooner because Bun's
instantaneous peak is 27.6% higher and the required 2/4-worker/`--smol` matrix
is missing. The current valid artifact does not show a 31% time reduction.

## Discrimination Sensor

**Depth**: lightweight, one behavior-level inventory mutation.

| Mutation | Scratch evidence | Result |
| --- | --- | --- |
| Rename one Bun leaf test in `app/tests-bun/strings.test.ts` while leaving the Vitest twin unchanged | Temporary detached worktree; `bun run test:parity` exited 1 with `strings.test.ts: leaf test identities differ` | KILLED / PASS |

Commands:

```text
git worktree add --detach /tmp/btrv-verifier.Yo6Vtl/scratch HEAD
ln -s /Users/antoniofulg/Projects/blog/node_modules /tmp/btrv-verifier.Yo6Vtl/scratch/node_modules
bun run test:parity
git worktree remove --force /tmp/btrv-verifier.Yo6Vtl/scratch
```

Real-tree `git status --porcelain=v1` was empty before and after the sensor.
The temporary worktree and parent temp directory were removed.

## Gate Check

| Command | Result |
| --- | --- |
| `python3 .../validate_spec.py .specs/features/bun-test-revalidation/spec.md` | PASS: 0 errors, 0 warnings |
| `python3 .../validate_tasks.py .specs/features/bun-test-revalidation/tasks.md` | PASS: 0 errors, 0 warnings |
| `bun run test:vitest:bun` | FAIL: 130 files / 2,271 tests passed; `indexer-integ` could not connect to local PostgreSQL; one failed suite |
| `TZ=UTC bun run test:bun:parity` | PASS: 2,057 pass, 101 skip, 0 fail across 113 files |
| `bun run test:parity` | PASS: 133 reference / 113 candidate, 20 dispositions |
| Focused benchmark/parity/runtime/script tests | PASS: 5 files, 46 tests |
| `bun run lint && bunx tsc --noEmit && bun run build && bun run lint:tests` | PASS; build emitted existing route/chunk warnings only |
| `bun run test:e2e -- --grep @smoke` | PASS: 44/44 Chromium tests |

Baseline test count before this feature was not recorded in the task artifacts,
so the requested numeric before/after test-count delta cannot be independently
reconstructed. No canonical product test deletion appears in the feature diff.

## Defaults and CI

- `package.json:15` and `package.json:16` match feature baseline `615da7d`
  exactly: `test` remains Bun-hosted Vitest and `test:local` remains one-worker
  Vitest.
- `git diff --quiet 615da7d..HEAD -- .github/workflows/ci.yml` exits 0. CI is
  unchanged by this feature.
- Playwright routes remain unchanged and the fresh Chromium smoke passes.

## Code Quality

| Principle | Status |
| --- | --- |
| No production behavior change | PASS |
| Independent suites and native runner APIs | PASS |
| Deterministic mismatch and contamination checks | PASS |
| No default/CI cutover | PASS |
| Complete required evidence | FAIL: missing finalist matrix and three omitted product files |
| Documentation/STATE consistency | FAIL |
| Documented guidelines followed | PARTIAL: `.agents/rules/testing.md` conflicts with the restored experiment routes |

## Required Fix Plan

1. Run decision-quality full measurements for isolated-2, isolated-4, and the
   separately labeled `--smol` finalist, or amend/re-approve the spec and T7
   finalist decision to explicitly narrow T8.
2. Include `auth-integ`, `indexer-integ`, and `sync-integ` in the controlled
   full benchmark with isolated resources, or record an approved explicit
   incompatibility disposition. Do not call a 110-of-113 product run full-suite.
3. Reconcile `.specs/STATE.md` handoff and `.agents/rules/testing.md` with the
   actual experimental candidate/routes while preserving AD-004.
4. Start a valid local PostgreSQL fixture and rerun the final gate.

## Requirement Traceability Update

| Requirement | Task claim | Verifier status |
| --- | --- | --- |
| BTRV-01 | Complete | Verified |
| BTRV-02 | Complete | Verified |
| BTRV-03 | Complete | Needs final profile evidence |
| BTRV-04 | Complete | Needs complete product-run inventory |
| BTRV-05 | Complete | Needs all-finalist samples |
| BTRV-06 | Complete | Needs final `--smol`/parallel memory matrix |
| BTRV-07 | Complete | Verified for isolated-1 only |
| BTRV-08 | Complete | Needs documentation/state reconciliation and green final gate |
