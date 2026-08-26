# Browser Runtime Revalidation Tasks

## Execution Protocol (MANDATORY -- do not skip)

Use `tlc-spec-driven` Execute: one atomic commit per task, traceability, gates,
fresh Sol-medium verifier and discrimination sensor. Luna-high implementers are
approved. No push/merge or CI/default change.

**Design**: `.specs/features/browser-runtime-revalidation/design.md`
**Status**: Approved / In Progress

## Test Coverage Matrix

> Generated from `AGENTS.md`, `.agents/rules/testing.md`, `package.json`,
> `playwright.config.ts`, current benchmark tests and historical WebView evidence.

| Layer | Type | Expectation | Location | Command |
| --- | --- | --- | --- | --- |
| Profile/benchmark logic | unit/integration | All branches, contamination, outcomes, cleanup | `app/tests/*browser-runtime*.test.ts` | focused Vitest |
| Playwright smoke | E2E | Same five outcomes for every runtime/worker arm | `tests/e2e/public-read.spec.ts` | profile harness |
| WebView smoke | browser integration | Same five outcomes on WebKit/Chrome | `scripts/run-e2e-webview.ts` | local WebView route |
| Evidence/docs | none | Raw/summary consistency | `docs/benchmarks/browser-runtime-revalidation/**` | build gate |

## Gate Check Commands

| Gate | Command |
| --- | --- |
| Quick | focused Vitest + Biome + TypeScript |
| Browser | five-route profile under both shared locks |
| Build | lint + typecheck + build + lint-tests |
| Final | full harness tests + valid finalists + existing Chromium smoke |

## Execution Plan

```text
T1 → T2
T1 → T3
T2 → T4
T3 → T4
T4 → T5 → T6
```

## Task Breakdown

### T1: Add common browser benchmark contract
**What**: Encode the five-route smoke inventory and outcome normalization.
**Where**: `app/lib/browser-bench/contract.ts`
**Depends on**: None
**Requirement**: BRR-01
**Tests**: unit
**Gate**: quick
**Commit**: `test(browser): add common smoke contract`
**Status**: ✅ Complete

### T2: Extend Playwright runtime profiles
**What**: Add controlled Node/Bun worker-1/2 screening without changing E2E defaults.
**Where**: `scripts/bench-e2e-runtimes.ts`
**Depends on**: T1
**Requirement**: BRR-01, BRR-02, BRR-05
**Tests**: unit/integration
**Gate**: browser
**Commit**: `test(browser): add controlled playwright profiles`
**Status**: ✅ Complete

### T3: Restore a local WebView smoke harness
**What**: Implement equivalent WebKit/Chrome five-route smoke with deterministic cleanup.
**Where**: `scripts/run-e2e-webview.ts`
**Depends on**: T1
**Requirement**: BRR-03
**Tests**: unit/integration
**Gate**: browser
**Commit**: `test(browser): restore local webview smoke`
**Status**: ✅ Complete

### T4: Add browser finalist benchmark
**What**: Screen cold/warm, serial/parallel-view and smol profiles and confirm valid finalists.
**Where**: `scripts/bench-browser-runtimes.ts`
**Depends on**: T2, T3
**Requirement**: BRR-04, BRR-05
**Tests**: unit/integration
**Gate**: browser
**Commit**: `test(browser): add browser finalist benchmark`
**Status**: ✅ Complete

### T5: Record controlled browser evidence
**What**: Execute screening/finalists and preserve raw reports.
**Where**: `docs/benchmarks/browser-runtime-revalidation/runs/`
**Depends on**: T4
**Requirement**: BRR-01, BRR-03, BRR-05
**Tests**: benchmark evidence
**Gate**: final
**Commit**: `docs(browser): record runtime revalidation runs`
**Status**: ✅ Complete — one valid five-sample finalist recorded; contaminated/invalid arms retained with reasons

### T6: Record browser runtime decision
**What**: Compare performance, memory, coverage and maintenance without changing defaults/CI.
**Where**: `docs/benchmarks/browser-runtime-revalidation/README.md`
**Depends on**: T5
**Requirement**: BRR-06
**Tests**: documentation/gate consistency
**Gate**: final
**Commit**: `docs(browser): decide runtime revalidation`
**Status**: ✅ Complete

## Diagram-Definition Cross-Check

| Task | Diagram | Depends on | Result |
| --- | --- | --- | --- |
| T1 | none | none | ✅ |
| T2 | T1 | T1 | ✅ |
| T3 | T1 | T1 | ✅ |
| T4 | T2, T3 | T2, T3 | ✅ |
| T5 | T4 | T4 | ✅ |
| T6 | T5 | T5 | ✅ |

## Test Co-location Validation

| Task | Required | Co-located | Result |
| --- | --- | --- | --- |
| T1 | unit | yes | ✅ |
| T2 | unit/integration | yes | ✅ |
| T3 | unit/integration | yes | ✅ |
| T4 | unit/integration | yes | ✅ |
| T5 | evidence | yes | ✅ |
| T6 | consistency/final gates | yes | ✅ |

## Remediation Tasks

The independent verifier found blockers after T1–T6. The following Execute
fixes close harness and evidence gaps without changing Playwright defaults or
CI:

| Fix | Scope | Status | Evidence |
| --- | --- | --- | --- |
| R1 | Real cold/warm WebView boundaries; one session for warm passes | ✅ | Persistent warm sessions and shared test server in `scripts/bench-browser-runtimes.ts`; `run-2026-08-25T04-16-32-724Z` |
| R2 | Three-sample screening, five-sample finalist confirmation metadata, round-robin schedule | ✅ | Trace-derived schedule and 5/5 confirmation in `run-2026-08-25T04-16-32-724Z` |
| R3 | Exact route identities, Playwright setup overhead, runtime/backend provenance | ✅ | Node 24.19.0/Bun 1.4.0 provenance, setup + exact five routes in fresh raw JSON |
| R4 | Before/during/after contamination sensor and deterministic process-group cleanup | ✅ | `scripts/bench-browser-runtimes.ts`; all fresh samples cleanup-verified and uncontaminated |
| R5 | Raw/report protocol reconciliation and invalid evidence retention | ✅ | Fresh JSON/Markdown pair and reconciled README; invalid historical attempts retained |
| R6 | Focused behavior tests including contamination and cleanup discrimination | ✅ | `app/tests/bench-browser-runtimes.test.ts:79`, `app/tests/bench-runner.test.ts:113`; 18 focused tests |

## Iteration-5 Remediation Tasks

| Fix | Scope | Status | Evidence |
| --- | --- | --- | --- |
| R7 | One global six-profile coordinator with persistent warm finalists, one warm-up per profile, and five rotated measured rounds | ✅ | `scripts/bench-browser-runtimes.ts:555`; focused benchmark tests pass |
| R8 | Trace integrity: append-only execution order, exact sequences, real timestamps, and schedule identity checks | ✅ | `scripts/bench-browser-runtimes.ts:340`; `app/tests/bench-browser-runtimes.test.ts:268` |
| R9 | Entry point acquires both shared locks with bounded wait, explicit reentry marker, and raw lock provenance | ✅ | `scripts/bench-browser-runtimes.ts:614`; focused lock contract test |
| R10 | Run six-profile common-subset confirmation under both locks and replace report/decision evidence | ✅ | `run-2026-08-25T06-17-36-513Z`: all six profiles 5/5 valid with one discarded warmup, exact five routes, trace 0..35, schedule identity, lock provenance, no contamination/invalid reasons |
