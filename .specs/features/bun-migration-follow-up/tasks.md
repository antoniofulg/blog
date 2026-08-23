# Bun Migration Follow-up Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill. Follow its per-task
gate, atomic commit, adequacy review, and independent Verifier rules.

**Design**: `.specs/features/bun-migration-follow-up/design.md`
**Status**: Approved

## Test Coverage Matrix

> Generated from `.agents/rules/testing.md`, `.agents/rules/cicd.md`, `package.json`, `vitest.config.ts`, `playwright.config.ts`, and existing benchmark tests.

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| --- | --- | --- | --- | --- |
| Benchmark CLI and outcome logic | unit | All parsing, ordering, invalidation, aggregation, and rendering branches | `app/tests/*bench*.test.ts` and `app/tests-bun/*bench*.test.ts` | `bun run test:vitest:bun -- <file>` |
| Package/config contracts | unit | Exact scripts, runtimes, workers, and browser projects | `app/tests/*scripts*.test.ts`, `app/tests/ci-*.test.ts` and twins | `bun run test:vitest:bun -- <file>` |
| Browser flows | e2e | Full applicable suite, zero unexpected failures, one worker | `tests/e2e/*.spec.ts` | `bun run test:e2e:bun -- --project=<browser>` |
| Documentation and content | integration | Frontmatter, translation parity, links, claims, and committed evidence | content-audit and file-contract tests | `bun run audit:content` |

## Gate Check Commands

| Gate Level | When to Use | Command |
| --- | --- | --- |
| Quick | Unit-only task | `bun run test:vitest:bun -- <focused-test-file>` |
| Full | E2E/integration task | `bun run test:parity && bun run test && bun run test:e2e:bun -- --project=<browser>` |
| Build | Phase completion/config/docs task | `make lint && make check && make build-js && make test && make lint-tests` |

## Execution Plan

### Phase 1: Outcome parity and local memory

`T1 → T2 → T3 → T4`

### Phase 2: E2E runtime and browsers

`T5 → T6 → T7`

### Phase 3: Cutover evidence and publication

`T8 → T9 → T10`

## Task Breakdown

### T1: Resolve Bun Test skip outcome accounting

**What**: Identify the five-count discrepancy and make outcome comparison represent equivalent leaf tests while retaining raw runner counts.
**Where**: `app/lib/test-bench/runner.server.ts`
**Depends on**: None
**Reuses**: existing static parity inventory and summary parsers.
**Requirement**: BMF-02

**Tools**:

- MCP: Docs MCP
- Skill: Bun, tlc-spec-driven

**Done when**:

- [x] Evidence names the five runner-only outcomes: two synthetic `(unnamed)` hooks in `lang-slug-route`, two in `og-slug-route`, and one in `docker-compose`.
- [x] No test is removed, weakened, or skipped to change the count.
- [x] A/C comparison accepts only equivalent leaf outcomes and retains raw skip values.
- [x] Focused twin tests pass with no reduced test count.

**Tests**: unit
**Gate**: quick

### T2: Add the Vitest worker benchmark — ✅ Complete

**What**: Add a self-contained benchmark CLI for `1`, `2`, `4`, and default Bun+Vitest worker profiles.
**Where**: `scripts/bench-vitest-workers.ts`
**Depends on**: T1
**Reuses**: `spawnMeasured`, `collectHostMeta`, `aggregate`, and Vitest summary parsing.
**Requirement**: BMF-01

**Tools**:

- MCP: Docs MCP
- Skill: Bun, tlc-spec-driven

**Done when**:

- [x] One warmup per profile is retained as warmup evidence and excluded from five measured samples.
- [x] Profiles run sequentially with alternating order.
- [x] Each profile records `memoryValid` and profile-specific invalid reasons; failed profiles are excluded from memory selection without invalidating other profiles.
- [x] Memory comparison requires at least two valid profiles with equivalent outcomes; timing comparison requires every selected profile to remain memory-valid.
- [x] JSON and Markdown include all spec-required metadata.
- [x] Focused twin tests pass.

**Tests**: unit
**Gate**: quick

### T3: Add the worker benchmark script alias — ✅ Complete

**What**: Add the `bench:vitest:workers` alias without changing the default or CI command. The `test:local` decision remains deferred until T4 produces valid benchmark evidence.
**Where**: `package.json`
**Depends on**: T2
**Reuses**: current Bun runtime guard and Vitest invocation.
**Requirement**: BMF-01

**Tools**:

- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:

- [x] `bench:vitest:workers` invokes the worker benchmark CLI.
- [x] `test` remains `test:vitest:bun` and CI remains unchanged.
- [x] Script-contract twin tests pass.

**Tests**: unit
**Gate**: quick

### T4: Run and persist the worker benchmark — ✅ Complete (timing diagnostic)

