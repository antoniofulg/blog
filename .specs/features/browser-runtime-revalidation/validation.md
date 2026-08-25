# Browser Runtime Revalidation Validation — Iteration 4

**Verdict**: FAIL
**Date**: 2026-08-25
**Spec**: `.specs/features/browser-runtime-revalidation/spec.md`
**Diff range**: `68138dd^..c7c9cff`
**Iteration-4 commits**: `261798d`, `c7c9cff`
**Verifier**: independent sub-agent (author != verifier)

Iteration 4 closes Node 24, persistent warm sessions, one warm-up per profile, exact inventory, provenance, setup timing, corrected GiB·s units, Pareto wording, and fresh evidence. One protocol blocker remains: the 36-entry `executionTrace` does not show six-profile interleaving. It concatenates the complete Playwright trace and the complete WebView trace, resets `sequence` to zero between cohorts, then derives a mixed schedule by sorting duplicate sequence numbers. Timestamps prove all Playwright samples finished before the first warm WebView pass.

The report therefore cannot claim that all six confirmation profiles were run in the recorded round-robin schedule. BRR-05 remains failed, and T4/T5/T6 are not closed.

## Task Completion

| Task | Status | Evidence |
| --- | --- | --- |
| T1 | PASS | Canonical five-route contract and normalization are exact. |
| T2 | PASS | Node 24.19.0/Bun 1.4.0, workers 1/2, exact setup + five-route inventory, one warm-up and 5/5 measured samples are retained. Playwright arms are interleaved with each other. |
| T3 | PASS | WebKit/Chrome matrix was screened; exact WebKit outcomes, backend provenance, persistent sessions, view/process cleanup and local-only isolation pass. |
| T4 | FAIL | Warm profiles are persistent and interleaved with each other, but not with the four Playwright profiles despite the six-profile schedule claim. |
| T5 | FAIL | Raw samples are valid, but `executionTrace`/`finalistSchedule` misrepresent global execution order. Both-lock acquisition is asserted, not self-enforced by the benchmark entry point. |
| T6 | FAIL | Metrics and Pareto decision are corrected, but README says the local benchmark gate is met using a false global interleaving claim. |

## BRR Requirement Verdicts

| Requirement | Required outcome | Iteration-4 evidence | Result |
| --- | --- | --- | --- |
| BRR-01 | Identical exact five-route Playwright inventory | Exact grep and parser reject `/en/`/unknown tests. Fresh locked Chromium smoke ran one setup + five public outcomes, 6/6 passed. Every raw Playwright sample has inventory 6, setup 1, routes 5. | PASS |
| BRR-02 | Node 24/Bun 1.4 workers 1/2, one warm-up, five valid interleaved samples | Raw records Node 24.19.0 and Bun 1.4.0; each arm has one warm-up, 5/5 valid samples, zero exclusions/reasons. Four Playwright arms are round-robin within the cold cohort. | PASS |
| BRR-03 | Equivalent WebKit/Chrome smoke, cleanup, local-only | Full screening covers WebKit/Chrome cold/warm, one/two views and `--smol`; unavailable/failed arms remain invalidated. Selected WebKit warm profiles retain exact five outcomes, AppleWebKit provenance and verified cleanup. | PASS |
| BRR-04 | Cold/warm/parallel/`--smol` screening and non-dominated finalist confirmation | Fresh screening selected the WebKit one-view candidates. Iteration-4 confirmation has both warm profiles at 5/5; raw Pareto correctly contains only `webview:webkit:warm:1view:smol`. | PASS |
| BRR-05 | Controlled repeated process-tree benchmark with one warm-up, five globally interleaved finalist samples, exact provenance/outcomes, contamination/cleanup and metrics | All fields/math pass except global interleaving. `runBrowserConfirmations()` awaits cold cohort, then warm cohort at `scripts/bench-browser-runtimes.ts:666`; raw timestamps show the same separation. | FAIL |
| BRR-06 | Coverage-aware local-only decision, correct time/RSS/RSS×time/throughput, unchanged defaults/CI/config | Metrics, units, links, Pareto and unchanged defaults pass. README incorrectly concludes the benchmark gate is met while the trace contradicts its six-profile schedule. | FAIL |

## Fresh Confirmation Evidence

Artifact: `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T04-16-32-724Z.json`.

