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

- [x] One warmup per profile is excluded from five persisted samples.
- [x] Profiles run sequentially with alternating order.
- [x] Invalid samples suppress a winner.
- [x] JSON and Markdown include all spec-required metadata.
- [x] Focused twin tests pass.

**Tests**: unit
**Gate**: quick

### T3: Add the low-memory local profile

**What**: Add `test:local` and benchmark script aliases without changing the default or CI command.
**Where**: `package.json`
**Depends on**: T2
**Reuses**: current Bun runtime guard and Vitest invocation.
**Requirement**: BMF-01

**Tools**:

- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:

- [ ] `test:local` uses the lowest-memory valid profile selected by evidence.
- [ ] `test` remains `test:vitest:bun`.
- [ ] Script-contract twin tests pass.

**Tests**: unit
**Gate**: quick

### T4: Run and persist the worker benchmark

**What**: Execute the complete worker matrix and commit raw JSON plus Markdown with a valid or explicit invalid verdict.
**Where**: `docs/benchmarks/vitest-workers/`
**Depends on**: T3
**Reuses**: T2 benchmark CLI.
**Requirement**: BMF-01

**Tools**:

- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:

- [ ] All four profiles have one warmup and five measured runs.
- [ ] Outcome counts match and all failures/timeouts are visible.
- [ ] `test:local` passes under the selected profile.

**Tests**: integration
**Gate**: build

### T5: Add the Playwright runtime benchmark

**What**: Add a self-contained benchmark CLI for Node 24 and Bun 1.4 Playwright runners.
**Where**: `scripts/bench-e2e-runtimes.ts`
**Depends on**: T4
**Reuses**: Playwright JSON output, current Bun web server, and existing benchmark helpers.
**Requirement**: BMF-03

**Tools**:

- MCP: Docs MCP
- Skill: Bun, e2e-coverage, tlc-spec-driven

**Done when**:

- [ ] Both runtimes are validated before warmup.
- [ ] One warmup per arm is excluded from five interleaved samples.
- [ ] One worker and zero retries are forced.
- [ ] Invalid outcomes suppress a winner and leave no orphan server.
- [ ] Focused twin tests pass.

**Tests**: unit
**Gate**: quick

### T6: Run and persist the Playwright runtime benchmark

**What**: Execute both runtime arms and commit raw JSON plus Markdown with a valid or explicit invalid verdict.
**Where**: `docs/benchmarks/e2e-runtimes/`
**Depends on**: T5
**Reuses**: T5 benchmark CLI.
**Requirement**: BMF-03

**Tools**:

- MCP: NONE
- Skill: Bun, e2e-coverage, tlc-spec-driven

**Done when**:

- [ ] Both arms have one warmup and five measured runs.
- [ ] Same Chromium inventory completes with zero skipped/flaky/unexpected results.
- [ ] Report states that both arms use the same Bun application server.

**Tests**: integration
**Gate**: full

### T7: Add and validate Firefox and WebKit projects

**What**: Add Firefox and WebKit Playwright projects and run every configured browser locally.
**Where**: `playwright.config.ts`
**Depends on**: T6
**Reuses**: setup dependency, storage state, device presets, and one-worker setting.
**Requirement**: BMF-03

**Tools**:

- MCP: Docs MCP
- Skill: e2e-coverage, tlc-spec-driven

**Done when**:

- [ ] Chromium, Firefox, and WebKit share authenticated setup and one worker.
- [ ] Each project completes its full applicable suite with zero unexpected failures.
- [ ] Browser result evidence is committed.

**Tests**: e2e
**Gate**: full

### T8: Harden Bun Test cutover readiness

**What**: Make the shadow eligibility gate require distinct commits and equivalent outcomes, and document a durable evidence path.
**Where**: `app/lib/test-bench/shadow.ts`
**Depends on**: T7
**Reuses**: current shadow record parser and ten-run suffix evaluation.
**Requirement**: BMF-04

**Tools**:

- MCP: NONE
- Skill: Bun, tlc-spec-driven

**Done when**:

- [ ] Duplicate commits cannot satisfy the ten-run gate.
- [ ] Outcome parity is required by the eligibility evidence.
- [ ] Focused twin tests pass.
- [ ] Vitest and Node fallbacks remain.

**Tests**: unit
**Gate**: quick

### T9: Audit and reconcile migration artifacts

**What**: Mark current/historical states accurately, inventory obsolete branches safely, and consolidate cutover/benchmark evidence.
**Where**: `docs/benchmarks/testing-runtimes/2026-08-22-summary.md`
**Depends on**: T8
**Reuses**: AD-001, AD-002, existing raw benchmark directories, and completed validation reports.
**Requirement**: BMF-04

**Tools**:

- MCP: NONE
- Skill: tlc-spec-driven, find-rules

**Done when**:

- [ ] Historical measurements are preserved and labeled.
- [ ] Current stack and rollback paths are unambiguous.
- [ ] Branches used by worktrees are not removed.
- [ ] Removal checklist names every remaining Vitest dependency and gate.

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
| T3 | Script aliases | Granular |
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
