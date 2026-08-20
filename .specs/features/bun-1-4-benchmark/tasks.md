# Bun 1.4 Benchmark & Migration Tasks

## Execution Protocol (MANDATORY -- do not skip)

Implement these tasks with the `tlc-spec-driven` skill: **activate it by name and follow its Execute flow and Critical Rules.** Do not search for skill files by filesystem path.

**If the skill cannot be activated, STOP and tell the user - do not proceed without it.**

---

**Design**: `.specs/features/bun-1-4-benchmark/design.md`
**Status**: Draft

---

## Test Coverage Matrix

> Generated from codebase, project guidelines, and spec. Guidelines found: `CLAUDE.md`, `AGENTS.md`, `.agents/rules/testing.md`, `vite.config.ts` (`test.include: ["app/tests/**/*.test.ts"]`).

| Code Layer | Required Test Type | Coverage Expectation | Location Pattern | Run Command |
| ---------- | ------------------ | -------------------- | ---------------- | ----------- |
| Pure lib logic (`stats.ts`, `cli.ts`, `versions.ts`, `workloads.ts`) | unit | All branches; 1:1 to spec ACs; every listed edge case has a test | `app/tests/bench-*.test.ts` | `bun run test` |
| Server orchestration (`runner.server.ts`, `runtime.server.ts`, `preflight.server.ts`, `host.server.ts`) | integration | Happy path + every failure path named in the design's Error Handling table, exercised against stub child processes and a stub HTTP server - never against the real workloads | `app/tests/bench-*.test.ts` | `bun run test` |
| Report rendering (`reporter.server.ts`) | unit | Every rendering branch: two-version table, single-version fallback, findings section, `within noise` verdict | `app/tests/bench-*.test.ts` | `bun run test` |
| Repo config / file assertions (workflows, `Dockerfile`, `package.json`, `Makefile`, `.gitignore`) | unit | Assert the pinned value, following the existing `app/tests/ci-workflow.test.ts` precedent | `app/tests/*-workflow.test.ts`, `app/tests/bench-*.test.ts` | `bun run test` |
| Thin CLI entry (`scripts/bench.ts`) | none | build gate only - logic lives in the lib modules by design | - | build gate only |
| Docs / MDX content | none | `bun run audit:content` gate | - | `bun run audit:content` |

**Note:** `tests/e2e/` is untouched. This feature adds no route and no browser surface, so per `.agents/rules/testing.md` nothing here belongs in Playwright.

## Gate Check Commands

| Gate Level | When to Use | Command |
| ---------- | ----------- | ------- |
| Quick | After tasks with unit/integration tests only | `bun run test` |
| Full | After tasks touching a browser surface | `bun run test && bun run test:e2e` (not reached by this feature) |
| Build | After phase completion or config-only tasks | `bun run lint && bunx tsc --noEmit && bun run test && bun run build` |

---

## Execution Plan

Arrows below show real dependency edges within a phase, not merely execution order. Tasks still execute sequentially in the listed order; a task with no inbound arrow simply has no same-phase prerequisite.

### Phase 1: Pure foundation

Order: T1, T2, T3, T4, T5

```
T1 → T2
T1 → T3
T1 → T4
T1 → T5
```

### Phase 2: Measurement core

Order: T6, T7, T8, T9

```
T1 → T6
T7 → T8
T2 → T9
T3 → T9
```

### Phase 3: Runtime measurement

Order: T10, T11

```
T10 → T11
```

### Phase 4: Wiring, reporting, operator readiness

Order: T12, T13, T14, T15, T16

```
T12 → T13
T6 → T13
T9 → T13
T14 → T15
T13 → T16
T14 → T16
T15 → T16
```

### Phase 5: Post-run (BLOCKED until the operator executes the benchmark)

Order: T17, T18

```
T17 → T18
```

Phase 5 cannot start until a full two-version run has produced a committed result JSON. It is planned here so the traceability is complete, not because it is executable now.

---

## Task Breakdown

### T1: Define benchmark result types — ✅ Complete

**What**: Declare every result shape the harness produces, exactly as specified in the design's Data Models section.
**Where**: `app/lib/bench/types.ts`
**Depends on**: None
**Reuses**: Repo convention of `type` over `interface` (`CLAUDE.md`)
**Requirement**: BENCH-01

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `Sample`, `Aggregate`, `WorkloadResult`, `RuntimeResult`, `Finding`, `HostMeta`, `RunResult` declared and exported
- [ ] `RunResult.schemaVersion` is the literal type `1`
- [ ] Declared with `type`, never `interface`
- [ ] No TypeScript errors

