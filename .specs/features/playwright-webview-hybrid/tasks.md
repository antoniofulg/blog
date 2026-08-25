# Playwright WebView Hybrid Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: activate it by name and
follow its Execute flow and Critical Rules. The final task is followed by a
fresh independent Verifier.

**Design**: `.specs/features/playwright-webview-hybrid/design.md`
**Status**: In Progress

## Test Coverage Matrix

> Generated from `AGENTS.md`, `.agents/rules/testing.md`, `.agents/rules/cicd.md`, existing Bun tests, and existing Playwright specs.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Driver fixture and benchmark parser/scheduler | unit | Every HYBRID outcome/edge branch and exact route inventory | `app/tests/*.test.ts` | `bun test app/tests/playwright-webview-hybrid.test.ts` |
| Local public browser contract | e2e | All five contract routes and every declared expected field for each driver | `tests/e2e-webview/*.spec.ts` | `bunx --bun playwright test --config=playwright.webview.config.ts` |
| Isolated config and package routes | none | Build/static gate only | `playwright.webview.config.ts`, `package.json` | Build gate |
| Benchmark evidence | none | Schema/result validation and report inspection | `docs/benchmarks/playwright-webview-hybrid/**` | Build gate |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit-tested helper/coordinator changes | `bun test app/tests/playwright-webview-hybrid.test.ts` |
| Full | Local functional E2E changes | `bun run build && bunx --bun playwright test --config=playwright.webview.config.ts --workers=1` |
| Build | Phase completion and final evidence | `bun run check && bun run lint && bun run lint:tests && bun run test:bun && bun run test:e2e:bun` |

## Execution Plan

### Phase 1: Harness

```text
T1 -> T2 -> T3 -> T4
```

### Phase 2: Measurement

```text
T4 -> T5 -> T6
```

## Task Breakdown

### T1: Add the matched browser smoke fixture

**What**: Add one project-selected Page/WebView fixture and its pure observation helpers.
**Where**: `tests/e2e-webview/fixtures/browser-smoke.ts`
**Depends on**: None
**Reuses**: `app/lib/browser-bench/contract.ts`, `scripts/run-e2e-webview.ts`
**Requirement**: HYBRID-01, HYBRID-02

**Tools**:
- MCP: NONE
- Skill: Bun, e2e-coverage, no-workarounds, ponytail

**Done when**:
- [x] Page, WebKit, and Chrome drivers expose one observation contract.
- [x] WebView branches do not request Playwright built-in browser fixtures.
- [x] Chrome drivers resolve the same Chromium executable.
- [x] Failure teardown can attach a screenshot.
- [x] Focused unit gate passes with no skipped/deleted tests.

**Tests**: unit in `app/tests/playwright-webview-hybrid.test.ts`
**Gate**: quick
**Commit**: `test(e2e): add matched Page and WebView fixture`

### T2: Add the isolated Playwright Test config

**What**: Add a local config with Page, WebKit, and Chrome projects outside canonical discovery.
**Where**: `playwright.webview.config.ts`
**Depends on**: T1
**Reuses**: canonical E2E server command and setup lifecycle
**Requirement**: HYBRID-01, HYBRID-05

**Tools**:
- MCP: NONE
- Skill: Bun, e2e-coverage, ponytail

**Done when**:
- [x] Config uses one worker, no retries, separate reports, and the Bun E2E server.
- [x] Benchmark mode can use an already-seeded external server.
- [x] Canonical config and CI remain byte-for-byte unchanged.
- [x] Typecheck and lint pass.

**Tests**: none (config layer)
**Gate**: build
**Commit**: `test(e2e): isolate Playwright WebView projects`

### T3: Add the exact five-route project suite

**What**: Add one shared spec that runs the exact five routes in every local project.
**Where**: `tests/e2e-webview/public-smoke.spec.ts`
**Depends on**: T2
**Reuses**: matched fixture and `BROWSER_SMOKE_ROUTES`
**Requirement**: HYBRID-01, HYBRID-02

**Tools**:
- MCP: NONE
- Skill: Bun, e2e-coverage, ponytail

