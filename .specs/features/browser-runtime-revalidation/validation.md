# Browser Runtime Revalidation Validation

**Verdict**: FAIL
**Date**: 2026-08-24
**Spec**: `.specs/features/browser-runtime-revalidation/spec.md`
**Diff range**: `68138dd^..0ee4aa7` (implementation commits `68138dd..0ee4aa7`)
**Verifier**: independent sub-agent (author != verifier)

The implementation provides a useful five-route WebView diagnostic and controlled profile scaffolding, but it does not fulfill the approved benchmark protocol. Missing or contradictory finalist evidence is blocking: the only complete screening used one measured sample instead of three, all Playwright arms in that screening were invalid, no worker-2 or WebView finalist was confirmed, Node and Bun finalists were not interleaved, and the Bun finalist artifact contradicts the final report's contamination claim. The `cold` and `warm` WebView profiles also execute the same lifecycle.

## Task Completion

| Task | Status | Evidence and gap |
| --- | --- | --- |
| T1 | PASS | Five-route contract and normalization exist at `app/lib/browser-bench/contract.ts:1`; focused assertions pass at `app/tests/browser-runtime-contract.test.ts:9`. |
| T2 | PARTIAL | Node/Bun and workers 1/2 are enumerated at `scripts/bench-browser-runtimes.ts:78`, but the only matrix screening has invalid Playwright outcomes and no valid worker-2 evidence. |
| T3 | PARTIAL | WebKit/Chrome route assertions and `finally` view closure exist at `scripts/run-e2e-webview.ts:135` and `scripts/run-e2e-webview.ts:240`; subprocess cleanup is not verified after each measured process group. |
| T4 | FAIL | Matrix enumeration exists at `scripts/bench-browser-runtimes.ts:95`, but warm/cold behavior is not implemented, screening count is wrong, and required finalists are missing. |
| T5 | FAIL | Raw runs are retained, but required confirmations are missing and Bun contamination provenance contradicts its raw artifact. |
| T6 | PARTIAL | Conservative local-only decision and unchanged defaults are correct at `docs/benchmarks/browser-runtime-revalidation/README.md:33`; “evidence complete” and the Bun exclusion are not supported by raw data, and queue throughput is absent. |

## Exact Common Five-Route Outcomes

| Outcome | Contract | Playwright assertion | WebView assertion path | Result |
| --- | --- | --- | --- | --- |
| English post | status 200, `lang=en`, heading `E2E Public Fixture`, text `English body` at `app/lib/browser-bench/contract.ts:21` | status/content at `tests/e2e/public-read.spec.ts:20` | status/lang/heading/text checks at `scripts/run-e2e-webview.ts:140` | PASS in implementation |
| Portuguese post | status 200, `lang=pt-BR`, heading `E2E Fixture Público`, text `português` at `app/lib/browser-bench/contract.ts:31` | status/content at `tests/e2e/public-read.spec.ts:47` | same shared checks at `scripts/run-e2e-webview.ts:140` | PASS in implementation |
| Unknown post | heading `Post not found`; status intentionally unconstrained at `app/lib/browser-bench/contract.ts:39` | heading at `tests/e2e/public-read.spec.ts:178` | heading check at `scripts/run-e2e-webview.ts:147` | PASS in implementation |
| English index | status 200, `lang=en`, canonical `/` at `app/lib/browser-bench/contract.ts:44` | status/lang/canonical at `tests/e2e/public-read.spec.ts:202` | status/lang/canonical checks at `scripts/run-e2e-webview.ts:140` | PASS in implementation |
| Portuguese index | status 200, `lang=pt-BR`, canonical `/pt-br/` at `app/lib/browser-bench/contract.ts:51` | status/lang/canonical at `tests/e2e/public-read.spec.ts:202` | status/lang/canonical checks at `scripts/run-e2e-webview.ts:140` | PASS in implementation |

The common route behavior is precisely defined. The benchmark evidence is weaker than the harness: `parseSmokeOutput()` reduces Playwright JSON to a pass boolean and hard-codes `routeCount: 5` at `scripts/bench-browser-runtimes.ts:161`, while WebView output is also reduced to boolean/count at `scripts/bench-browser-runtimes.ts:142`. Raw benchmark samples therefore do not retain route identities, statuses, or content outcomes.

## Spec-Anchored Requirements