**Tests**: none
**Gate**: build

**Commit**: `feat(bench): add benchmark result types`

---

### T2: Resolve per-version Bun toolchains — ✅ Complete

**What**: Declare the compared versions in one place and derive each version's install root, binary path, cache dir and spawn environment.
**Where**: `app/lib/bench/versions.ts`
**Depends on**: T1
**Reuses**: `node:path`
**Requirement**: BENCH-02, BENCH-15

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `BENCH_VERSIONS` exported as the single declared list, so adding a version needs no workload-code edit
- [ ] `toolchainFor(version)` returns `{ root, bin, binary, cacheDir }` all under `.bench/`
- [ ] `envFor(version, baseEnv)` prepends `bin` to `PATH` and sets `BUN_INSTALL` and `BUN_INSTALL_CACHE_DIR`
- [ ] Test asserts `envFor` never points `BUN_INSTALL` at the developer's global `~/.bun`
- [ ] Test asserts the original `PATH` entries survive after the prepend
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 6 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bench): resolve per-version bun toolchains`

---

### T3: Declare the workload registry — ✅ Complete

**What**: Declare every measured workload as data — argv, repetitions, prepare steps, DB/bundle needs, total-exclusion flag, extra parser.
**Where**: `app/lib/bench/workloads.ts`
**Depends on**: T1
**Reuses**: command list from `package.json` scripts and `Makefile`
**Requirement**: BENCH-06, BENCH-07, BENCH-08

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] Workloads `install-cold`, `install-warm`, `build`, `test`, `test-e2e`, `lint`, `check`, `sync`, `audit-fe` declared with stable string ids
- [ ] `install-cold` prepare list contains `rm-node-modules` and `rm-install-cache`; `install-warm` contains only `rm-node-modules`
- [ ] `build` prepare list contains `rm-output` and `rm-vite-cache`
- [ ] Both install workloads pass `--frozen-lockfile` and set `excludeFromTotal: true`
- [ ] `needsDb` true for exactly `sync` and `audit-fe`; `needsBundle` true for exactly `test-e2e` and `audit-fe`
- [ ] `test-e2e` carries a `parseExtra` that extracts passed/failed counts from a Playwright summary string
- [ ] `selectWorkloads(undefined)` returns all; `selectWorkloads(["lint"])` returns one; an unknown id throws naming the id
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 10 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bench): declare workload registry`

---

### T4: Implement benchmark statistics — ✅ Complete

**What**: Implement the aggregation and delta classification that every published number depends on.
**Where**: `app/lib/bench/stats.ts`
**Depends on**: T1
**Reuses**: nothing — pure
**Requirement**: BENCH-04, BENCH-12

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `aggregate(samples)` returns median, min, max, median peak RSS and sample count, and returns `null` for an empty array rather than `NaN`
- [ ] `percentile(sorted, p)` correct for p50/p95/p99 on both even- and odd-length inputs
- [ ] `noiseBand(a, b)` returns the wider of the two min-to-max spreads
- [ ] `classifyDelta(a, b)` returns `within-noise` when the delta magnitude is inside the noise band, and `faster`/`slower` otherwise
- [ ] Test proves a known 2× delta renders as `-50%`
- [ ] Test proves a delta smaller than the noise band is `within-noise` and never reported as an improvement
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 12 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bench): add benchmark statistics`

---

### T5: Parse benchmark CLI flags — ✅ Complete

**What**: Pure parser for `--only`, `--versions`, `--allow-noisy` and `--report-only`.
**Where**: `app/lib/bench/cli.ts`
**Depends on**: T1
**Reuses**: exported-pure-parser pattern from `scripts/audit-fe.ts`
**Requirement**: BENCH-05

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `parseBenchArgs` returns `{ only?, versions?, allowNoisy, reportOnly? }`
- [ ] Comma-separated values are split and trimmed
- [ ] Absent flags yield `undefined`, and `allowNoisy` defaults to `false`
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 7 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bench): parse benchmark cli flags`

---

### T6: Collect host provenance metadata — ✅ Complete

