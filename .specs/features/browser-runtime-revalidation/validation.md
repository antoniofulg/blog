# Browser Runtime Revalidation Validation — Iteration 2

**Verdict**: FAIL
**Date**: 2026-08-24
**Spec**: `.specs/features/browser-runtime-revalidation/spec.md`
**Diff range**: `68138dd^..cf1e881`
**Remediation range**: `846303b..cf1e881`
**Verifier**: independent sub-agent (author != verifier)

Iteration 2 closes important implementation gaps: schema-2 retains route identities, the contamination sensor runs before/during/after samples, process-group cleanup is verified, cold and warm WebView processes have different lifecycles, all four Playwright arms have five clean measured samples in round-robin runs, and two WebKit cold profiles have five clean measured samples. The feature still fails its approved protocol and report gate.

Blocking facts:

1. The Playwright grep selects six public tests, not the canonical five. Fresh Chromium execution ran one setup test plus six public tests, including the out-of-contract `/en/` index.
2. Each “five-round” confirmation executes five warm-ups per profile while raw metadata and README claim one.
3. The complete screening's non-dominated WebView profiles are WebKit **warm** 1-view normal and `--smol`; only dominated WebKit **cold** profiles were manually confirmed.
4. Warm sample timing is computed by dividing whole-process time equally across passes. The emitted per-pass durations are ignored, so browser startup is spread into measured warm samples.
5. Runtime/browser “versions” and setup overhead are labels/counts, not measured provenance/time. `setupOverheadMs` contains `2`, the count of one setup plus one accidental `/en/` test.
6. README/STATE/raw evidence remain mutually inconsistent and the final report does not compare queue throughput.

## Task Completion

| Task | Iteration-2 status | Evidence |
| --- | --- | --- |
| T1 | PASS | Canonical data contract still defines the intended five outcomes at `app/lib/browser-bench/contract.ts:1`. |
| T2 | FAIL | Node/Bun workers 1/2 execute, but `BROWSER_SMOKE_GREP` at `scripts/bench-e2e-runtimes.ts:31` also selects `/en/`. Raw Playwright inventory is 7 rather than 6 total tests (one setup + five public). |
| T3 | PARTIAL | WebView asserts the exact shared contract and closes views at `scripts/run-e2e-webview.ts:268`; requested backend/version is not independently detected, and confirmed cold profiles were not the screening winners. |
| T4 | FAIL | Real process reuse exists, but warm timing is invalid, the actual warm Pareto finalists were not confirmed, and confirmation runs use five warm-ups per profile. |
| T5 | FAIL | Schema-2 raw evidence is extensive but does not follow declared warm-up/finalist selection protocol and records misleading provenance/setup fields. |
| T6 | FAIL | Defaults/CI remain unchanged and coverage framing is sound, but report status, decision, links, metrics, and handoff disagree with the raw confirmations. |

## BRR Requirement Verdicts

| Requirement | Required outcome | Evidence | Result |
| --- | --- | --- | --- |
| BRR-01 | Equivalent canonical five-route Playwright inventory | Fresh locked Chromium smoke ran `/en/` in addition to the five routes. The broad final alternative `/ renders 200` is at `scripts/bench-e2e-runtimes.ts:31`. Parser then discards `/en/` and reports five mapped identities at `scripts/bench-browser-runtimes.ts:181`. | FAIL |
| BRR-02 | Matched Node/Bun workers 1/2 with one warm-up and five valid interleaved samples per confirmed arm | Five clean measured samples exist for Node1/Bun2 in `run-2026-08-25T01-23-51-905Z.json`, Bun1/Node2 in `run-2026-08-25T01-25-57-686Z.json`, and follow-ups. All use round-robin schedules. Each profile also contains four `extraWarmups`, contradicting `warmupsPerProfile: 1` at `run-2026-08-25T01-23-51-905Z.json:16`. | FAIL |
| BRR-03 | Equivalent WebKit/Chrome smoke, exact outcomes, deterministic cleanup | Full screening covers both engines and exact five route identities; confirmed WebKit cold samples have 5/5 outcomes, no contamination, and `cleanupVerified: true`. Backend provenance remains the requested string from `scripts/bench-browser-runtimes.ts:249`, not verified actual engine/version. | PARTIAL |
| BRR-04 | Valid cold/warm, serial/two-view, `--smol` screening and confirmation of non-dominated finalists | Full screening includes all 20 arms and retains evidence-backed invalidations. Independent Pareto calculation from `run-2026-08-25T00-56-23-164Z.json` selects `webview:webkit:warm:1view` and `webview:webkit:warm:1view:smol` (profiles begin at lines 3331 and 4048). Confirmed profiles were the cold variants at lines 1330 and 1633, which the warm profiles dominate. | FAIL |
| BRR-05 | Controlled repeated process-tree benchmark with exact provenance, one warm-up, interleaving, contamination exclusion, cleanup, wall/RSS/RSS×time | Process-tree RSS/cleanup at `app/lib/bench/runner.server.ts:50` and `app/lib/bench/runner.server.ts:103` pass. Contamination at `scripts/bench-browser-runtimes.ts:224` passes. Confirmation scheduling at line 310 runs `runProfile(profile, 1)` every round, creating a new warm-up each time and storing four extras at line 333. Provenance is hard-coded at line 249. | FAIL |
| BRR-06 | Coverage-aware local-only decision; final comparison of time, RSS, RSS×time, serialized throughput; unchanged defaults/CI/config | Zero diff for `package.json`, `playwright.config.ts`, and `.github/**` from pre-feature baseline. README has no consolidated metric/throughput comparison and still says evidence is pending at `docs/benchmarks/browser-runtime-revalidation/README.md:3`. | FAIL |