**What**: Execute the complete worker matrix and commit raw JSON plus Markdown with a valid or explicit invalid verdict. After valid evidence selects a passing lowest-memory profile, add `test:local` for that profile.
**Where**: `docs/benchmarks/vitest-workers/` and `package.json`
**Depends on**: T3
**Reuses**: T2 benchmark CLI.
**Requirement**: BMF-01

**Tools**:

- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:

- [x] All four profiles have one warmup and five measured runs.
- [x] Failure, timeout, and missing-outcome evidence is visible; timing remains diagnostic.
- [x] Memory and timing validity are recorded separately; ambient-load timing failures suppress only the overall winner and retain a valid memory winner when memory outcomes are valid.
- [x] `test:local` passes under the operationally reliable serialized profile (`--maxWorkers=1`).

The 2026-08-23 rerun completed the full matrix with equivalent outcomes and a
valid memory comparison. Profile `2` has the lowest median peak RSS by 2.0 MiB
(0.12%), but a fresh `test:local` run with two workers failed two
`bench-runtime` tests because of a port/PID 843 race. Profile `1` is therefore
the operational `test:local` choice: serialized execution is more reliable and
the RSS medians are effectively tied. Ambient load exceeded 11 during multiple
samples, so duration comparison remains diagnostic and no overall timing winner
is reported.

**Tests**: integration
**Gate**: build

### T5: Add the Playwright runtime benchmark

**What**: Add a self-contained benchmark CLI for Node 24 and Bun 1.4 Playwright runners.
**Where**: `scripts/bench-e2e-runtimes.ts`, `package.json`, `app/tests/bench-e2e-runtimes.test.ts`, `app/tests-bun/bench-e2e-runtimes.test.ts`
**Depends on**: T4
**Reuses**: Playwright JSON output, current Bun web server, and existing benchmark helpers.
**Requirement**: BMF-03

**Tools**:

- MCP: Docs MCP
- Skill: Bun, e2e-coverage, tlc-spec-driven

**Done when**:

- [x] Both runtimes are validated before warmup; Node requires major 24 and Bun requires 1.4.x.
- [x] One warmup per arm is retained in raw output but excluded from five interleaved samples by default.
- [x] One worker, zero retries, Chromium, and the shared `playwright.config.ts`/Bun application server are forced; `CI` is removed from the child environment.
- [x] Failed, skipped, flaky, unexpected, changed-inventory, timed-out, and orphaned-process samples invalidate the arm/comparison and suppress a winner; memory and timing validity remain separate.
- [x] Focused Vitest and Bun Test twins pass, including per-sample temporary JSON output cleanup and persisted duration/RSS/load/version/browser/outcome fields.

**Tests**: unit
**Gate**: quick

### T6: Run and persist the Playwright runtime benchmark — ✅ Complete

**What**: Execute both runtime arms and commit raw JSON plus Markdown with a valid or explicit invalid verdict.
**Where**: `docs/benchmarks/e2e-runtimes/`
**Depends on**: T5
**Reuses**: T5 benchmark CLI.
**Requirement**: BMF-03

**Tools**:

- MCP: NONE
- Skill: Bun, e2e-coverage, tlc-spec-driven

**Done when**:

- [x] Both arms have one warmup and five measured runs.
- [x] Same Chromium inventory completes with zero skipped/flaky/unexpected results.
- [x] Report states that both arms use the same Bun application server.

**Evidence**: [raw JSON](../../../docs/benchmarks/e2e-runtimes/runtimes-2026-08-23T08-20-02-241Z.json) · [report](../../../docs/benchmarks/e2e-runtimes/runtimes-2026-08-23T08-20-02-241Z.md)

**Tests**: integration
**Gate**: full

### T7: Add and validate Firefox and WebKit projects — ✅ Complete

**What**: Add Firefox and WebKit Playwright projects and run every configured browser locally.
**Where**: `playwright.config.ts`
**Depends on**: T6
**Reuses**: setup dependency, storage state, device presets, and one-worker setting.
**Requirement**: BMF-03

**Tools**:

- MCP: Docs MCP
- Skill: e2e-coverage, tlc-spec-driven

**Done when**:

- [x] Chromium, Firefox, and WebKit share authenticated setup and one worker.
- [x] Each project completes its full applicable suite with zero unexpected failures.
- [x] Browser result evidence is committed.

The final Bun runs each executed 49 tests with zero skipped, unexpected, or
flaky outcomes. Evidence: [summary](../../../docs/benchmarks/e2e-browsers/2026-08-23-summary.md),
[Chromium](../../../docs/benchmarks/e2e-browsers/2026-08-23-chromium.json),
[Firefox](../../../docs/benchmarks/e2e-browsers/2026-08-23-firefox.json),
[WebKit](../../../docs/benchmarks/e2e-browsers/2026-08-23-webkit.json).

**Tests**: e2e
**Gate**: full

### T8: Harden Bun Test cutover readiness — ✅ Complete