**What**: Capture the machine facts that make a result file interpretable months later.
**Where**: `app/lib/bench/host.server.ts`
**Depends on**: T1
**Reuses**: `node:os`
**Requirement**: BENCH-03

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `collectHostMeta()` returns hostname, CPU model, core count, total memory, 1-minute load average, power source and ISO timestamp
- [ ] Power source resolves to `ac`, `battery`, or `unknown` — and returns `unknown` rather than throwing when `pmset` is absent
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 5 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(bench): collect host provenance metadata`

---

### T7: Measure a spawned process tree

**What**: Spawn one command in its own process group, measure wall time and peak RSS, enforce the timeout.
**Where**: `app/lib/bench/runner.server.ts`
**Depends on**: T1, T4
**Reuses**: process-group technique verified in the design's Research Findings
**Requirement**: BENCH-03

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `spawnMeasured` spawns with `detached: true` and samples `ps -o rss= -g <pgid>` every 100 ms, keeping the running maximum
- [ ] Returns wall-clock ms, peak RSS bytes, exit code, stdout and the last 20 lines of stderr
- [ ] Test proves peak RSS of a child that allocates a known large buffer exceeds a child that allocates nothing
- [ ] Test proves a descendant process's memory is counted, not just the direct child's
- [ ] Test proves a command exceeding the timeout is killed via the process group and reported as timed out, leaving no orphan
- [ ] Test proves a non-zero exit is returned as data, not thrown
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 7 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(bench): measure spawned process trees`

---

### T8: Run the workload matrix

**What**: Execute prepare steps, repetitions and version iteration, flush partial results, and restore `node_modules` on exit.
**Where**: `app/lib/bench/runner.server.ts` (modify)
**Depends on**: T2, T3, T7
**Reuses**: `workloads.ts` prepare-step vocabulary, `stats.ts` aggregation
**Requirement**: BENCH-01, BENCH-04, BENCH-06, BENCH-08

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `runWorkload` discards the first repetition as warm-up and aggregates the rest
- [ ] A non-zero exit produces a `compat` finding and the matrix continues to the next workload
- [ ] A timeout produces a `timeout` finding and the matrix continues
- [ ] `needsBundle` workloads trigger an unconditional preparatory build whose duration is excluded from the samples
- [ ] Prepare steps only ever delete paths inside the repo or inside `.bench/` — a test asserts no prepare step can resolve to `~/.bun`
- [ ] `runMatrix` invokes the partial-result sink after each workload so an interrupt leaves data on disk
- [ ] `restoreNodeModules(defaultBunPath)` reinstalls with the developer's default binary and is exported for the entry point's signal handlers
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 11 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(bench): run the workload matrix`

---

### T9: Preflight the run environment

**What**: Refuse to start when the machine or environment would produce numbers not worth publishing.
**Where**: `app/lib/bench/preflight.server.ts`
**Depends on**: T2, T3
**Reuses**: `versions.ts` toolchain resolution, `site-model.server.ts` for route existence
**Requirement**: BENCH-02, BENCH-05

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] Each selected version's binary exists and `bun --version` matches exactly, else the failure names the exact `curl … bash -s "bun-vX.Y.Z"` remedy
- [ ] Aborts when the 1-minute load average exceeds 2.0, naming the observed value, unless `allowNoisy` is set
- [ ] Checks Docker and the `db` container only when a selected workload sets `needsDb`, and distinguishes "Docker not installed" from "container not running"
- [ ] Aborts when the runtime port is bound, naming the port and the owning PID
- [ ] Aborts when the `pt-br` route selected for the runtime workload does not resolve in the site model
- [ ] Returns a discriminated result rather than throwing, so the entry point owns the exit code
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 12 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(bench): preflight the run environment`

---

### T10: Generate HTTP load and compute latency percentiles