| Profile | Provenance | Warm-ups | Valid samples | Cleanup | Contamination | Final Pareto |
| --- | --- | ---: | ---: | --- | --- | --- |
| Playwright Node w1 | Node 24.19.0 / Chromium 148.0.7778.96 | 1 | 5/5 | verified | none | no |
| Playwright Bun w1 | Bun 1.4.0 / Chromium 148.0.7778.96 | 1 | 5/5 | verified | none | no |
| Playwright Node w2 | Node 24.19.0 / Chromium 148.0.7778.96 | 1 | 5/5 | verified | none | no |
| Playwright Bun w2 | Bun 1.4.0 / Chromium 148.0.7778.96 | 1 | 5/5 | verified | none | no |
| WebKit warm 1-view | Bun 1.4.0 / AppleWebKit 605.1.15 | 1 | 5/5 | verified | none | no |
| WebKit warm 1-view `--smol` | Bun 1.4.0 / AppleWebKit 605.1.15 | 1 | 5/5 | verified | none | yes |

All profile-level outcome evidence is sound:

- exact canonical routes in stable order;
- Playwright inventory 6 = setup 1 + public outcomes 5;
- measured setup duration per Playwright sample;
- no `extraWarmups`, exclusions, unresolved invalid reasons or contamination;
- true warm WebView processes remain alive across warm-up + five passes;
- process-tree peak RSS and cleanup verification are retained.

## Execution Trace Blocker

The raw contains 36 entries: six warm-ups and 30 measured samples. It is not a single global sequence:

- `executionTrace[0..23]` contains every Playwright warm-up/sample.
- `executionTrace[24..35]` contains every warm WebView warm-up/sample.
- Cold trace sequences run `0..23`; warm trace restarts at `0..11` (`run-2026-08-25T04-16-32-724Z.json:2801` and `run-2026-08-25T04-16-32-724Z.json:2993`). Only 24 of 36 sequence values are unique.
- Last Playwright timestamp: `2026-08-25T04:16:18.544Z`.
- First warm WebView timestamp: `2026-08-25T04:16:21.822Z`.

Actual measured order is all 20 Playwright samples, followed by all 10 WebView samples. The declared `finalistSchedule` mixes Playwright and WebView within every round.

Root cause:

1. `runBrowserConfirmations()` completes `runColdFinalistsInterleaved()` before starting `runWarmFinalistsInterleaved()` at `scripts/bench-browser-runtimes.ts:664`.
2. It concatenates two independently numbered traces at line 669.
3. `deriveFinalistSchedule()` sorts by duplicated `sequence` values at line 333, creating an order that never occurred.
4. `traceIsInterleaved()` validates only round membership, not chronological alternation or unique/monotonic global sequence at line 341.
5. Cold `startedAt`/`finishedAt` timestamps are written after execution and are equal at `scripts/bench-browser-runtimes.ts:521`, so those entries are not real start/finish measurements.

Warm profiles are genuinely persistent and alternate with each other. Playwright profiles genuinely alternate with each other. The combined six-profile schedule is not genuine.

**Trace status**: FAIL.

## Inventory, Lifecycle, Provenance, and Controls

| Check | Result | Evidence |
| --- | --- | --- |
| Exact setup + five public tests | PASS | Fresh locked Chromium gate 6/6; parser at `scripts/bench-browser-runtimes.ts:166` |
| Node runtime | PASS | Node command pins `mise exec node@24`; runtime validator at line 248; raw 24.19.0 |
| Bun runtime | PASS | Raw 1.4.0 |
| Cold boundaries | PASS | Server/browser/process restarted per sample |
| Warm boundaries | PASS | Persistent stdin-driven sessions at `scripts/bench-browser-runtimes.ts:356`; pass loop at line 573 |
| Actual per-pass timing | PASS | Persistent WebView emits one pass duration and coordinator measures each command round |
| One warm-up/profile | PASS | Raw metadata 1 and exactly six warm-up trace entries |
| Setup timing | PASS | Measured setup-spec duration retained |
| Process-tree RSS | PASS | Descendant sampling via `groupRssBytes()` |
| Cleanup | PASS | Cold and persistent warm process groups verified; raw all true |
| Contamination | PASS | Before/during/after checks; raw all false |
| Both shared locks | PARTIAL | Raw/README list CRM + Antclips. Entry point at `scripts/bench-browser-runtimes.ts:702` acquires only Antclips `lockf`; an outer CRM lock is required but not encoded or recorded as invocation evidence. |