**Done when**:
- [ ] Each project lists exactly five functional tests in contract order.
- [ ] Every expected route field maps to an assertion.
- [ ] Page and both WebView projects pass locally.
- [ ] No fixed sleep, retry, skip, or weakened assertion is added.

**Tests**: e2e
**Gate**: full
**Commit**: `test(e2e): cover matched public smokes in hybrid projects`

### T4: Add explicit local routes

**What**: Add opt-in package scripts for the WebView harness and hybrid benchmark.
**Where**: `package.json`
**Depends on**: T3
**Reuses**: isolated config and Bun-hosted Playwright CLI
**Requirement**: HYBRID-05

**Tools**:
- MCP: NONE
- Skill: Bun, ponytail

**Done when**:
- [ ] New routes are local-only and do not replace existing `test:e2e*` routes.
- [ ] Existing package-script contract tests still pass.
- [ ] Focused unit gate passes.

**Tests**: unit in `app/tests/playwright-webview-hybrid.test.ts`
**Gate**: quick
**Commit**: `test(e2e): expose local Playwright WebView routes`

### T5: Add the lifecycle benchmark coordinator

**What**: Add the locked, interleaved cold/warm coordinator and report renderer.
**Where**: `scripts/bench-playwright-webview-hybrid.ts`
**Depends on**: T4
**Reuses**: process runner, statistics, host metadata, E2E server, and shared locks
**Requirement**: HYBRID-03, HYBRID-04

**Tools**:
- MCP: NONE
- Skill: Bun, no-workarounds, ponytail

**Done when**:
- [ ] Every profile/phase has one discarded command and five interleaved valid samples.
- [ ] Warm samples retain internal warmup and measured action separately.
- [ ] Invalid outcomes, runtime, timeout, exit, marker, and cleanup cases are rejected.
- [ ] Raw JSON contains every metric and provenance field from the spec.
- [ ] Parser/scheduler/report unit tests pass.

**Tests**: unit in `app/tests/playwright-webview-hybrid.test.ts`
**Gate**: quick
**Commit**: `test(e2e): benchmark Playwright Test with WebView drivers`

### T6: Record measured evidence and final gates

**What**: Run the controlled benchmark and commit its raw/report evidence.
**Where**: `docs/benchmarks/playwright-webview-hybrid/README.md`
**Depends on**: T5
**Reuses**: benchmark coordinator output
**Requirement**: HYBRID-03, HYBRID-04, HYBRID-05

**Tools**:
- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:
- [ ] Latest raw JSON and Markdown contain five valid samples per profile/phase.
- [ ] README reports compatible comparisons, warmup-inclusive values, limitations, and cost breakdown.
- [ ] Canonical Bun Test passes with its unchanged count.
- [ ] Canonical Chromium Playwright passes 49/49.
- [ ] Typecheck, Biome, lint-tests, and feature validation pass.

**Tests**: none (evidence layer; all source tests run in Build gate)
**Gate**: build
**Commit**: `docs(test): record Playwright WebView hybrid benchmark`

## Phase Execution Map

```text
Phase 1 -> Phase 2
T1 -> T2 -> T3 -> T4 -> T5 -> T6
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | One fixture contract plus co-located unit coverage | Granular |
| T2 | One isolated config | Granular |
| T3 | One shared project spec | Granular |
| T4 | One package manifest change | Granular |
| T5 | One benchmark coordinator plus co-located unit coverage | Granular |
| T6 | One evidence pack | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | start | Match |
| T2 | T1 | T1 -> T2 | Match |
| T3 | T2 | T2 -> T3 | Match |
| T4 | T3 | T3 -> T4 | Match |
| T5 | T4 | T4 -> T5 | Match |
| T6 | T5 | T5 -> T6 | Match |

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Driver fixture | unit | unit | OK |
| T2 | Config | none | none | OK |
| T3 | E2E route contract | e2e | e2e | OK |
| T4 | Package route | unit | unit | OK |
| T5 | Benchmark logic | unit | unit | OK |
| T6 | Evidence | none | none | OK |
