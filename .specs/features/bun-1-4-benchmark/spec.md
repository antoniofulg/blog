# Bun 1.4 Benchmark & Migration Specification

## Problem Statement

The blog's toolchain and runtime are pinned to Bun 1.3.x in CI (`ci.yml` → 1.3.14, `app-audit.yml` and `content-audit.yml` → 1.3.13) while the local machine already runs 1.4.0, and the `Dockerfile` tracks the floating `oven/bun:1` tag — so production silently drifts to whichever major-1 image is current. Bun 1.4.0 advertises large gains (install 30× on warm cache, 7× on CI, 2× faster Linux startup, HTTP server memory −13–48%), but none of those claims have been measured against this repository's actual workloads. We need reproducible before/after numbers to justify the version bump, and those numbers become the evidence base for a performance case study post.

## Goals

- [ ] A repeatable benchmark harness that runs every measured workload under Bun 1.3.14 and Bun 1.4.0 on the same machine and emits machine-readable results.
- [ ] Coverage of the full pipeline: `install` (cold and warm), `build`, `vitest`, `playwright`, `lint`, `check`, `sync`, `audit:fe`.
- [ ] Runtime measurement of the real blog: production bundle boot time, idle RSS, RSS under load, and response-time p50/p95.
- [ ] The version pins in CI and Docker moved to an explicit 1.4.0 after the numbers exist.
- [ ] A performance case study post published in `en` and `pt-br`, whose every number traces to a committed result file.

## Out of Scope

| Feature | Reason |
| ------- | ------ |
| Bun vs Node.js comparison | User deferred it to a future post; this feature compares 1.3.14 against 1.4.0 only. |
| Switching the Playwright runner | Playwright already executes under Bun via `bunx`; the question here is version delta, not runner swap. |
| Adopting new 1.4 APIs (`Bun.Image`, `Bun.markdown`, `Bun.WebView`, `bun test --parallel`) | Replacing `sharp`/`satori`/`vitest` is a separate migration with its own risk surface. Measured here only if it happens to be free. |
| Benchmarking inside Docker or on GitHub Actions runners | User chose a local dual-binary run; container and shared-runner variance would muddy the numbers. |
| Publishing the post automatically | Authoring is part of this feature; publishing stays a manual decision. |
| Executing the benchmark run itself as part of implementation | The machine currently hosts several active worktrees; the run is deferred to a quiet moment by explicit user decision. |

---

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --------------------- | -------------- | --------- | ---------- |
| Which two versions are compared | 1.3.14 (current `ci.yml` pin) vs 1.4.0 (current local) | 1.3.14 is the highest pinned version in the repo and therefore the honest "before". The 1.3.13 audit pins are treated as the same "before" generation. | y |
| How the two runtimes coexist | Each version installed into its own `BUN_INSTALL` root under a gitignored `.bench/` directory; the harness selects one by prepending its `bin` to `PATH` per run. | Avoids `bun upgrade` mutating the developer's global install and keeps both versions available for re-runs. | n |
| When the benchmark actually runs | The harness is built, unit-tested and committed; the measurement run is triggered manually by the user later. | User has several worktrees open; a contended machine would produce numbers not worth publishing. | y |
| Machine-contention control | The harness records load average, free memory, host, CPU model and battery/AC state into every result file, and refuses to run unless `--allow-noisy` is passed when the 1-minute load average exceeds 0.25 per core. | Cheap guard that keeps an accidental noisy run from being mistaken for a publishable one; the escape hatch keeps it non-blocking. Expressed per core because a raw load average is meaningless without the core count. | n |
| Repetitions per workload | 5 timed repetitions after 1 discarded warm-up, reporting median and min; `install --cold` runs 3 times because it is the slowest. | Median over 5 is enough to see a 2× claim without making a full matrix take hours. | n |
| Statistic reported in the post | Median, with min and max shown as a range; no confidence intervals. | 5 samples do not support real statistical inference, and claiming otherwise would be dishonest in a published post. | n |
| External dependencies during the run | Postgres via `docker compose up db` must be running for `sync`, `audit-fe` and `runtime`; the harness verifies it before starting and aborts with a clear message otherwise. | Those three workloads talk to the real database. `vitest` and `test-e2e` use the PGLite harness and need no container, so requiring one for them would be a false prerequisite. | n |
| A workload failing under one version | Recorded as a `compat` finding with exit code and captured stderr tail; the remaining matrix continues. | A 1.4 incompatibility is itself a publishable result and must not abort the run. | n |
| Load generator for the runtime workload | `bun run` script issuing a fixed concurrency of in-process `fetch` requests against the booted server, using the same generator binary for both runs. | Avoids adding `autocannon`/`oha` as a dependency; using one generator version keeps the client out of the comparison. | n |
| Which routes the runtime workload hits | `/`, `/blog`, one post page, and one `pt-br` post page — SSR routes only, no admin, no auth. | Covers the cache-cold SSR path a real reader hits without dragging session state into the measurement. | n |
| Post locale slugs | Same English-canonical slug in both locales, per the repo's content convention. | Matches `content-audit`'s `translation-gap` rule and the existing corpus. | n |
| Where results live | `docs/benchmarks/bun-1-4/*.json` committed; human-readable report at `docs/benchmarks/bun-1-4/REPORT.md` committed. | The post cites numbers; readers and future re-runs need the raw data in git, unlike the gitignored `docs/_reports/`. | n |