| Requirement | Spec-defined outcome | Evidence | Result |
| --- | --- | --- | --- |
| BRR-01 | Identical five-outcome Playwright inventory for every arm | Grep and Chromium/retry/worker controls at `scripts/bench-browser-runtimes.ts:118`; route assertions above | PARTIAL: harness is aligned, but no valid comparable all-arm screening and raw outcomes are count-only |
| BRR-02 | Node 24/Bun 1.4, workers 1/2, invalidating failed/contentious profiles | Four profiles at `scripts/bench-browser-runtimes.ts:78`; screening artifact declares one repetition at `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-24T22-49-36-109Z.json:14` and its worker-2 arms begin at lines 167 and 239 | FAIL: both worker-2 arms have no valid post-parser evidence; runtime versions are not stored |
| BRR-03 | Equivalent WebKit/Chrome smoke with deterministic cleanup | Backend configuration at `scripts/run-e2e-webview.ts:189`; route checks at line 135; view closure at line 272 | PARTIAL: both backends were sampled, but no WebView finalist has five valid samples and measured subprocess cleanup is not proven |
| BRR-04 | WebKit/Chrome cold/warm, 1/2 views, normal/`--smol`, valid/dominated treatment | Matrix generation at `scripts/bench-browser-runtimes.ts:95`; commands at line 118 | FAIL: `phase` only changes the profile label. Every arm uses `--passes=1` at line 137, every sample starts a new Bun/WebView process at line 221, and the server is started once per profile for both phases at line 343. Screening has one sample, not the three required by `design.md:28`. |
| BRR-05 | Warm-up + repeated interleaved valid samples, provenance, outcomes, process-tree peak RSS, RSSxTime, contamination control, cleanup | One warm-up/adaptive samples at `scripts/bench-browser-runtimes.ts:221`; process-tree traversal at `app/lib/bench/runner.server.ts:41`; RSSxTime rendering at `scripts/bench-browser-runtimes.ts:293`; nested CRM/Antclips locks at `scripts/bench-browser-runtimes.ts:373` | FAIL: profiles run serially rather than finalists interleaving; versions, per-route outcomes, ambient contamination during/after a sample, and cleanup verification are absent. Final artifacts cite commit `9325a0d`, although the structured Playwright parser landed in `5960bc2`, so the exact executing tree is not reproducible from recorded provenance. |
| BRR-06 | Coverage-aware local-only decision, unchanged defaults/CI, compare time/RSS/RSSxTime/serialized queue throughput | Local-only decision at `docs/benchmarks/browser-runtime-revalidation/README.md:33`; unchanged `package.json`, `playwright.config.ts`, and `.github/**` verified by zero diff from pre-feature state | PARTIAL: defaults/CI and coverage framing pass; no serialized queue-throughput comparison exists and raw/report inconsistency invalidates “evidence complete” |

## Screening and Finalist Evidence

| Required evidence | Recorded evidence | Result |
| --- | --- | --- |
| Playwright Node/Bun x workers 1/2: one warm-up + three screening samples | Full matrix run has `repetitions: 1`; all four Playwright profiles are invalid because the parser failed | FAIL |
| Valid non-dominated finalists: one warm-up + at least five valid interleaved samples | Node worker-1 has 5/5. Bun worker-1 has a separate 5/5 artifact. No worker-2 or WebView confirmation exists. Profiles are run to completion sequentially at `scripts/bench-browser-runtimes.ts:343`. | FAIL |
| WebKit/Chrome cold/warm, serial/two-view, normal/`--smol` screening | All 16 labels exist and received one measured sample; WebKit two-view outcomes include failures, Chrome arms pass one sample | PARTIAL: labels screened, protocol count and warm/cold semantics fail |
| Contaminated/invalid samples retained with reasons | Invalid screening samples are retained. README calls Bun run contaminated at `docs/benchmarks/browser-runtime-revalidation/README.md:25`, but its raw JSON says `valid: true`, empty `invalidReasons`, and finalist at `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-24T22-54-52-802Z.json:206` | FAIL: material contradiction |

## Edge Cases and Controls

- PASS: fixed Playwright project, workers, retries, grep, reporter, and browser are explicit at `scripts/bench-browser-runtimes.ts:118`.
- PASS: both shared locks are nested. `machine-lock.py` acquires `/tmp/praxis-playwright.lock`, then runs `lockf` for the Antclips lock from `scripts/bench-browser-runtimes.ts:373`.
- PASS: process-tree RSS traverses parent/child PIDs at `app/lib/bench/runner.server.ts:46`.
- PASS: every constructed WebView is closed in `finally` and `closeAll()` is called on thrown failures at `scripts/run-e2e-webview.ts:272`.
- FAIL: no backend identity verification catches a silently different/unavailable engine.
- FAIL: no measured-process-group cleanup check catches lingering Chrome/WebKit/Playwright subprocesses.
- FAIL: contamination is sampled only before the command at `scripts/bench-browser-runtimes.ts:229`; activity beginning during a sample is not excluded.
- FAIL: warm-up validity/contamination does not invalidate a profile; `BrowserProfileResult.valid` only derives from measured sample reasons at `scripts/bench-browser-runtimes.ts:238`.
- FAIL: the report does not distinguish actual browser-process reuse because no warm browser process is reused.

## Gate Check