**What**: Fixed-concurrency load generator, exported independently so it can be tested without booting Nitro.
**Where**: `app/lib/bench/runtime.server.ts`
**Depends on**: T4
**Reuses**: `stats.ts` `percentile`
**Requirement**: BENCH-10, BENCH-11

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `generateLoad(baseUrl, routes, { concurrency, durationMs })` issues requests round-robin across the routes at fixed concurrency for the given duration
- [ ] Returns p50/p95/p99, total request count, and non-2xx responses grouped by route and status
- [ ] Non-2xx responses are recorded, never discarded
- [ ] Test runs against a local stub HTTP server, including one route that deliberately returns 500
- [ ] Test proves the generator honours the duration rather than a request count
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 8 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(bench): generate http load and latency percentiles`

---

### T11: Measure the production bundle at runtime

**What**: Boot the Nitro bundle under a given Bun version and record boot time, the three RSS phases and latency.
**Where**: `app/lib/bench/runtime.server.ts` (modify)
**Depends on**: T7, T10
**Reuses**: readiness-poll and shutdown-grace shape from `scripts/run-audit-fe.ts`; RSS sampler from T7
**Requirement**: BENCH-09, BENCH-10, BENCH-11

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `measureRuntime` records boot ms from spawn to first successful HTTP response
- [ ] Records idle RSS after a 3-second settle, peak RSS during load, and RSS 10 seconds after load stops
- [ ] Terminates the server's process group and confirms the port is free before returning
- [ ] Identical environment variables are applied to every version's run
- [ ] Test drives the whole cycle against a stub server script rather than the real bundle, and asserts no listener survives the call
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 7 tests pass (no silent deletions)

**Tests**: integration
**Gate**: quick

**Commit**: `feat(bench): measure production bundle runtime`

---

### T12: Render the comparison report

**What**: Turn a result JSON into `REPORT.md` with deltas, noise verdicts and a findings section.
**Where**: `app/lib/bench/reporter.server.ts`
**Depends on**: T4
**Reuses**: `app/lib/app-audit/reporter.server.ts` structure
**Requirement**: BENCH-12

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `renderReport(run)` is pure and emits one row per workload with both medians, the absolute delta and the percentage delta
- [ ] Deltas inside the noise band render as `within noise`, not as an improvement or regression
- [ ] Compat and timeout findings render in a dedicated section naming workload, version and exit code
- [ ] A single-version run renders the single-version table plus an explicit "no comparison available" line
- [ ] `writeReport(run, dir)` writes `REPORT.md` and returns its path
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 9 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bench): render the comparison report`

---

### T13: Wire the benchmark entry point

**What**: Thin CLI that parses args, preflights, runs the matrix, writes the date-stamped JSON and the report, and installs the restore handlers.
**Where**: `scripts/bench.ts`
**Depends on**: T5, T6, T8, T9, T11, T12
**Reuses**: `scripts/audit-fe.ts` thin-wrapper convention
**Requirement**: BENCH-01, BENCH-05, BENCH-15

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `bun run bench` exists in `package.json` scripts and invokes `scripts/bench.ts`
- [ ] Result JSON is written to `docs/benchmarks/bun-1-4/<ISO-date>.json` and never overwrites an existing file from a different date
- [ ] `SIGINT`/`SIGTERM` and a `finally` block flush partial results and restore `node_modules` with the default Bun binary
- [ ] Exits non-zero when preflight fails, printing the preflight reason
- [ ] Test asserts the `bench` script is registered in `package.json`
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `feat(bench): wire the benchmark entry point`

---

### T14: Add toolchain setup and ignore the workspace

**What**: `make bench-setup` installs both pinned Bun versions into `.bench/`, and `.bench/` is ignored.
**Where**: `Makefile`
**Depends on**: T2
**Reuses**: existing `## help` comment convention in `Makefile`
**Requirement**: BENCH-02

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `make bench-setup` installs each version via `curl -fsSL https://bun.com/install | BUN_INSTALL=… bash -s "bun-vX.Y.Z"`
- [ ] The target is idempotent — an already-correct install is skipped, not reinstalled
- [ ] `make bench` target added, delegating to `bun run bench`
- [ ] `.gitignore` contains `.bench/` with a comment explaining what it holds
- [ ] Test asserts `.gitignore` ignores `.bench/` and that both `Makefile` targets exist
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 4 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `chore(bench): add toolchain setup and ignore workspace`

---

### T15: Resolve where Bun 1.4 keeps its install store

**What**: Determine empirically whether Bun 1.4's global virtual store lives under `BUN_INSTALL_CACHE_DIR`, and make `install-cold` honestly cold either way.
**Where**: `app/lib/bench/workloads.ts` (modify)
**Depends on**: T3, T14
**Reuses**: the installed `.bench/` toolchains from T14
**Requirement**: BENCH-06

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] The on-disk store location under Bun 1.4 is determined by running an install into an isolated root and inspecting what appeared on disk — not by assumption
- [ ] The finding is written into `docs/benchmarks/bun-1-4/README.md` with the command used and its output
- [ ] If the store sits outside `BUN_INSTALL_CACHE_DIR`, `install-cold`'s prepare list is extended to clear it; if it sits inside, that fact is recorded so a future reader does not re-litigate it
- [ ] A test asserts `install-cold`'s prepare list covers every store path the finding identified
- [ ] Gate check passes: `bun run test`
- [ ] Test count: 3 tests pass (no silent deletions)

