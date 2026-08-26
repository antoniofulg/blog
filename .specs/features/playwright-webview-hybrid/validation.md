# Playwright WebView Hybrid Validation

**Verdict**: PASS
**Date**: 2026-08-25
**Spec**: `.specs/features/playwright-webview-hybrid/spec.md`
**Diff range**: `96789fe..429b87e`
**Verified HEAD**: `429b87e709db60e0b63a2ae8ae3cac300131113c`
**Verifier**: independent sub-agent (author != verifier)

All 11 acceptance criteria and all three listed edge cases match the spec-defined outcomes. Every mandatory gate passed from the verified HEAD. All three behavior-level mutants died in an isolated temporary worktree.

---

## Task Completion

| Task | Status | Notes |
| --- | --- | --- |
| T1 | Done | Matched fixture, capability failures, screenshots, and driver contracts verified. |
| T2 | Done | Isolated one-worker, zero-retry config verified. |
| T3 | Done | Five exact route tests per project passed, 15/15 total. |
| T4 | Done | Additive local scripts verified; canonical scripts remain unchanged. |
| T5 | Done | Scheduler, lifecycle validation, process validation, and comparison behavior verified. |
| T6 | Done | Raw evidence, report, and all final gates verified. |

---

## Spec-Anchored Acceptance Criteria