**Open questions:** none — all resolved or logged above.

---

## User Stories

### P1: Version-matrix benchmark harness ⭐ MVP

**User Story**: As the blog maintainer, I want a single command that runs every measured workload under both Bun versions so that I can produce comparable before/after numbers without hand-timing anything.

**Why P1**: Every other story consumes its output. Without the harness there is no evidence and no post.

**Acceptance Criteria**:

1. The system SHALL provide a `bun run bench` entry point that executes the full workload matrix for both configured Bun versions.
2. WHEN the harness starts THEN the system SHALL verify that both `.bench/bun-1.3.14/bin/bun` and `.bench/bun-1.4.0/bin/bun` report their expected version via `bun --version`, and SHALL abort with a non-zero exit and an install hint if either is missing or mismatched.
3. WHEN a workload runs THEN the system SHALL execute it with the selected version's `bin` directory first on `PATH` and record wall-clock duration in milliseconds and peak RSS in bytes for the spawned process tree.
4. WHEN a workload completes all repetitions THEN the system SHALL record the median, min and max of its timed repetitions, excluding the discarded warm-up.
5. IF the 1-minute load average exceeds a per-core limit and `--allow-noisy` was not passed THEN the system SHALL abort before running any workload with a message naming the observed load average, the core count and the resulting limit.
6. IF the selected workloads include one that requires the database and the Postgres container is not reachable THEN the system SHALL abort before running any workload with a message naming the `docker compose up db` remedy.
7. IF a workload exits non-zero THEN the system SHALL record a `compat` finding containing the version, workload id, exit code and the last 20 lines of stderr, and SHALL continue with the remaining workloads.
8. WHEN the matrix finishes THEN the system SHALL write one JSON file to `docs/benchmarks/bun-1-4/` containing every sample, the per-workload aggregates, the compat findings and the host metadata (host, CPU model, core count, total memory, load average, power source, ISO timestamp).
9. The system SHALL accept `--only=<workload-ids>` to run a subset of the matrix and `--versions=<versions>` to run a subset of the versions.

**Independent Test**: Run `bun run bench --only=lint` with both binaries installed and observe a JSON file containing 5 timed `lint` samples per version plus host metadata.

---

### P1: Toolchain workload coverage ⭐ MVP

**User Story**: As the blog maintainer, I want each pipeline step measured individually so that I can tell which part of my day actually got faster.

**Why P1**: A single aggregate number cannot be attributed to a cause and is useless in a case study.

**Acceptance Criteria**:

1. The system SHALL define the workloads `install-cold`, `install-warm`, `build`, `test`, `test-e2e`, `lint`, `check`, `sync` and `audit-fe`, each with a stable string id used in every output file.
2. WHEN `install-cold` runs THEN the system SHALL remove `node_modules` and the selected version's install cache before each repetition so that the measurement excludes any warm cache.
3. WHEN `install-warm` runs THEN the system SHALL remove `node_modules` but preserve the install cache before each repetition.
4. WHEN any workload that consumes `node_modules` runs THEN the system SHALL ensure dependencies were installed by the same Bun version being measured.
5. WHEN `build` runs THEN the system SHALL delete `.output` and `node_modules/.vite` before each repetition so that no build cache crosses repetitions.
6. WHEN `test-e2e` runs THEN the system SHALL record the Playwright suite's pass/fail counts alongside the timing so that a version difference in outcome is visible, not just a difference in speed.
7. The system SHALL exclude `install-cold` and `install-warm` from the reported total pipeline time and report them as separate line items, because they do not run on every pipeline invocation.
8. WHERE a workload requires the production bundle to exist, the system SHALL run `build` for that version first and SHALL exclude that preparatory build from the measured samples.

