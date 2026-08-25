# Browser Runtime Revalidation Validation — Iteration 5

<!-- verdict: FAIL -->

**Verdict**: FAIL
**Date**: 2026-08-25
**Spec**: `.specs/features/browser-runtime-revalidation/spec.md`
**Diff range**: `68138dd^..0d51dcc`
**Iteration-5 commits**: `d876092`, `ec1d3af`, `186ba13`, `f1e411d`, `6f0b0ba`, `880ce6f`, `0d51dcc`
**Verifier**: independent sub-agent (author != verifier)

Iteration 5 closes the protocol and implementation blockers from iteration 4. The clean common-subset run has a genuine global six-profile trace, both locks are self-acquired, Playwright uses `--no-deps`, warm WebView sessions persist on isolated port 49173, and all six profiles retain one discarded warm-up plus 5/5 valid measured samples. One publication blocker remains: peak-RSS values in the README comparison table do not match the canonical JSON or its generated Markdown. BRR-06 and T6 therefore remain failed.

## Task Completion

| Task | Result | Evidence |
| --- | --- | --- |
| T1 | PASS | Exact canonical outcome IDs are `en-post`, `pt-br-post`, `not-found`, `en-index`, `pt-br-index`; every clean sample retains all five in that order. |
| T2 | PASS | Node 24.19.0 and Bun 1.4.0, workers 1/2, `--no-deps`, one warm-up and 5/5 measured samples per Playwright arm. |
| T3 | PASS | Complete 16-arm WebKit/Chrome screening matrix is retained; unavailable/failed arms have evidence-backed invalid reasons and selected WebKit arms preserve exact outcomes and cleanup. |
| T4 | PASS | Screening retains one warm-up + three valid samples for eligible arms; clean confirmation globally interleaves both selected warm WebKit arms with the four Playwright arms. Raw Pareto contains only warm 1-view `--smol`. |
| T5 | PASS | Raw schema-2 evidence records timestamps, route outcomes, provenance, process-tree RSS, contamination, cleanup, lifecycle, locks and invalid historical attempts. |
| T6 | FAIL | Coverage/default/CI decision is sound, but README peak-RSS numbers disagree with the canonical run. |

## BRR Requirement Verdicts

| Requirement | Result | Evidence |
| --- | --- | --- |
| BRR-01 | PASS | All four Playwright commands include the exact smoke grep and `--no-deps`; raw inventory is 5, route count is 5, setup count/time is zero. Fresh locked smoke ran exactly 5 tests and passed 5/5. |
| BRR-02 | PASS | Raw provenance is Node 24.19.0/Bun 1.4.0 with Chromium 148.0.7778.96. Workers 1/2 each have one warm-up, five valid samples, zero exclusions and zero invalid reasons. |
| BRR-03 | PASS | Screening covers WebKit/Chrome, cold/warm, one/two views and normal/`--smol`. Exact five outcomes, backend provenance, deterministic cleanup and local-only behavior are retained. |
| BRR-04 | PASS | `run-2026-08-25T02-31-40-880Z` retains the complete requested matrix, one screening warm-up and three valid samples or evidence-backed invalidation. Clean confirmation retains both selected WebKit warm arms; raw Pareto selects only `webview:webkit:warm:1view:smol`. |
| BRR-05 | PASS | Clean run has 36 trace entries with unique sequence 0..35, real non-overlapping timestamps, six warm-ups followed by five rotated six-profile rounds, and a schedule derived identically from measured trace order. Process-tree RSS, cleanup and contamination controls pass. |
| BRR-06 | FAIL | Operational setup+five evidence is correctly separated from fair common-subset setup-zero evidence, defaults/CI/config are unchanged, and time/GiB·s/throughput math is correct. The README peak-RSS transcription is not exact. |

## Canonical Clean Evidence

Artifact: `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T06-17-36-513Z.json` (schema 2, commit `51dbba15f06cc81fe09dfe23269ca357861a4079`).

| Profile | Runtime / browser | Warm-up | Measured | Inventory/setup | Cleanup / contamination | Median time | Raw peak RSS | GiB·s | Throughput |
| --- | --- | ---: | ---: | --- | --- | ---: | ---: | ---: | ---: |
| Playwright Node w1 | Node 24.19.0 / Chromium 148.0.7778.96 | 1 | 5/5 | 5 / 0 | verified / none | 4064.96 ms | 1747.7 MiB | 6.94 | 14.76/min |
| Playwright Bun w1 | Bun 1.4.0 / Chromium 148.0.7778.96 | 1 | 5/5 | 5 / 0 | verified / none | 2971.42 ms | 1332.1 MiB | 3.87 | 20.19/min |
| Playwright Node w2 | Node 24.19.0 / Chromium 148.0.7778.96 | 1 | 5/5 | 5 / 0 | verified / none | 3700.97 ms | 1460.0 MiB | 5.28 | 16.21/min |
| Playwright Bun w2 | Bun 1.4.0 / Chromium 148.0.7778.96 | 1 | 5/5 | 5 / 0 | verified / none | 2857.40 ms | 1301.1 MiB | 3.63 | 21.00/min |
| WebKit warm 1-view | Bun 1.4.0 / AppleWebKit 605.1.15 | 1 | 5/5 | 5 / 0 | verified / none | 331.31 ms | 97.5 MiB | 0.03 | 181.10/min |
| WebKit warm 1-view `--smol` | Bun 1.4.0 / AppleWebKit 605.1.15 | 1 | 5/5 | 5 / 0 | verified / none | 308.41 ms | 97.0 MiB | 0.03 | 194.55/min |