## Canonical Outcome Check

| Intended outcome | Contract and native assertion | Schema-2 confirmation |
| --- | --- | --- |
| English post | `app/lib/browser-bench/contract.ts:21`; `tests/e2e/public-read.spec.ts:20` | ID/pass retained |
| Portuguese post | `app/lib/browser-bench/contract.ts:31`; `tests/e2e/public-read.spec.ts:47` | ID/pass retained |
| Unknown post | `app/lib/browser-bench/contract.ts:39`; `tests/e2e/public-read.spec.ts:178` | ID/pass retained; WebView retains 404 |
| English `/` index | `app/lib/browser-bench/contract.ts:44`; `tests/e2e/public-read.spec.ts:202` | ID/pass retained |
| Portuguese index | `app/lib/browser-bench/contract.ts:51`; `tests/e2e/public-read.spec.ts:202` | ID/pass retained |

The five intended assertions match across runners. Inventory does not: fresh Playwright output was `7 passed`, comprising setup + the five intended tests + `/en/ renders 200`. Confirmation JSON records `inventory: 7` and `setupOverhead: 2`, for example `run-2026-08-25T01-23-51-905Z.json:66`. The parser maps only five routes and misclassifies both non-canonical tests as setup overhead.

README also claims schema-2 retains route “statuses” at `docs/benchmarks/browser-runtime-revalidation/README.md:21`. Playwright route observations retain only `id` and `passed`; statuses are present only in WebView observations.

## Screening Matrix

The complete post-remediation screening `run-2026-08-25T00-56-23-164Z.json` contains all requested arms:

- Playwright Node/Bun workers 1/2: each has one valid warm-up and at least three valid measured samples after retained exclusions.
- WebKit/Chrome cold/warm, 1/2 views, normal/`--smol`: every arm has one warm-up and three requested screening samples or bounded invalid attempts with reasons.
- Valid invalidations include WebKit two-view outcome failures, warm-up contamination, and retained contaminated attempts.
- Exact route arrays and cleanup flags are present.

Independent medians from the screening samples identify this WebView Pareto set:

| Profile | Median wall | Median peak RSS | Disposition |
| --- | ---: | ---: | --- |
| `webview:webkit:warm:1view` | 476.13 ms | 128.7 MiB | Non-dominated, not confirmed |
| `webview:webkit:warm:1view:smol` | 525.84 ms | 114.1 MiB | Non-dominated, not confirmed |
| `webview:webkit:cold:1view` | 869.23 ms | 134.0 MiB | Dominated, manually confirmed |
| `webview:webkit:cold:1view:smol` | 876.60 ms | 126.8 MiB | Dominated, manually confirmed |

The recorded full-screening run predates the selector-retention fix and has no `screeningFinalists`; its `finalists` array is empty. Later `--confirm-only` runs populate `screeningFinalists` from command-line selections at `scripts/bench-browser-runtimes.ts:401`, not from a versioned post-fix screening decision. This breaks screening-to-finalist traceability.