**Independent Test**: Run the matrix with `--only=install-warm,build` and confirm the JSON contains distinct samples for each and that `build` was preceded by a fresh `.output` deletion.

---

### P1: Real-blog runtime measurement ⭐ MVP

**User Story**: As the blog maintainer, I want the running blog's memory footprint and response times measured under both versions so that I know whether the upgrade helps readers and not just my laptop.

**Why P1**: The user asked explicitly for the real blog's memory usage and response time; it is the part of the story that affects production, not developer ergonomics.

**Acceptance Criteria**:

1. WHEN the runtime workload runs THEN the system SHALL boot `.output/server/index.mjs` under the selected Bun version and SHALL record the elapsed milliseconds from spawn until the server answers its first successful HTTP request.
2. WHEN the server has booted and before any load is applied THEN the system SHALL record idle RSS in bytes after a 3-second settle period.
3. WHEN the load phase runs THEN the system SHALL issue requests to `/`, `/blog`, one English post route and one `pt-br` post route at a fixed concurrency of 20 for a fixed duration of 30 seconds, using the identical generator for both versions.
4. WHEN the load phase completes THEN the system SHALL record p50, p95 and p99 response times in milliseconds, the total request count, and the count of non-2xx responses.
5. WHEN the load phase completes THEN the system SHALL record peak RSS observed during load and RSS 10 seconds after load stops.
6. IF any request returns a non-2xx status THEN the system SHALL include the status code and route in the result file rather than discarding the sample.
7. WHEN the runtime workload ends THEN the system SHALL terminate the spawned server process and SHALL verify that the port is free before the next version's run begins.
8. The system SHALL apply identical environment variables and the same database state to both versions' runtime runs.

**Independent Test**: Run `bun run bench --only=runtime --versions=1.4.0` and confirm the JSON reports boot time, idle RSS, peak RSS, post-load RSS and the p50/p95/p99 latency triple.

---

### P2: Human-readable comparison report

**User Story**: As the blog maintainer, I want the raw JSON rendered into a readable comparison so that I can see the deltas without parsing numbers by hand.

**Why P2**: Valuable, but the JSON is the source of truth and the post could be written from it directly if needed.

**Acceptance Criteria**:

1. WHEN the report generator runs against a result JSON THEN the system SHALL write `docs/benchmarks/bun-1-4/REPORT.md` containing one row per workload with the 1.3.14 median, the 1.4.0 median, the absolute delta and the percentage delta.
2. WHEN a percentage delta is rendered THEN the system SHALL mark deltas whose magnitude falls within the run's own observed noise band — the wider of the two versions' min-to-max spreads — as `within noise` rather than reporting them as an improvement or a regression.
3. WHEN compat findings exist THEN the system SHALL render them as a dedicated section naming the workload, version and exit code.
4. IF the result JSON contains only one version THEN the system SHALL render the single-version table and SHALL state that no comparison is available.

**Independent Test**: Feed the generator a fixture JSON with a known 2× delta and confirm the rendered row reports `-50%`.

---

### P2: Migrate the repository to Bun 1.4.0

**User Story**: As the blog maintainer, I want CI and the production image pinned to an explicit 1.4.0 so that the measured configuration is the one that actually ships.

**Why P2**: The measurement is the deliverable; the pin bump is the consequence and must not land before the evidence.

**Acceptance Criteria**:

1. WHEN the migration lands THEN the system SHALL pin `bun-version` to `1.4.0` in `ci.yml`, `app-audit.yml` and `content-audit.yml`.
2. WHEN the migration lands THEN the `Dockerfile` SHALL reference an explicit `oven/bun:1.4.0` tag in the `dev` stage and an explicit `oven/bun:1.4.0-alpine` tag in the `runner` stage instead of the floating major tag.
3. WHEN the migration lands THEN `package.json` SHALL declare the supported runtime range via an `engines` field naming `bun >=1.4.0`.
4. IF any measured workload produced a `compat` finding under 1.4.0 THEN the system SHALL NOT land the pin bump until that finding is resolved or explicitly recorded as accepted in the spec's Assumptions table.
5. WHEN the migration lands THEN the full existing quality gate — `make test`, `make lint`, `make check`, `make build-js`, `make test-e2e`, `make lint-tests` — SHALL pass on the 1.4.0 pins.

**Independent Test**: Grep the three workflows and the Dockerfile for `1.4.0` and run the full gate locally.

---

### P2: Performance case study post

**User Story**: As a reader, I want a post that shows what upgrading Bun actually did to a real small production app so that I can decide whether it is worth my own upgrade.

**Why P2**: It depends on the measurement run, which is deliberately deferred; it cannot be completed in the same sitting as the harness.

