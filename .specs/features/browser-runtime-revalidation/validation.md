# Browser Runtime Revalidation Validation — Iteration 3

**Verdict**: FAIL
**Date**: 2026-08-24
**Spec**: `.specs/features/browser-runtime-revalidation/spec.md`
**Diff range**: `68138dd^..85c71ce`
**Iteration-3 commits**: `09c0ef7`, `fccd508`, `7fda7f2`, `85c71ce`
**Verifier**: independent sub-agent (author != verifier)

Iteration 3 fixes the exact Playwright inventory, one-warm-up coordinator, per-pass WebView timing, empirical provenance, setup duration, fresh full screening, selected warm finalist confirmations, report links, and metric table. Three blockers remain:

1. The spec requires Node 24. Both fresh runs measured Node **22.23.1**.
2. Warm finalist passes are not interleaved with other profiles. Code executes all cold confirmations first, then each warm profile's complete six-pass session sequentially, while raw metadata claims a six-profile round-robin schedule.
3. Fresh confirmation marks only `webview:webkit:warm:1view:smol` non-dominated, but README/STATE say both warm profiles are confirmed non-dominated.

Because BRR-02/BRR-05 and the final report are not closed, T2/T4/T5/T6 cannot pass.

## Task Completion

| Task | Status | Evidence |
| --- | --- | --- |
| T1 | PASS | Canonical five-route contract remains exact at `app/lib/browser-bench/contract.ts:1`. |
| T2 | FAIL | Exact Node/Bun worker arms and inventory exist, but Node arms used 22.23.1 rather than required Node 24. |
| T3 | PASS | WebKit/Chrome are screened separately; WebView exact outcomes, backend provenance, pass timing, view closure, and process cleanup are retained. Unavailable Chrome arms are invalidated with exit/missing-outcome reasons. |
| T4 | FAIL | Screening/Pareto/cold-warm mechanics pass, but warm confirmations are labeled interleaved without being scheduled round-robin. |
| T5 | FAIL | Raw counts/math are internally consistent, but runtime and schedule do not match the approved protocol. |
| T6 | FAIL | Comparison table and links pass; decision misstates the final Pareto set and omits that “Node” evidence is Node 22 rather than Node 24. |

## BRR Requirement Verdicts

| Requirement | Required outcome | Iteration-3 evidence | Result |
| --- | --- | --- | --- |
| BRR-01 | Same exact five-route Playwright inventory in every arm | Grep at `scripts/bench-e2e-runtimes.ts:31` excludes `/en/`; parser rejects unknown/duplicate inventory at `scripts/bench-browser-runtimes.ts:187`. Fresh locked smoke ran setup + exactly five public tests. Raw inventory is 6 with one setup. | PASS |
| BRR-02 | Node 24/Bun 1.4 workers 1/2; one warm-up and five valid interleaved samples | All four arms have one warm-up + 5/5 valid measured samples. Bun is 1.4.0. Node samples record `runtimeVersion: "22.23.1"`, e.g. `run-2026-08-25T02-34-46-895Z.json:94`, contradicting `spec.md:35`. | FAIL |
| BRR-03 | Equivalent WebKit/Chrome smoke with deterministic cleanup and local-only status | Full matrix contains every backend/session/view/`--smol` arm. WebKit exact outcomes pass; Chrome unavailability is retained as invalid evidence. All measured groups record cleanup verification; WebView closes views in `finally`. | PASS |
| BRR-04 | Cold/warm/serial/two-view/`--smol` screening and non-dominated finalist selection | `run-2026-08-25T02-31-40-880Z.json` has one warm-up + three screening samples or bounded invalid attempts for all 20 arms. Programmatic screening selected WebKit cold 1-view plus warm 1-view normal/`--smol`; confirmation reduced final Pareto to the two warm profiles. | PASS |
| BRR-05 | Controlled repeated process-tree benchmark, exact provenance, one warm-up, five interleaved samples, contamination/cleanup, time/RSS/RSS×time | Counts, exact outcomes, process-tree RSS, cleanup, contamination, pass durations, browser/Bun provenance, setup ms, and math pass. Node provenance fails. Actual warm execution is sequential despite `finalistSchedule` claiming interleaving. | FAIL |
| BRR-06 | Coverage-aware local-only decision, correct time/RSS/RSS×time/throughput comparison, unchanged defaults/CI/config | Metric math/table and unchanged defaults pass. Final confirmation's `finalists` contains only warm `--smol`, while README/STATE call both warm profiles non-dominated. Node 22 evidence is presented as satisfying the Node comparison without qualification. | FAIL |

## Exact Inventory and Outcomes

Fresh Chromium gate under CRM + Antclips locks:

- 1 setup test: `authenticate as admin`.
- 5 canonical public tests: English post, Portuguese post, not-found, `/pt-br/`, `/`.
- `/en/` no longer selected.
- Result: 6/6 passed.

Every valid Playwright confirmation sample contains:

- `inventory: 6`
- `setupOverhead: 1`
- five route identities in canonical order, all passed
- measured `setupOverheadMs`

Every valid WebKit confirmation sample contains the same five route identities. WebView additionally retains HTTP statuses, including 404 for the unknown post. The native Playwright tests assert route status/content at `tests/e2e/public-read.spec.ts:20`, `tests/e2e/public-read.spec.ts:47`, `tests/e2e/public-read.spec.ts:178`, and `tests/e2e/public-read.spec.ts:202`.

**Outcome status**: PASS.

## Fresh Screening

Artifact: `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T02-31-40-880Z.json`.

- Schema 2, commit `fccd508`.
- 20 requested profiles present.
- `screeningRepetitions: 3`, `warmupsPerProfile: 1`.
- Playwright Node/Bun workers 1/2: 3/3 valid screening samples each.
- WebKit/Chrome cold/warm, 1/2 views, normal/`--smol`: all attempted.
- Invalid profiles retain exit/outcome/sample-count reasons. Chrome profiles consistently exit 1 with missing smoke output and are excluded rather than ranked.
- Screening finalists: WebKit cold 1-view, WebKit warm 1-view, WebKit warm 1-view `--smol`.
- After five-sample confirmation inside the run, final non-dominated profiles are both warm variants.
- Warm samples use actual varying `passDurationsMs`; cold samples restart server/browser/process.
- No extra warm-ups.

**Screening status**: PASS.

## Fresh Confirmation

Artifact: `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T02-34-46-895Z.json`.

| Profile | Runtime provenance | Warm-ups | Valid samples | Invalid reasons | Raw `interleaved` |
| --- | --- | ---: | ---: | ---: | --- |
| Playwright Node w1 | Node 22.23.1 | 1 | 5/5 | 0 | true |
| Playwright Bun w1 | Bun 1.4.0 | 1 | 5/5 | 0 | true |
| Playwright Node w2 | Node 22.23.1 | 1 | 5/5 | 0 | true |
| Playwright Bun w2 | Bun 1.4.0 | 1 | 5/5 | 0 | true |
| WebKit warm 1-view | Bun 1.4.0 / AppleWebKit 605.1.15 | 1 | 5/5 | 0 | true |
| WebKit warm 1-view `--smol` | Bun 1.4.0 / AppleWebKit 605.1.15 | 1 | 5/5 | 0 | true |

Counts, outcomes, contamination, cleanup, and provenance fields are internally consistent. `extraWarmups` is absent/empty.

### Interleaving blocker

Raw `finalistSchedule` declares each round in this order:

`Node1 → Bun1 → Node2 → Bun2 → WebKit warm → WebKit warm smol`

The implementation does not execute that order:

1. `runBrowserConfirmations()` awaits all cold profiles through `runColdFinalistsInterleaved()` at `scripts/bench-browser-runtimes.ts:465`.
2. Only after every cold round finishes does it call `runWarmFinalistsInterleaved()` at line 466.
3. `runWarmFinalistsInterleaved()` loops profiles at line 405 and runs all warm-up + five passes for one profile before starting the next.
4. It then assigns `result.interleaved = true` at line 409.
5. `finalistSchedule` is generated independently from desired IDs at line 471; it is not an execution trace.

Thus Playwright measured samples are interleaved with each other, but neither warm finalist is interleaved with Playwright or with the other warm finalist. This directly violates the finalist criterion at `spec.md:54`.

**Confirmation status**: FAIL.

## Cold/Warm, Provenance, Cleanup, and Contamination

| Check | Result | Evidence |
| --- | --- | --- |
| Cold lifecycle | PASS | Cold WebView restarts server/browser/process per sample at `scripts/bench-browser-runtimes.ts:311` and `scripts/bench-browser-runtimes.ts:356`. |
| Warm lifecycle | PASS | One server/process runs warm-up + passes at `scripts/bench-browser-runtimes.ts:331`. |
| Actual warm pass durations | PASS | WebView emits them at `scripts/run-e2e-webview.ts:304`; runner consumes `data.passDurationsMs[index + 1]` at `scripts/bench-browser-runtimes.ts:340`. |
| One warm-up/profile | PASS | Fresh raw has one `warmup`, no `extraWarmups`, and metadata 1. |
| Node runtime | FAIL | Empirical provenance is 22.23.1; required version is 24. |
| Bun/server runtime | PASS | 1.4.0 in every relevant sample. |
| Chromium provenance | PASS | `Google Chrome for Testing 148.0.7778.96`. |
| WebKit provenance | PASS | Runtime-emitted AppleWebKit user-agent string. |
| Setup duration | PASS | Exact setup spec duration is summed at `scripts/bench-browser-runtimes.ts:188`; raw contains one setup and measured ms. |
| Process-tree RSS | PASS | Parent/descendant sampling at `app/lib/bench/runner.server.ts:50`. |
| Cleanup | PASS | Process group verification/TERM/KILL at `app/lib/bench/runner.server.ts:103`; valid samples all true. |
| Contamination | PASS | Before/during/after sensor at `scripts/bench-browser-runtimes.ts:263`; valid samples all false for detection. |