- Focused harness gate: PASS, 4 files and 15 tests passed, 0 failed, 0 skipped.
- Full Vitest gate: PASS, 133 files passed, 3 files skipped; 2,281 tests passed, 84 skipped, 0 failed. Feature diff adds 3 test files and 8 test cases; it deletes no tests.
- Biome: PASS with exit 0, but reports four `noNonNullAssertion` warnings in `app/tests/bench-browser-runtimes.test.ts:37`.
- TypeScript (`bunx tsc --noEmit`): PASS.
- Build (`bun run build`): PASS.
- Test annotation lint (`bun run lint:tests`): PASS.
- Existing Chromium five-route smoke: NOT RUN TO COMPLETION. Fresh execution queued behind the CRM machine lock held by another worktree for over six minutes and was cancelled without starting the browser command. This is an external-state limitation, not an implementation failure. Existing recorded Node and Bun finalist artifacts report successful smoke outcomes, but their evidence gaps remain blockers above.
- Required valid-finalist gate: FAIL because worker-2 and WebView confirmations are absent, Node/Bun samples are not interleaved, and Bun contamination status is contradictory.

The task file uses prose labels rather than exact runnable commands at `.specs/features/browser-runtime-revalidation/tasks.md:24`. Commands above are the direct project-script equivalents used for fresh verification.

## Discrimination Sensor

The sensor ran only in detached temporary worktrees. Both worktrees were force-removed, pruned, and the real-tree porcelain matched the baseline exactly (`?? docs/_reports/`).

| Mutation | Target | Result |
| --- | --- | --- |
| Flip WebView expected-status comparison (`!==` to `===`) | `scripts/run-e2e-webview.ts:140` | KILLED by `app/tests/browser-webview.test.ts:51` |
| Reverse non-dominance time comparison (`<=` to `>=`) | `scripts/bench-browser-runtimes.ts:210` | KILLED by `app/tests/bench-browser-runtimes.test.ts:63` |
| Disable external-browser contamination regex | `scripts/bench-browser-runtimes.ts:266` | SURVIVED: all 4 focused files and 15 tests still passed |

**Sensor result**: FAIL, 2/3 killed and 1/3 survived. The surviving contamination mutant is a blocking test-integrity gap.

## Code Quality

| Check | Result |
| --- | --- |
| Minimum/surgical implementation | PASS: no product behavior, dependency, default, Playwright config, or CI changes |
| Matches project testing boundary | PARTIAL: pure logic uses Vitest and real browser remains in harness, but contamination, cleanup, retry, warm/cold, provenance, and raw/report consistency lack tests |
| Spec-anchored outcomes | PARTIAL: route assertions match the common contract; benchmark JSON collapses exact outcomes to boolean/count |
| No unclaimed scope | PASS |
| Test integrity | FAIL: contamination mutant survives and task matrix promise of “all branches, contamination, outcomes, cleanup” at `.specs/features/browser-runtime-revalidation/tasks.md:19` is unmet |

## Required Fix Tasks

1. **Blocker: implement real cold/warm lifecycle semantics.** Cold starts server/browser per sample. Warm starts once per arm and reuses the browser session across warm-up and measured passes. Record the timing boundary and add behavior-level tests.
2. **Blocker: make process cleanup and contamination auditable.** Verify every measured process group is gone, detect external browser activity before/during/after samples, invalidate contaminated warm-ups/profiles, and add tests that kill contamination/cleanup mutants.
3. **Blocker: rerun the approved evidence protocol.** Use one discarded warm-up plus three valid screening samples for all Playwright and WebView arms. Promote valid non-dominated profiles and collect at least five valid interleaved samples for every finalist, including any surviving workers=2 and WebView profiles.
4. **Blocker: reconcile raw evidence and report.** Either store the Bun contamination reason in its sample/result and exclude it, or remove the unsupported contamination claim. Record the exact dirty-tree/source provenance used to execute every run.
5. **Major: preserve comparison data.** Store runtime/browser/backend versions, exact route outcomes, setup overhead, cleanup result, and serialized queue throughput. Do not infer `routeCount: 5` without validating the reported inventory.
6. **Major: add raw/summary consistency tests.** Assert every README disposition and metric against its linked JSON, plus screening/finalist sample counts and interleaving.

## Requirement Traceability

| Requirement | Verified status |
| --- | --- |
| BRR-01 | PARTIAL |
| BRR-02 | FAIL |
| BRR-03 | PARTIAL |
| BRR-04 | FAIL |
| BRR-05 | FAIL |
| BRR-06 | PARTIAL |

## Summary

**Overall**: NOT READY

**Spec-anchored check**: 0/6 requirements fully verified; 3 partial and 3 failed.
**Gate**: unit/static/build gates pass; required finalist gate fails; fresh browser smoke was externally blocked before execution.
**Sensor**: 2/3 mutations killed; contamination mutant survived.
**Defaults/CI**: unchanged.

The conservative product decision can remain, but T2-T6 cannot be considered fully validated until the protocol and evidence blockers above are resolved.