**Acceptance Criteria**:

1. The post SHALL exist as `app/content/posts/en/<slug>.mdx` and `app/content/posts/pt-br/<slug>.mdx` sharing one English-canonical slug.
2. The post SHALL state the measurement methodology explicitly: the two versions compared, repetition count, statistic reported, hardware, and the fact that the run is single-machine and not a controlled benchmark environment.
3. The post SHALL cite only numeric values that are present in the committed result JSON.
4. WHERE a measured delta falls within the run's noise band, the post SHALL report it as no measurable change rather than as an improvement.
5. WHERE a Bun 1.4 marketing claim was measured and not reproduced on this repository, the post SHALL say so explicitly.
6. WHEN the post is finished THEN `bun run audit:content` SHALL report zero `blocker` and zero `major` findings attributable to it.
7. The post SHALL declare its frontmatter `title`, `description`, `publishedAt`, `category` and `series` fields consistently across both locales.

**Independent Test**: Cross-check every number in the rendered post against the committed JSON, then run `bun run audit:content`.

---

### P3: Re-run reproducibility

**User Story**: As a future maintainer, I want to re-run this benchmark against a later Bun release so that the comparison stays alive instead of aging into a one-off.

**Acceptance Criteria**:

1. The system SHALL read the compared versions from a single declared constant or config value so that adding a version does not require editing workload code.
2. WHEN a new result JSON is written THEN the system SHALL name it with an ISO timestamp and SHALL NOT overwrite any existing result file, including one written earlier the same day.

---

## Edge Cases

- IF a Bun version fails to install into `.bench/` THEN the harness SHALL exit non-zero with the installer's stderr rather than silently falling back to the global `bun`.
- IF the runtime workload's port is already bound THEN the harness SHALL abort with the port number and the owning PID rather than measuring someone else's server.
- IF `docker compose` is unavailable on the machine THEN the harness SHALL abort with a message distinguishing "Docker not installed" from "database container not running".
- IF a workload exceeds a 15-minute per-repetition timeout THEN the harness SHALL kill the process tree, record a `timeout` finding and continue.
- WHEN `install-cold` removes the install cache THEN the harness SHALL only remove the cache directory belonging to the version under `.bench/`, never the developer's global `~/.bun/install/cache`.
- IF the harness is interrupted mid-matrix THEN it SHALL leave any partial results written so far on disk and SHALL restore `node_modules` to a usable state by running a final install with the developer's default Bun version.
- WHEN the `pt-br` post route selected for the runtime workload does not exist THEN the harness SHALL abort during preflight rather than measuring a 404 path.

---

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| -------------- | ----- | ----- | ------ |
| BENCH-01 | P1: Version-matrix harness | Done   | Verified |
| BENCH-02 | P1: Version-matrix harness | Done   | Verified |
| BENCH-03 | P1: Version-matrix harness | Done   | Verified |
| BENCH-04 | P1: Version-matrix harness | Done   | Verified |
| BENCH-05 | P1: Version-matrix harness | Done   | Verified |
| BENCH-06 | P1: Toolchain workloads | Done   | Verified |
| BENCH-07 | P1: Toolchain workloads | Done   | Verified |
| BENCH-08 | P1: Toolchain workloads | Done   | Verified |
| BENCH-09 | P1: Runtime measurement | Done   | Verified |
| BENCH-10 | P1: Runtime measurement | Done   | Verified |
| BENCH-11 | P1: Runtime measurement | Done   | Verified |
| BENCH-12 | P2: Comparison report | Done   | Verified |
| BENCH-13 | P2: Migration to 1.4.0 | Blocked| Pending run |
| BENCH-14 | P2: Case study post | Blocked| Pending run |
| BENCH-15 | P3: Re-run reproducibility | Done   | Verified |

**Coverage:** 15 total, 15 mapped to tasks. 13 verified; BENCH-13 and BENCH-14 blocked on the operator's benchmark run.

---

## Success Criteria

- [ ] `bun run bench` completes a full two-version matrix on a quiet machine and writes one JSON result file plus `REPORT.md`.
- [ ] Every workload in the matrix has at least 5 timed samples per version, or a recorded `compat`/`timeout` finding explaining why not.
- [ ] Boot time, idle RSS, peak RSS and p50/p95/p99 latency are reported for the real production bundle under both versions.
- [ ] CI and Docker pins name `1.4.0` explicitly and the full quality gate passes on them.
- [ ] The post ships in `en` and `pt-br` with every number traceable to the committed result JSON and zero blocker/major `audit:content` findings.