| Criterion | Spec-defined outcome | `file:line` + assertion expression | Result |
| --- | --- | --- | --- |
| Driver AC1: local Page project executes exactly the five ordered route IDs through headless Chromium | `en-post`, `pt-br-post`, `not-found`, `en-index`, `pt-br-index`; five passing Page tests | `app/lib/browser-bench/contract.ts:1` defines the exact ordered IDs; `tests/e2e-webview/public-smoke.spec.ts:80` iterates only `BROWSER_SMOKE_ROUTES`; `tests/e2e-webview/public-smoke.spec.ts:110` asserts `expect(result.observation.passed).toBe(true)`; fresh hybrid run produced five Page passes. | PASS |
| Driver AC2: both WebView projects execute the same five IDs through Bun.WebView without built-in `page`, `browser`, or `context` fixtures | Five WebKit and five Chrome passes; fixture dependency object is empty | `app/tests/playwright-webview-hybrid.test.ts:86` asserts the complete project/driver profile array with `toEqual(...)`; `app/tests/playwright-webview-hybrid.test.ts:126` asserts `expect(source).toContain("browserSmoke: async ({}, use, testInfo)")`; `app/tests/playwright-webview-hybrid.test.ts:127` rejects built-in fixture names with `expect(source).not.toMatch(...)`; fresh hybrid run produced 10/10 WebView passes. | PASS |
| Driver AC3: every route completion asserts every declared status, language, heading, body-text, and canonical-path value | Exact shared-contract values for each present field | `tests/e2e-webview/public-smoke.spec.ts:93` asserts `expect(result.snapshot.status).toBe(route.expectedStatus)`; `:96` language; `:99` heading; `:102` body text; `:105`-`:107` canonical path; `:109`-`:110` no observation error and pass. Fresh run passed all 15 route instances. | PASS |
| Driver AC4: a failed local driver test attaches a PNG while the driver remains available | Attachment name `failure.png`, MIME `image/png`, PNG body; screenshot failure remains a secondary text attachment and does not replace the test failure | `app/tests/playwright-webview-hybrid.test.ts:133` asserts failure-only capture; `:157`-`:159` asserts `expect(attachments).toEqual([{ name: "failure.png", body: png, contentType: "image/png" }])`; `:171`-`:173` asserts error attachment name, MIME, and preserved `capture failed` text. `tests/e2e-webview/fixtures/browser-smoke.ts:161` captures before `close()` at `:163`. | PASS |
| Driver AC5: canonical config, suite, commands, Makefile, and CI remain unchanged | Zero feature diff in `playwright.config.ts`, `tests/e2e/**`, `Makefile`, and `.github/**`; canonical Chromium remains 49/49 | Fresh `git diff --quiet 96789fe..429b87e -- playwright.config.ts tests/e2e Makefile .github` exited 0. `app/tests/test-scripts.test.ts:62`-`:69` asserts exact canonical aliases; `:71`-`:77` asserts additive hybrid aliases. Fresh canonical run asserted 49 passed, 0 failed, 0 skipped. | PASS |
| Benchmark AC1: each cold cohort discards one command per profile and retains five valid commands in alternating profile order | Per profile: run 0 warmup plus measured runs 1-5; measured profile order rotates each run | `app/tests/playwright-webview-hybrid.test.ts:230`-`:240` asserts an exact discarded-plus-rotated schedule with `expect(buildHybridSchedule(...)).toEqual(...)`. Raw protocol declares five repetitions at `docs/benchmarks/playwright-webview-hybrid/runs/run-2026-08-25T18-23-45-236Z.json:14`; fresh executable invariant assertion checked every cold cohort and all five rotations. | PASS |
| Benchmark AC2: each warm command records one in-session five-route warmup separately before the measured pass | Warmup precedes measurement; finite `internalWarmupMs` is excluded from `actionMs`; five retained warm samples per profile | `tests/e2e-webview/public-smoke.spec.ts:45`-`:49` executes `warmup` before `measured`; `:59` and `:60` store separate durations. `app/tests/playwright-webview-hybrid.test.ts:280`-`:285` asserts missing warmup rejection with `toContain("warm sample is missing internal warmup")`. Raw warm summary has `internalWarmup.sampleCount: 5` at `run-2026-08-25T18-23-45-236Z.json:2791`-`:2795`; fresh invariant assertion checked every warm sample. | PASS |
| Benchmark AC3: each measured sample records wall, startup, warmup when present, action, teardown, residual overhead, process-tree peak RSS, and RSS x wall-time | All eight required measurements are finite and non-negative; warmup is finite only for warm samples | `scripts/bench-playwright-webview-hybrid.ts:523`-`:554` constructs the complete sample, including `wallMs`, `peakRssBytes`, `rssTimeGiBSeconds`, lifecycle phases, residual, and validity. First raw sample contains these fields at `run-2026-08-25T18-23-45-236Z.json:307`-`:350`; warm aggregate evidence is at `:2773`-`:2825`. Fresh executable assertion iterated all 36 samples: `must(Number.isFinite(s[k]) && s[k] >= 0, \`metric ${k}\`)` for every required metric. | PASS |
| Benchmark AC4: persisted JSON includes runtime, browser, routes, cleanup, commands, sample order, host, commit, and timestamp | Complete provenance exists for every sample and the run | Top-level commit, timestamp, host, protocol, routes, profiles, and phases are at `run-2026-08-25T18-23-45-236Z.json:3`-`:32`; first sample command/order/time/process/runtime/browser/routes are at `:290`-`:345`. Fresh executable assertions checked all 36 samples for exact command profile, route order, Bun `1.4.x`, browser version, cleanup, timestamps, plus top-level host/commit/timestamp. | PASS |
| Benchmark AC5: route parity, runtime provenance, cleanup, timeout, or exit validation failure invalidates the sample and prevents winner claims | Exact invalid reason for each failure mode; invalid candidate comparison has `valid: false` and all winner metrics `null` | `app/tests/playwright-webview-hybrid.test.ts:267`-`:292` asserts route drift, missing warmup, and Bun runtime rejection; `:295`-`:317` asserts Chrome failure leaves Page/WebKit valid; `:320`-`:333` asserts exact exit/timeout/cleanup reasons; `:341`-`:350` asserts invalid comparison and every metric `null`. | PASS |
| Benchmark AC6: reports label WebKit cross-engine and use WebView Chrome for direct Chromium comparison | WebKit scope is `cross-engine`; WebView Chrome scope is `engine-matched`; report states the boundary | `scripts/bench-playwright-webview-hybrid.ts:404` assigns the exact scopes. Raw comparisons assert the resulting values at `run-2026-08-25T18-23-45-236Z.json:2957` and `:2975`; generated report states the comparison boundary at `docs/benchmarks/playwright-webview-hybrid/runs/run-2026-08-25T18-23-45-236Z.md:26`. Fresh invariant assertions required both exact scope values. | PASS |

**Status**: PASS, 11/11 ACs match the spec-defined outcome. No uncovered ACs and no spec-precision gaps.

---

## Discrimination Sensor

Scratch: detached temporary worktree `/tmp/playwright-webview-verifier.5tJza5` at `429b87e`. It linked the existing dependency tree, received mutations only in scratch, and was force-removed after the run. No stash was used.