**What**: Make the shadow eligibility gate require distinct commits and equivalent outcomes, and document a durable evidence path.
**Where**: `app/lib/test-bench/shadow.ts`
**Depends on**: T7
**Reuses**: current shadow record parser and ten-run suffix evaluation.
**Requirement**: BMF-04

**Tools**:

- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:

- [x] Duplicate commits cannot satisfy the ten-run gate.
- [x] Outcome parity is required by the eligibility evidence.
- [x] Focused twin tests pass.
- [x] Vitest and Node fallbacks remain.

**Tests**: unit
**Gate**: quick

### T9: Audit and reconcile migration artifacts — ✅ Complete (2026-08-23)

**What**: Mark current/historical states accurately, inventory obsolete branches safely, and consolidate cutover/benchmark evidence.
**Where**: `docs/benchmarks/testing-runtimes/2026-08-22-summary.md`
**Depends on**: T8
**Reuses**: AD-001, AD-002, existing raw benchmark directories, and completed validation reports.
**Requirement**: BMF-04

**Tools**:

- MCP: NONE
- Skill: tlc-spec-driven, find-rules

**Done when**:

- [x] Historical measurements are preserved and labeled.
- [x] Current stack and rollback paths are unambiguous.
- [x] Branches used by worktrees are not removed.
- [x] Removal checklist names every remaining Vitest dependency and gate.

**Evidence**: [consolidated runtime pack](../../../docs/benchmarks/testing-runtimes/2026-08-22-summary.md),
[Bun Test playbook](../../../docs/benchmarks/bun-test/README.md), and the current
141/141 parity scan. Worker profile `1` remains the operational serialized
choice after profile `2`'s 0.12% median RSS edge failed a fresh run with a
port/PID race. Playwright's persisted Node/Bun benchmark and all three 49/49
browser runs are linked from the evidence pack. T8's distinct-commit and
equivalent-outcome rule is covered by commit `83bac33`; no real ledger records
exist yet, so cutover eligibility remains 0/10. The Bun.WebView harness is
retired and its raw reports remain archived.

**Tests**: integration
**Gate**: build

### T10: Publish the bilingual migration post

**What**: Add English and Brazilian Portuguese posts backed by committed benchmark evidence.
**Where**: `app/content/posts/`
**Depends on**: T9
**Reuses**: existing bilingual MDX structure and content rules.
**Requirement**: BMF-04

**Tools**:

- MCP: Docs MCP
- Skill: writing-tech-post, humanizer, content-audit, find-docs, tlc-spec-driven

**Done when**:

- [ ] Both locales contain matching claims and limitations.
- [ ] Warmup and sample methodology are explicit.
- [ ] All numeric claims link to committed evidence.
- [ ] Content audit passes with zero blockers.

**Tests**: integration
**Gate**: build

## Phase Execution Map

```text
T1 → T2 → T3 → T4 → T5 → T6 → T7 → T8 → T9 → T10

Phase 1: T1 → T2 → T3 → T4
                         ↓
Phase 2:                T5 → T6 → T7
                                  ↓
Phase 3:                         T8 → T9 → T10
```

## Task Granularity Check

| Task | Scope | Status |
| --- | --- | --- |
| T1 | Outcome comparison rule | Complete |
| T2 | One benchmark CLI | Complete |
| T3 | Worker benchmark script alias | Complete |
| T4 | One persisted benchmark run | Granular |
| T5 | One benchmark CLI | Granular |
| T6 | One persisted benchmark run | Granular |
| T7 | Browser project matrix | Granular |
| T8 | Shadow eligibility rule | Granular |
| T9 | Migration evidence index | Granular |
| T10 | One bilingual publication | Granular |

## Diagram-Definition Cross-Check

| Task | Depends On | Diagram Shows | Status |
| --- | --- | --- | --- |
| T1 | None | Start | Match |
| T2 | T1 | T1 → T2 | Match |
| T3 | T2 | T2 → T3 | Match |
| T4 | T3 | T3 → T4 | Match |
| T5 | T4 | T4 → T5 | Match |
| T6 | T5 | T5 → T6 | Match |
| T7 | T6 | T6 → T7 | Match |
| T8 | T7 | T7 → T8 | Match |
| T9 | T8 | T8 → T9 | Match |
| T10 | T9 | T9 → T10 | Match |

## Test Co-location Validation

| Task | Layer | Matrix Requires | Task Says | Status |
| --- | --- | --- | --- | --- |
| T1 | Outcome logic | unit | unit | OK |
| T2 | Benchmark CLI | unit | unit | OK |
| T3 | Package contract | unit | unit | OK |
| T4 | Benchmark execution | integration | integration | OK |
| T5 | Benchmark CLI | unit | unit | OK |
| T6 | E2E execution | integration | integration | OK |
| T7 | Browser config/flows | e2e | e2e | OK |
| T8 | Shadow logic | unit | unit | OK |
| T9 | Documentation | integration | integration | OK |
| T10 | Content | integration | integration | OK |
