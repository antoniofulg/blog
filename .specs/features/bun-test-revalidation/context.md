# Bun Test Revalidation Context

## External Systems and Documentation

| Dependency | Relevant behavior | Experiment response |
| --- | --- | --- |
| Bun 1.4 Test Runner | Shared global by default; `--parallel=N` implies file isolation; `--parallel --no-isolate` reuses globals/module registries per worker | Treat isolated parallel as the correctness/throughput profile and no-isolate as an opt-in experiment. |
| Bun lifecycle and mocks | Preloads run before files; module mocks can update imports but cannot undo already-run side effects | Keep mocks native and audit registration timing; avoid one global mock preload for unrelated files. |
| Bun DOM guidance | Recommends Happy DOM via preload and RTL cleanup | Scope Happy DOM to DOM-bearing tests because server tests require Bun-native web APIs. |
| Bun runtime | Tests use UTC by default and support `--smol`, fake time, environment files and conditions | Pin `TZ=UTC`; reset fake time; measure `--smol` separately. |
| Vitest 4.1.5 under Bun | Uses default file parallelism unless worker count is bounded | Match worker counts for controlled profiles and preserve current default as an operational reference. |
| PGLite/Postgres/filesystem/subprocesses | Some tests use expensive or shared resources | Classify integration files and keep unsafe resources serialized or worker-scoped. |

Official sources reviewed:

- <https://bun.com/docs/test>
- <https://bun.com/docs/test/writing-tests>
- <https://bun.com/docs/test/configuration>
- <https://bun.com/docs/test/runtime-behavior>
- <https://bun.com/docs/test/discovery>
- <https://bun.com/docs/test/parallel>
- <https://bun.com/docs/test/lifecycle>
- <https://bun.com/docs/test/mocks>
- <https://bun.com/docs/test/snapshots>
- <https://bun.com/docs/test/dates-times>
- <https://bun.com/docs/test/dom>
- <https://bun.com/docs/test/code-coverage>
- <https://bun.com/docs/test/reporters>
- <https://bun.com/blog/bun-v1.4>

Context7 was attempted first as required by project policy, but its monthly
quota was exhausted. The audit therefore used Bun's official documentation.

## Historical Evidence

The retired candidate at commit `711f18d` contains 145 files under
`app/tests-bun/`. It is useful compatibility work, not valid benchmark proof.

Known historical methodology differences:

- Vitest had no `maxWorkers` setting and used its default file parallelism.
- Bun Test used `bun test --timeout 60000 app/tests-bun --isolate`, which was
  isolated but serial.
- Full-suite inventory/skip outcomes differed.
- Cohort execution omitted `--isolate`, so cohort and full-suite semantics
  differed.
- No warm-up was discarded and the harness defaulted to one repetition.
- `TZ` was not explicitly equalized.
- Vitest separated 30-second test and 60-second hook timeouts; Bun used one
  60-second CLI timeout.
- Peak-memory evidence was inconclusive and must aggregate worker children.

Static candidate inventory:

| Cohort | Approximate files | Main risk |
| --- | ---: | --- |
| Integration/infra | 87 | PGLite, Postgres, filesystem, Docker, subprocesses, ports, environment |
| Mocks/timers | 26 | Module cache, live bindings, fake time, globals |
| DOM pure | 12 | Happy DOM/RTL cleanup and import graph |
| Pure | 16 | Lowest state risk; suitable for no-isolate probe |
| Files importing Happy DOM | 31 | Per-file registration and React/RTL module evaluation |

The categories can overlap. Classification must be regenerated and committed
by the new tooling instead of treating these approximate counts as final.

## Concurrency and Ordering

The benchmark harness runs arms sequentially. Repetitions rotate/reverse arm
order so the same runner does not always inherit a hotter cache or lower load.
No Playwright or other test suite may execute concurrently.

Candidate profiles:

| Profile | Vitest | Bun Test | Purpose |
| --- | --- | --- | --- |
| parity-1 | `--maxWorkers=1` | `--isolate` | Conservative correctness and memory baseline |
| isolated-2 | `--maxWorkers=2` | `--parallel=2` | Bounded throughput |
| isolated-4 | `--maxWorkers=4` | `--parallel=4` | Higher throughput, subject to memory/contention |
| shared-N | N/A | `--parallel=N --no-isolate` | Bun-specific fast path after leak/order validation |
| smol-N | N/A | approved profile plus `--smol` | Memory-first alternative |
| operational | current Vitest defaults and `test:local` | best valid Bun profile | Real local comparison, labeled separately from matched profiles |

The matrix may drop clearly dominated/invalid profiles after representative
cohort screening. Finalists alone receive the long full-suite benchmark.

## Ambiguity and Decision Thresholds

No universal percentage proves a winner. The report must show raw medians,
spread, compatibility, and maintenance burden. For recommendation purposes:

- any inventory/outcome mismatch is disqualifying;
- repeated state/resource failures are disqualifying for that profile;
- a memory improvement below measurement noise is not material;
- a speed gain that materially increases peak memory is not preferred for the
  maintainer's multi-worktree local workflow;
- a hybrid runner recommendation must justify ongoing duplication cost;
- CI changes remain a later decision even if local evidence favors Bun Test.

## Data Lifecycle and Safety

- Timestamped raw JSON and Markdown reports are append-only.
- Temporary timing/order files live outside committed test roots until selected
  evidence is copied into the report directory.
- Secrets and environment values are never captured; only variable names and
  sanitized provenance are recorded.
- Benchmark subprocesses receive timeouts and are terminated before the next arm.
- Application code is not changed solely to make a runner pass.