| Mutation | File:line | Description | Killed? |
| --- | --- | --- | --- |
| 1 | `scripts/bench-playwright-webview-hybrid.ts:245` | Disabled rejection of a warm sample whose internal warmup is missing or invalid. | KILLED: focused suite failed at `app/tests/playwright-webview-hybrid.test.ts:285`; 15 passed, 1 failed. |
| 2 | `tests/e2e-webview/fixtures/browser-smoke.ts:143` | Changed required attachment name from `failure.png` to `failure.jpg` while leaving PNG MIME/body. | KILLED: focused suite failed at `app/tests/playwright-webview-hybrid.test.ts:157`; 15 passed, 1 failed. |
| 3 | `scripts/bench-playwright-webview-hybrid.ts:449` | Disabled invalidation when process-group cleanup is not verified. | KILLED: focused suite failed at `app/tests/playwright-webview-hybrid.test.ts:326`; 15 passed, 1 failed. |

**Sensor depth**: lightweight, three targeted high-value behavior mutations.

**Result**: PASS, 3/3 killed, 0 survived.

Real porcelain before sensor cleanup:

```text
?? .specs/features/playwright-webview-hybrid/validation.md
?? docs/_reports/
```

Real porcelain after scratch cleanup was identical. `docs/_reports/` remained untouched.

---

## Interactive UAT Results

Not performed. This is a local test/benchmark infrastructure feature; automated functional E2E, raw evidence validation, and mutation testing cover the observable outcomes.

---

## Code Quality

| Principle | Status | Evidence |
| --- | --- | --- |
| Minimum code | PASS | One isolated fixture, config, shared spec, coordinator, and evidence pack implement the bounded experiment. |
| Surgical changes | PASS | Canonical Playwright boundary is unchanged; supporting test changes address deterministic runtime budgets and cleanup only. |
| No scope creep | PASS | No canonical runner/CI replacement, retries, Page wrapper, or full-suite WebView port. |
| Matches patterns | PASS | Bun-hosted Playwright, one worker, zero retries, shared route contract, existing process measurement/statistics/server helpers. |
| Spec-anchored outcome check | PASS | 11/11 ACs cite exact assertions or fresh executable invariant assertions against persisted evidence. |
| Per-layer coverage expectation | PASS | Unit coverage exercises driver, parser, scheduler, invalidation, isolation, and comparison branches; E2E covers five routes x three drivers. |
| Every feature test is claimed | PASS | All 16 focused unit tests map to an AC, listed edge case, or task done-when contract. |
| Documented guidelines followed | PASS | `.agents/rules/testing.md`, `.agents/rules/cicd.md`, `references/validate.md`, and `references/coding-principles.md`. |
| RSS test is incompressible and assertions remain strong | PASS | `app/tests/bench-runner.test.ts:11`-`:15` uses `randomFillSync(Buffer.allocUnsafe(300 MiB))`; `:35`-`:36` and `:54`-`:55` retain both relative and `> 32 MiB` assertions. Fresh full gate passed. |
| Timeout/hook budgets did not weaken behavior | PASS | Diff inspection found only explicit timeout increases and `try/finally` cleanup. Existing `expect(...)` expressions remain present; no assertion, test, or branch was skipped/deleted. Examples: `app/tests/e2e-harness.test.ts:99`-`:103` retains idempotent-close assertion with a 60s budget; `app/tests/pglite-extended-query.test.ts:14`-`:22` budgets hooks while `:58` retains the zero-unhandled-rejection assertion. |
| Analytics isolation is narrow | PASS | `app/tests/playwright-webview-hybrid.test.ts:353`-`:364` asserts only `E2E_BROWSER_SMOKE=true` suppresses analytics; `:367`-`:377` asserts the flag exists only in hybrid config and not canonical config. |

Specific post-FAIL corrections verified:

- Missing or invalid warmup: exact rejection asserted at `app/tests/playwright-webview-hybrid.test.ts:280`-`:285`; mutant killed.
- Timeout, exit, cleanup, runtime, and no-winner contracts: exact reason/null payload assertions at `app/tests/playwright-webview-hybrid.test.ts:287`-`:350`.
- Missing Bun.WebView: exact failure without Page fallback at `app/tests/playwright-webview-hybrid.test.ts:176`-`:185`.
- Missing Chromium: exact pre-launch failure at `app/tests/playwright-webview-hybrid.test.ts:188`-`:196`; isolated Chrome invalidity at `:295`-`:317`.
- Screenshot name, MIME, PNG body, and screenshot-error preservation: exact payload assertions at `app/tests/playwright-webview-hybrid.test.ts:132`-`:173`; mutant killed.
- Incompressible RSS: random-filled 300 MiB allocation and unchanged `> 32 MiB` deltas at `app/tests/bench-runner.test.ts:11`-`:55`.
- Analytics isolation: hybrid-only environment gate assertions at `app/tests/playwright-webview-hybrid.test.ts:353`-`:377`.
- Hook budgets: timeout-only changes plus stronger `finally` cleanup; no behavior assertion weakened.

---

## Edge Cases

- [x] Missing `Bun.WebView` fails explicitly and never falls back to Playwright Page: `expect(() => assertBunWebViewAvailable(undefined)).toThrow(...)` at `app/tests/playwright-webview-hybrid.test.ts:176`-`:185`.
- [x] Missing Chromium executable fails only the Chrome profile while Page and WebKit stay valid: exact throw at `app/tests/playwright-webview-hybrid.test.ts:188`-`:196` and isolated validation assertions at `:295`-`:317`.
- [x] Surviving measured process group invalidates the sample: exact reasons assertion at `app/tests/playwright-webview-hybrid.test.ts:319`-`:333`; cleanup mutant killed.

---

## Gate Check

| Gate command | Exact fresh result |
| --- | --- |
| `bun test app/tests/playwright-webview-hybrid.test.ts` | PASS: 16 passed, 0 failed, 0 skipped, 41 `expect()` calls, 1 file. |
| `bunx tsc --noEmit` | PASS: exit 0, no diagnostics. |
| `bun run check` | PASS: Biome checked 264 files, no fixes. |
| `bun run lint` | PASS: Biome checked 264 files, no fixes. |
| `bun run lint:tests` | PASS: exit 0. |
| `bun run build` | PASS: client, SSR, and Nitro production build completed; warnings only. |
| `bun run test:bun` | PASS: 2272 passed, 101 skipped, 0 failed, 62,420 `expect()` calls, 2373 tests across 134 files. |
| `bun run test:e2e:bun -- --reporter=line` | PASS: 49 passed, 0 failed, 0 skipped, 49 total using one Chromium worker. |
| `bunx --bun playwright test --config=playwright.webview.config.ts --workers=1 --reporter=line` | PASS: 15 passed, 0 failed, 0 skipped, exactly five per project using one worker. |
| Raw JSON invariant audit | PASS: 36/36 valid samples; six cohorts with one discarded plus five retained; exact schedule/routes/provenance/cleanup/metrics/scopes. |

- **Result**: 9 executable gates passed, 0 failed. Raw invariant audit also passed.
- **Test count before feature**: not recorded in the feature artifacts. The spec/tasks define absolute post-feature counts instead of a baseline delta.
- **Test count after feature**: 2373 Bun tests plus 49 canonical Playwright tests plus 15 hybrid Playwright tests.
- **Delta**: not derivable without a pre-feature baseline count.
- **Skipped tests**: 101 existing environment-gated Bun integration tests for unavailable local PostgreSQL/Docker/live HTTP/auth/seed/sync services. The feature adds no skip.
- **Failures**: none.

---

## Fix Plans

None. No failed AC, surviving mutant, spec-precision gap, or gate failure remains.

---

## Requirement Traceability Update

The verifier did not edit `spec.md`; the orchestrator owns traceability mutation after PASS.

| Requirement | Previous Status in spec | Verified outcome |
| --- | --- | --- |
| HYBRID-01 | Implementing | Verified |
| HYBRID-02 | Implementing | Verified |
| HYBRID-03 | Implementing | Verified |
| HYBRID-04 | Implementing | Verified |
| HYBRID-05 | In Tasks | Verified |

---

## Summary

**Overall**: PASS, ready for orchestrator traceability update.

**Spec-anchored check**: 11/11 ACs matched; 0 gaps; 0 spec-precision gaps.

**Edge cases**: 3/3 passed.

**Sensor**: 3/3 mutations killed.

**Gate**: 9/9 executable gates passed; Bun 2272/101/0/2373, canonical 49/49, hybrid 15/15.

**Issues found**: none.

**Next step**: orchestrator updates requirement statuses in `spec.md`; no implementation fix is required.