**Tests**: unit
**Gate**: quick

**Commit**: `fix(bench): make install-cold clear the bun 1.4 store`

---

### T16: Write the operator run playbook

**What**: The document the user follows to execute the benchmark, including what to check before, during and after.
**Where**: `docs/benchmarks/bun-1-4/README.md` (modify)
**Depends on**: T13, T14, T15
**Reuses**: nothing
**Requirement**: BENCH-01

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] Documents the exact command sequence: `make bench-setup`, `docker compose up db -d`, `make bench`
- [ ] States the expected wall-clock duration of a full run and which workloads dominate it
- [ ] Documents every preflight abort message and its remedy
- [ ] States what to do when the run is interrupted, and confirms `node_modules` is restored automatically
- [ ] Names the output paths and states that the JSON is committed while `docs/_reports/` is not
- [ ] Records the measurement limitations that the post must repeat: 5 samples, single machine, 100 ms RSS sampling granularity
- [ ] Gate check passes: `bun run lint && bunx tsc --noEmit && bun run test && bun run build`

**Tests**: none
**Gate**: build

**Commit**: `docs(bench): add operator run playbook`

---

### T17: Migrate the repository to Bun 1.4.0 — BLOCKED

**What**: Move every pin to an explicit 1.4.0 once the measurement shows no unresolved incompatibility.
**Where**: `.github/workflows/ci.yml`
**Depends on**: T16
**Reuses**: existing workflow-assertion tests
**Requirement**: BENCH-13

**Blocked by**: a completed two-version run with zero unresolved `compat` findings under 1.4.0.

**Tools**: MCP: NONE — Skill: NONE

**Done when**:

- [ ] `bun-version` is `1.4.0` in `ci.yml`, `app-audit.yml` and `content-audit.yml`
- [ ] `Dockerfile` pins `oven/bun:1.4.0` and `oven/bun:1.4.0-alpine` instead of the floating major tag
- [ ] `package.json` declares `engines.bun` as `>=1.4.0`
- [ ] `app/tests/app-audit-workflow.test.ts:83` and `app/tests/content-audit-workflow.test.ts:55`, which currently assert `bun-version: "1.3.13"`, are updated to the new pin
- [ ] Gate check passes: `bun run lint && bunx tsc --noEmit && bun run test && bun run build`, plus `bun run test:e2e`
- [ ] Test count: full suite passes with no skips added

**Tests**: unit
**Gate**: build

**Commit**: `chore(bun): pin toolchain to 1.4.0`

---

### T18: Write the performance case study post — BLOCKED

**What**: The `en` and `pt-br` post whose every number traces to the committed result JSON.
**Where**: `app/content/posts/en/<slug>.mdx`
**Depends on**: T17
**Reuses**: `CONTENT.md` authoring rules; existing post frontmatter shape
**Requirement**: BENCH-14

**Blocked by**: T17, and therefore by the measurement run.

**Tools**: MCP: NONE — Skill: `writing-tech-post`, `humanizer`, `content-audit`

**Done when**:

- [ ] Both locales exist under one English-canonical slug
- [ ] A methodology section states the versions, repetition count, statistic, hardware, and that this is a single-machine run and not a controlled benchmark environment
- [ ] Every number in the prose is present in the committed result JSON
- [ ] Deltas inside the noise band are written as no measurable change
- [ ] Any Bun 1.4 marketing claim measured and not reproduced here is stated explicitly
- [ ] `bun run audit:content` reports zero blocker and zero major findings attributable to the post
- [ ] Gate check passes: `bun run lint && bunx tsc --noEmit && bun run test && bun run build`

**Tests**: none
**Gate**: build

**Commit**: `feat(blog): add bun 1.4 performance case study`

---

## Phase Execution Map

Phases run in sequence: Phase 1 → Phase 2 → Phase 3 → Phase 4 → Phase 5.

Execution order inside each phase:

- Phase 1: T1, T2, T3, T4, T5
- Phase 2: T6, T7, T8, T9
- Phase 3: T10, T11
- Phase 4: T12, T13, T14, T15, T16
- Phase 5: T17, T18