## Math, Units, Links, and Defaults

Independent recomputation found no numeric mismatch:

- every per-sample `rssTimeBytesMs` equals `peakRssBytes × durationMs`;
- aggregate median time and median peak RSS match valid samples;
- GiB·s uses `(medianMs / 1000) × (bytes / 1024³)` at `scripts/bench-browser-runtimes.ts:630`;
- all README GiB·s values now have correct units and rounding;
- `samplesPerMinute = 60000 / medianMs` for all profiles;
- README time/RSS/RSS×time/throughput values match raw aggregates;
- every README link resolves;
- `package.json`, `playwright.config.ts`, and `.github/**` have zero diff from the pre-feature baseline;
- final Pareto wording correctly says both warm profiles were confirmed and only `--smol` remains non-dominated.

**Math/report status excluding trace claim**: PASS.

## Fresh Gates

- Focused browser/runner tests: PASS, 5 files / 42 tests, 0 failed, 0 skipped.
- Full Vitest: PASS, 133 files passed + 3 skipped; 2,290 tests passed + 84 skipped; 0 failed.
- Biome: exit 0 with six `noNonNullAssertion` warnings in `app/tests/bench-browser-runtimes.test.ts`.
- TypeScript: PASS.
- Build: PASS.
- Test annotation lint: PASS.
- Fresh exact Chromium smoke under both locks: PASS, setup + five public outcomes, 6/6.
- Defaults/CI/config: PASS.
- Evidence/finalist gate: FAIL due false combined execution trace/schedule.

## Discrimination Sensor — Iteration 4

Five mutations ran in one detached temporary worktree. Worktree was removed/pruned and real-tree porcelain exactly matched baseline, including pre-existing untracked reports.

| Mutation | Result |
| --- | --- |
| Disable external Playwright/media-host contamination matcher | KILLED |
| Swap warm execution guard to cold | KILLED |
| Remove per-round profile uniqueness from `traceIsInterleaved()` | SURVIVED: all 11 benchmark tests passed |
| Accept Node 22 instead of Node 24 | KILLED |
| Remove ms→s conversion from GiB·s | KILLED |

**Sensor result**: FAIL, 4/5 killed. The surviving trace mutation confirms tests do not reject duplicate profiles/sequences or prove global chronological interleaving.

## Required Fix Tasks

1. **Create one global finalist coordinator.** Start persistent warm sessions, execute one warm-up per profile, then alternate all six profiles in each measured round. If cross-harness interleaving is intentionally out of scope, update the approved spec before claiming it.
2. **Use one monotonic global sequence and real timestamps.** Record start before each cold command, finish afterward, and derive schedule from chronological trace order. Reject duplicate sequence IDs and a schedule that differs from timestamp order.
3. **Strengthen trace discrimination.** Test duplicated profiles, duplicated/reset sequences, cohort-concatenated traces and out-of-order timestamps. The current membership-only predicate is insufficient.
4. **Make both-lock acquisition reproducible.** Restore a non-deadlocking wrapper or record/validate the required outer CRM lock instead of merely listing both lock paths.
5. **Re-run the six-profile confirmation and update report.** Preserve Node 24/Bun 1.4, exact outcomes, one warm-up, metrics and Pareto behavior already achieved.

## Requirement Traceability

| Requirement | Iteration 3 | Iteration 4 |
| --- | --- | --- |
| BRR-01 | PASS | PASS |
| BRR-02 | FAIL | PASS |
| BRR-03 | PASS | PASS |
| BRR-04 | PASS | PASS |
| BRR-05 | FAIL | FAIL |
| BRR-06 | FAIL | FAIL |

## Summary

**Overall**: NOT READY

**Spec-anchored check**: 4/6 requirements verified; BRR-05 and BRR-06 remain failed.
**Gates**: code/test/build/browser pass; evidence protocol gate fails.
**Sensor**: 4/5 mutations killed; trace-integrity mutation survived.
**Defaults/CI/config**: unchanged.

Iteration 4 closes every prior measurement and provenance blocker. PASS now requires a genuine global execution trace/schedule (or an approved cohort-level interleaving spec) and reproducible proof of both locks.