## Math and Report Consistency

Independent recomputation against both new JSON files found no arithmetic mismatch:

- Per-sample `rssTimeBytesMs = peakRssBytes × durationMs`.
- Aggregate median time and median RSS match valid samples.
- `samplesPerMinute = 60000 / medianMs`.
- README time/RSS/RSS×time/throughput table matches confirmation aggregates after rounding.
- Every README run link resolves.
- `package.json`, `playwright.config.ts`, and `.github/**` are unchanged from the pre-feature baseline.

Remaining decision mismatch:

- Confirmation JSON `finalists` contains only `webview:webkit:warm:1view:smol` because it is faster and lower-RSS in the fresh confirmation.
- README lines 71-72 and STATE AD-005 call both warm variants “confirmed non-dominated”. Both were confirmed, but only `--smol` remained non-dominated in the final comparison.

## Fresh Gates

- Focused browser/runner tests: PASS, 5 files / 40 tests, 0 failed, 0 skipped.
- Full Vitest: PASS, 133 files passed + 3 skipped; 2,288 tests passed + 84 skipped; 0 failed.
- Biome: exit 0 with six existing `noNonNullAssertion` warnings in `app/tests/bench-browser-runtimes.test.ts`.
- TypeScript: PASS.
- Build: PASS.
- Test annotation lint: PASS.
- Fresh exact Chromium smoke: PASS, setup + five public outcomes, 6/6.
- Defaults/CI/config: PASS, zero diff.
- Evidence/finalist gate: FAIL due Node version and false warm interleaving claim.

## Discrimination Sensor — Iteration 3

Sensor ran in one detached temporary worktree. Worktree was removed/pruned and real-tree porcelain exactly matched baseline, including pre-existing untracked reports.

| Mutation | Result |
| --- | --- |
| Disable Playwright/media-host contamination matcher | KILLED by `app/tests/bench-browser-runtimes.test.ts:203` |
| Swap warm execution guard to cold | KILLED by `app/tests/bench-browser-runtimes.test.ts:188` |
| Mark sequential warm confirmations `interleaved = false` | SURVIVED: benchmark/WebView focused files, 11 tests, still passed |

**Sensor result**: FAIL, 2/3 killed. The surviving mutation targets the unresolved scheduling truth: tests check guard/source fragments and desired schedule formatting, not actual cross-profile execution order.

## Required Fix Tasks

1. **Run the Node arms under Node 24.** Validate the executable before measurement and reject any profile whose empirical version does not match the approved runtime. Re-run screening and confirmation.
2. **Implement or specify genuine warm-session interleaving.** Keep warm processes alive and alternate passes according to the round schedule, or amend the approved spec explicitly before claiming a different protocol. Do not set `interleaved: true` from intent alone.
3. **Persist actual execution order.** Record timestamps/sequence as samples execute and derive `finalistSchedule` from that trace. Add a behavior test that kills the surviving interleaving mutation.
4. **Reconcile final Pareto wording.** State that both warm variants were confirmed but only `--smol` is non-dominated in the final confirmation, unless a new run changes the result.

## Requirement Traceability

| Requirement | Iteration 2 | Iteration 3 |
| --- | --- | --- |
| BRR-01 | FAIL | PASS |
| BRR-02 | FAIL | FAIL |
| BRR-03 | PARTIAL | PASS |
| BRR-04 | FAIL | PASS |
| BRR-05 | FAIL | FAIL |
| BRR-06 | FAIL | FAIL |

## Summary

**Overall**: NOT READY

**Spec-anchored check**: 3/6 requirements verified; BRR-02, BRR-05, and BRR-06 remain failed.
**Gates**: code/test/build/browser gates pass; runtime/evidence protocol gate fails.
**Sensor**: 2/3 mutations killed; warm interleaving mutation survived.
**Defaults/CI/config**: unchanged.

Iteration 3 closes most prior blockers. PASS now requires a Node 24 rerun, genuine/persisted warm interleaving (or an approved spec change), and final Pareto wording consistent with raw evidence.