## Confirmation Evidence

| Profiles | Raw run | Valid measured samples | Interleaved | Actual warm-ups/profile | Result |
| --- | --- | ---: | --- | ---: | --- |
| Node1, Bun2, WebKit cold normal/`--smol` | `run-2026-08-25T01-23-51-905Z.json` | 5 each | Yes | 5 | FAIL protocol |
| Bun1, Node2 | `run-2026-08-25T01-25-57-686Z.json` | 5 each | Yes | 5 | FAIL protocol |
| Node1 follow-up | `run-2026-08-25T01-37-23-067Z.json` | 5 | Trivial one-profile schedule | 5 | FAIL protocol |
| Bun2 follow-up | `run-2026-08-25T01-43-21-673Z.json` | 5 | Trivial one-profile schedule | 5 | FAIL protocol |

The first warm-up is stored in `warmup`; the next four are stored in `extraWarmups` (`run-2026-08-25T01-23-51-905Z.json:438` and analogous entries). Top-level metadata nevertheless says one warm-up. Some results are `valid: true` while `invalidReasons` contains contamination from extra warm-ups, so raw validity and reasons disagree.

## Cold/Warm Semantics and Measurement

- Cold WebView: server/browser/process restart for each warm-up/sample at `scripts/bench-browser-runtimes.ts:270`. Lifecycle implementation is real.
- Warm WebView: one server and one WebView command with `repetitions + 1` passes at `scripts/bench-browser-runtimes.ts:287`. Lifecycle reuse is real.
- Warm timing: `run-e2e-webview.ts` emits actual `passDurationsMs` at line 300, but `parseWebViewPassOutcomes()` ignores them. `runProfile()` assigns every pass `measured.ms / (repetitions + 1)` at `scripts/bench-browser-runtimes.ts:293`. In screening raw, warm-up and all three samples consequently have identical duration and RSS. Browser startup is amortized into measured warm samples, contrary to the required startup/reuse distinction.
- Warm finalists: current runner explicitly invalidates every warm finalist because it “cannot be interleaved across process groups” at `scripts/bench-browser-runtimes.ts:416`. The spec does not permit replacing a non-dominated warm finalist with a dominated cold arm because the harness cannot schedule it.

## Provenance, Cleanup, Contamination, and Math

| Check | Result | Evidence |
| --- | --- | --- |
| Process-tree peak RSS | PASS | Descendant traversal at `app/lib/bench/runner.server.ts:50` |
| Deterministic process-group cleanup | PASS | Poll/TERM/KILL verification at `app/lib/bench/runner.server.ts:103`; valid confirmation samples all record `cleanupVerified: true` |
| WebView close | PASS | `finally` closes each view at `scripts/run-e2e-webview.ts:305` |
| Before/during/after contamination | PASS | 100 ms polling and post-run check at `scripts/bench-browser-runtimes.ts:224`; invalid samples retain phase details |
| Exact route identities | PASS | Native Playwright report parsing at `scripts/bench-browser-runtimes.ts:160`; WebView pass parsing at line 192 |
| Runtime provenance | FAIL | `runtimeVersion` is hard-coded to `24` or `1.4`; actual Node/Bun executable versions are not queried/stored |
| Browser/backend provenance | FAIL | `browserVersion` stores `chromium`, `webkit`, or `chrome`, not an actual version or independently detected backend |
| Setup overhead | FAIL | `setupOverhead` is a test count, then copied to `setupOverheadMs` at `scripts/bench-browser-runtimes.ts:249`; no setup duration is measured |
| Per-sample RSS×time | PASS for cold evidence | Stored product equals `peakRssBytes * durationMs` for every checked valid confirmation sample |
| Aggregate medians | PASS for cold evidence | Recomputed medians match raw aggregates |
| Serialized throughput math | PASS in raw | `60000 / medianMs` matches every checked `samplesPerMinute` value |
| Final metric comparison | FAIL | README does not present queue throughput and does not summarize WebView finalist time/RSS/RSS×time beside Playwright |

## Report and State Consistency