Execution is strictly sequential — one task at a time, in order. The dependency edges are the ones drawn in the Execution Plan above.

---

## Task Granularity Check

| Task | Scope | Status |
| ---- | ----- | ------ |
| T1: result types | 1 file, types only | ✅ Granular |
| T2: version resolution | 1 file, 3 cohesive functions | ✅ Granular |
| T3: workload registry | 1 file, data + selector | ✅ Granular |
| T4: statistics | 1 file, 4 cohesive pure functions | ✅ Granular |
| T5: CLI parsing | 1 file, 1 function | ✅ Granular |
| T6: host metadata | 1 file, 1 function | ✅ Granular |
| T7: spawn measurement | 1 file, 1 function | ✅ Granular |
| T8: matrix execution | same file, distinct concern | ✅ Granular |
| T9: preflight | 1 file, 1 entry function | ✅ Granular |
| T10: load generation | 1 file, 1 function | ✅ Granular |
| T11: runtime measurement | same file, distinct concern | ✅ Granular |
| T12: report rendering | 1 file, 2 functions | ✅ Granular |
| T13: entry point | 1 file + 1 manifest line | ✅ Granular |
| T14: toolchain setup | 1 Makefile + 1 ignore line | ✅ Granular |
| T15: store investigation | 1 file modified + 1 doc | ✅ Granular |
| T16: run playbook | 1 doc | ✅ Granular |
| T17: version pins | config files + their assertions | ✅ Granular |
| T18: the post | 1 post, 2 locales | ✅ Granular |

---

## Diagram-Definition Cross-Check

| Task | Depends On (body) | Diagram Shows | Status |
| ---- | ----------------- | ------------- | ------ |
| T1 | None | phase head | ✅ Match |
| T2 | T1 | T1 → T2 | ✅ Match |
| T3 | T1 | T1 → T3 | ✅ Match |
| T4 | T1 | T1 → T4 | ✅ Match |
| T5 | T1 | T1 → T5 | ✅ Match |
| T6 | T1 | cross-phase only, no same-phase edge | ✅ Match |
| T7 | T1, T4 | cross-phase only, no same-phase edge | ✅ Match |
| T8 | T2, T3, T7 | T7 → T8 plus cross-phase T2, T3 | ✅ Match |
| T9 | T2, T3 | cross-phase only, no same-phase edge | ✅ Match |
| T10 | T4 | cross-phase only, no same-phase edge | ✅ Match |
| T11 | T7, T10 | T10 → T11 plus cross-phase T7 | ✅ Match |
| T12 | T4 | cross-phase only, no same-phase edge | ✅ Match |
| T13 | T5, T6, T8, T9, T11, T12 | T12 → T13 plus cross-phase rest | ✅ Match |
| T14 | T2 | cross-phase only, no same-phase edge | ✅ Match |
| T15 | T3, T14 | T14 → T15 plus cross-phase T3 | ✅ Match |
| T16 | T13, T14, T15 | T13 → T16, T14 → T16, T15 → T16 | ✅ Match |
| T17 | T16 | cross-phase only, no same-phase edge | ✅ Match |
| T18 | T17 | T17 → T18 | ✅ Match |

No task depends on a later phase.

---

## Test Co-location Validation

| Task | Code Layer | Matrix Requires | Task Says | Status |
| ---- | ---------- | --------------- | --------- | ------ |
| T1 | types only | none | none | ✅ OK |
| T2 | pure lib logic | unit | unit | ✅ OK |
| T3 | pure lib logic | unit | unit | ✅ OK |
| T4 | pure lib logic | unit | unit | ✅ OK |
| T5 | pure lib logic | unit | unit | ✅ OK |
| T6 | server orchestration | integration | integration | ✅ OK |
| T7 | server orchestration | integration | integration | ✅ OK |
| T8 | server orchestration | integration | integration | ✅ OK |
| T9 | server orchestration | integration | integration | ✅ OK |
| T10 | server orchestration | integration | integration | ✅ OK |
| T11 | server orchestration | integration | integration | ✅ OK |
| T12 | report rendering | unit | unit | ✅ OK |
| T13 | thin entry + repo config | none / unit | unit | ✅ OK |
| T14 | repo config | unit | unit | ✅ OK |
| T15 | pure lib logic | unit | unit | ✅ OK |
| T16 | docs | none | none | ✅ OK |
| T17 | repo config | unit | unit | ✅ OK |
| T18 | MDX content | none | none | ✅ OK |