All 36 samples/warm-ups have exact route identities, successful normalized outcomes, `cleanupVerified: true`, `contamination.detected: false`, and no unresolved invalid reason. WebKit records status 200/200/404/200/200. The four Playwright commands use `--no-deps`; the two persistent WebKit commands use `http://localhost:49173`. No listener remained on port 49173 during fresh verification.

## Trace, Lifecycle, and Lock Verification

- `executionTrace.length === 36`; sequence values are unique and exactly `0..35`.
- Every `startedAt` precedes `finishedAt`; adjacent entries do not overlap.
- Entries 0–5 are exactly one warm-up per profile.
- Entries 6–35 form five measured rounds, each containing all six profiles in the expected one-position rotation.
- Independently derived `${profile}#${run}` rounds equal `finalistSchedule` byte-for-byte.
- Warm WebKit profiles start one persistent session each before warm-up and reuse it for all five passes; the shared server uses isolated port 49173 and is stopped in `finally`.
- Cold Playwright samples remain process-restarted per sample.
- The entry point nests `lockf` for `/tmp/praxis-playwright.lock` and the Antclips temp lock before re-entry. Raw `lockProvenance` marks both acquired with marker `crm+antclips` and a common acquisition timestamp.

## Screening and Historical Invalidations

`run-2026-08-25T02-31-40-880Z` contains all four Playwright profiles and all 16 WebView combinations across WebKit/Chrome, cold/warm, one/two views and normal/`--smol`. Each arm retains a warm-up. Eligible arms retain three valid screening samples; replenished/failed attempts remain present instead of being hidden. Invalid two-view/Chrome arms contain explicit outcome/runtime failure reasons. Programmatic screening selected WebKit cold 1-view and warm 1-view normal/`--smol`; confirmation left both warm arms non-dominated. The user-approved fair common-subset confirmation then re-confirmed those two warm arms beside Node/Bun workers 1/2, and only warm `--smol` remains on the raw Pareto frontier.

Historical contaminated iteration-5 attempts remain linked and explicitly invalidated. They are non-blocking because the clean replacement run has no exclusions or contamination.

## Math and Report Reconciliation

Independent recomputation passed for the canonical JSON:

- every `rssTimeBytesMs` equals `peakRssBytes × durationMs`;
- aggregate medians match valid sample arrays;
- GiB·s equals `(medianMs / 1000) × (medianPeakRssBytes / 1024³)`;
- serialized throughput equals `60000 / medianMs`;
- raw Pareto contains only `webview:webkit:warm:1view:smol`;
- all 36 README links resolve;
- `package.json`, `playwright.config.ts` and `.github/**` have zero diff from `68138dd^`.

The final README table has these exact mismatches:

| Profile | README | Canonical JSON / generated run Markdown |
| --- | ---: | ---: |
| Playwright Node w1 | 1747.2 MiB | 1747.7 MiB (`1832632320 / 1048576`) |
| Playwright Bun w1 | 1332.0 MiB | 1332.1 MiB (`1396834304 / 1048576`) |
| Playwright Node w2 | 1460.8 MiB | 1460.0 MiB (`1530937344 / 1048576`) |
| Playwright Bun w2 | 1301.4 MiB | 1301.1 MiB (`1364344832 / 1048576`) |
| WebKit warm 1-view `--smol` | 97.1 MiB | 97.0 MiB (`101761024 / 1048576`) |

Time, GiB·s and throughput columns match after documented rounding. The WebKit normal row matches.

## Fresh Gates

- Focused browser/runner Vitest: PASS — 5 files, 44 tests, 0 failed/skipped.
- Full Bun Vitest: PASS — 133 files passed + 3 skipped; 2,292 tests passed + 84 skipped; 0 failed.
- Biome: exit 0; seven non-fatal `noNonNullAssertion` warnings in `app/tests/bench-browser-runtimes.test.ts`.
- TypeScript: PASS.
- Production build: PASS with existing route/chunk/tooling warnings.
- Test annotation lint: PASS.
- Fresh common-subset Chromium smoke under CRM + Antclips locks: PASS — exactly 5 tests, 5/5 passed, `--no-deps`, workers 1, retries 0.
- Port 49173 cleanup: PASS — no listener remained.
- Defaults/CI/config: PASS.

## Discrimination Sensor — Iteration 5

Six mutations ran in one detached temporary worktree. Each mutation was reverted before the next. The worktree was clean, removed and pruned; real-tree porcelain returned to the exact pre-sensor state.

| Mutation | Result |
| --- | --- |
| Remove Playwright `--no-deps` from the canonical command | KILLED |
| Weaken global sequence validation to accept reset/duplicate sequence numbers | KILLED |
| Remove the outer CRM lock, leaving only the Antclips lock | KILLED |
| Swap the warm/cold lifecycle guard | KILLED |
| Accept Node 22 instead of Node 24 | KILLED |
| Remove the milliseconds-to-seconds conversion from GiB·s | KILLED |

**Sensor result**: PASS, 6/6 mutations killed.

## Required Fix

Recompute the six README peak-RSS cells directly from `medianPeakRssBytes / 1024²` (or copy the values from `run-2026-08-25T06-17-36-513Z.md`) and re-run report consistency validation. No benchmark rerun or implementation change is required.

## Summary

**Overall**: NOT READY FOR FINAL PASS

**Requirements**: BRR-01 through BRR-05 pass; BRR-06 fails only on final-report RSS transcription.
**Tasks**: T1 through T5 pass; T6 fails on the same publication consistency blocker.
**Gates**: all code, test, build, browser, lifecycle, contamination, cleanup, trace, lock and sensor gates pass.
**Defaults/CI/config**: unchanged.

The benchmark implementation and canonical evidence are valid. Final PASS needs only exact README RSS reconciliation.