- README status says the approved matrix is still pending at line 3, while its evidence table and STATE handoff say valid confirmations are complete.
- README decision says no WebView profile is promoted until a schema-2 confirmation at line 52, although the table claims two WebKit confirmations already reached 5/5.
- README's Bun2 JSON link omits `.json` at line 36 and points to no file.
- README says each profile retains one discarded warm-up at line 17; confirmation raw contains five.
- STATE `AD-005` still says only Node worker-1 completed five samples, while the browser handoff says every Playwright arm and two WebKit profiles completed.
- Tasks mark R1-R6 complete, but R2, R3, R5, and R6 remain unverified for the reasons above.

## Fresh Gates

- Focused harness: PASS, 5 files / 37 tests, 0 failed, 0 skipped.
- Full Vitest: PASS, 133 files passed + 3 skipped; 2,285 tests passed + 84 skipped; 0 failed.
- Biome: exit 0 with six `noNonNullAssertion` warnings in `app/tests/bench-browser-runtimes.test.ts`.
- TypeScript: PASS (`bunx tsc --noEmit`).
- Build: PASS (`bun run build`).
- Test annotation lint: PASS (`bun run lint:tests`).
- Fresh Chromium smoke under both shared locks: command completed with 7/7 passed. Gate is FAIL against BRR-01 because it ran six public tests rather than the canonical five.
- Defaults/CI/config: PASS, no diff in `package.json`, `playwright.config.ts`, or `.github/**` from pre-feature baseline.

## Discrimination Sensor — Iteration 2

Sensor ran in a detached temporary worktree. Worktree was removed/pruned and real-tree porcelain exactly matched baseline, including the pre-existing untracked reports.

| Mutation | Result |
| --- | --- |
| Disable external Playwright/media-host contamination matching at `scripts/bench-browser-runtimes.ts:210` | KILLED by `app/tests/bench-browser-runtimes.test.ts:133` |
| Swap warm/cold execution guard at `scripts/bench-browser-runtimes.ts:287` | SURVIVED: both focused benchmark/WebView files, 8 tests, still passed |

**Sensor result**: FAIL, 1/2 killed. Tests assert lifecycle labels but do not discriminate actual lifecycle execution, warm timing, warm-up count, or finalist selection.

## Required Fix Tasks

1. **Fix exact Playwright inventory.** Make grep select only five public outcomes and assert the exact selected test titles/inventory. Setup overhead must be separated from extra public tests.
2. **Fix confirmation coordinator.** Execute exactly one discarded warm-up per profile, then five round-robin measured rounds. Replenish invalid measured samples without creating or silently ignoring additional warm-ups. Raw validity must not coexist with unresolved `invalidReasons`.
3. **Fix warm measurement and confirmation.** Use emitted per-pass durations, keep startup only in the discarded warm-up, define a valid interleaving strategy for persistent warm sessions, and confirm the actual non-dominated warm WebKit profiles.
4. **Record empirical provenance.** Query/store exact Node, Bun, Playwright Chromium, and actual WebView backend/version. Measure setup-project time rather than copying a test count into an `Ms` field.
5. **Re-run a post-fix full matrix.** Version one complete screening with explicit finalist selection and confirmations tied to that screening. Do not use manual `--confirm-only` selections as screening evidence.
6. **Reconcile README, STATE, tasks, and raw data.** Add a correct comparison table for time, peak RSS, RSS×time, and serialized throughput; repair links and stale decisions/status.
7. **Strengthen discrimination.** Add runnable tests for warm/cold execution, per-pass timing, one-warm-up confirmation scheduling, exact Playwright inventory, and raw/README consistency.

## Requirement Traceability

| Requirement | Iteration-1 | Iteration-2 |
| --- | --- | --- |
| BRR-01 | PARTIAL | FAIL |
| BRR-02 | FAIL | FAIL |
| BRR-03 | PARTIAL | PARTIAL |
| BRR-04 | FAIL | FAIL |
| BRR-05 | FAIL | FAIL |
| BRR-06 | PARTIAL | FAIL |

## Summary

**Overall**: NOT READY

**Spec-anchored check**: 0/6 requirements fully verified.
**Gates**: unit/static/build pass; exact browser inventory and evidence/finalist gates fail.
**Sensor**: 1/2 mutations killed; warm/cold execution mutant survived.
**Defaults/CI/config**: unchanged.

Remediation materially improved the harness, but T2-T6 remain incomplete. The feature cannot pass until exact inventory, one-warm-up interleaving, true warm timing/finalist confirmation, empirical provenance, and report consistency are closed.
