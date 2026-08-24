# Bun Test revalidation — agent handoff

> Final snapshot: 2026-08-24. The complete 1/2/4-worker and `--smol` matrix
> passed independent validation. Read the current Git status and newer commits
> before changing defaults or CI.

## Mission

Determine whether the Blog should replace Bun-hosted Vitest with native Bun
Test after giving both runners a fair, documentation-aligned configuration.
Preserve behavior, prioritize the maintainer's multi-worktree workflow, and
change neither the default runner nor CI until independent validation passes.

## Repository state

- Branch: `test/bun-test-revalidation`.
- Base: `origin/main` at `3849f93`.
- Current default: `test` delegates to Bun 1.4 + Vitest 4.1.5.
- Current E2E: Playwright through Bun, Node fallback retained.
- CI: unchanged by this experiment.
- Candidate tree: `app/tests-bun/`.
- Canonical tree: `app/tests/`.
- Feature artifacts: `.specs/features/bun-test-revalidation/`.
- Evidence: `docs/benchmarks/bun-test-revalidation/`.
- Independent validation iteration 2: PASS; see
  `.specs/features/bun-test-revalidation/validation.md`.

## Current status

Completed:

1. Official Bun 1.4 test documentation audited.
2. Independent Vitest-first and Bun-first suites created.
3. 113 product files mirrored one-to-one.
4. Bun candidate compatibility run: 2,057 pass, 101 environmental skips,
   zero failures.
5. Static/runtime parity gate implemented.
6. Pure, DOM, mocks/timers, and integration/infra cohorts screened.
7. Controlled 1/2/4-worker, `--no-isolate`, and `--smol` profiles added.
8. Warm-up-aware, interleaved, process-tree-RSS benchmark implemented.
9. External-load sensors and two shared machine locks implemented.
10. One isolated-1 comparison completed with five valid samples per arm.

Finalized:

1. Full decision-quality isolated-1/2/4 and `--smol`-2 matrix.
2. All 113 product files remain represented in every valid arm.
3. Fully skipped DB file semantics are normalized instead of excluding files.
4. STATE and testing rules agree with the opt-in candidate state.
5. Sol-medium validation iteration 2 returned PASS.

Queued after Bun Test validation:

1. Revalidate Node + Playwright versus Bun + Playwright with the same benchmark
   discipline and workers 1/2.
2. Restore a local Bun.WebView smoke harness and retest only the equivalent
   five-route subset. Keep it out of CI/defaults.

## Final matrix

Every arm has one discarded warm-up, five valid interleaved samples, 113
product files, 2,057 passes, 84 normalized environmental skips, and zero
failures/todos.

| Profile | Vitest median / peak RSS | Bun median / peak RSS | Bun result | Bun RSS×time |
| --- | ---: | ---: | ---: | ---: |
| isolated-1 | 55.549 s / 2,278.6 MiB | 38.271 s / 2,777.5 MiB | **31.10% faster**, 21.90% more RSS | **16.02% lower** |
| isolated-2 | 33.080 s / 2,751.9 MiB | 25.922 s / 2,841.1 MiB | **21.64% faster**, 3.24% more RSS | **19.10% lower** |
| isolated-4 | 20.433 s / 3,394.8 MiB | 21.318 s / 3,031.2 MiB | 4.33% slower, **10.71% less RSS** | **6.84% lower** |
| `--smol`-2 | 38.190 s / 2,631.5 MiB | 32.916 s / 2,728.3 MiB | **13.81% faster**, 3.68% more RSS | **10.64% lower** |

Interpretation:

- Bun wins elapsed time and time-to-release.
- Vitest wins peak memory.
- Bun wins the approximate memory-occupancy product.
- For queued worktrees, shorter occupancy may outweigh the higher peak.
- For simultaneous uncoordinated worktrees, Bun's higher peak remains a risk.
- Isolated-2 is the strongest throughput/peak-RSS compromise in this matrix.
- The validated project decision still keeps Vitest as default because the
  second independent tree has maintenance cost and the result is profile-dependent.

Raw evidence is linked from
`docs/benchmarks/bun-test-revalidation/matrix-2026-08-24.md` and
`docs/benchmarks/bun-test-revalidation/README.md`.

## Why the original comparison was unfair

The retired benchmark compared:

- Vitest with its default file parallelism;
- Bun Test with `--isolate` but without `--parallel`.

Additional gaps:

- one repetition by default;
- no discarded warm-up;
- cohort commands used different isolation semantics from the full suite;
- `TZ` was not explicitly equalized;
- Vitest and Bun timeout semantics differed;
- inventory/skips diverged;
- parity did not prove hooks or leaf identities;
- RSS evidence did not reliably cover the whole worker tree.

The old signal that Bun Test took roughly twice as long was therefore not a
measurement of each runner's best safe configuration.

## Vitest-to-Bun-Test changes

### 1. Independent runner-first trees

- Vitest-first: `app/tests/`.
- Bun-first: `app/tests-bun/`.
- 113 product files have Bun twins.
- Vitest-only benchmark/CI/runtime tests use explicit dispositions.
- Product assertions cannot be removed to make Bun pass.

### 2. Runner imports and functions

Typical conversion:

```ts
// Vitest
import { describe, expect, it, vi } from "vitest";

// Bun Test
import { describe, expect, jest, mock, spyOn, test } from "bun:test";
```

Conversions include:

- `vi.fn()` to `mock()` or `jest.fn()`;
- `vi.spyOn()` to `spyOn()`;
- `vi.mock()` to `mock.module()`;
- Vitest clear/reset/restore calls to Bun/Jest-compatible calls;
- `toHaveBeenCalledOnce()` to `toHaveBeenCalledTimes(1)`;
- unsupported/undocumented matcher variants normalized where needed.

### 3. Module mock ordering

Vitest hoists `vi.mock()` differently. Bun uses `mock.module()`. Modules whose
real side effects must not run are dynamically imported after registering the
mock:

```ts
mock.module("#/lib/dependency", () => ({
  dependency: mock(() => value),
}));

const { subject } = await import("#/lib/subject");
```

The audit found 149 dynamic imports in 69 candidate files. Partial mock exports
are part of the parity inventory.

### 4. Spies and global cleanup

The historical candidate leaked some `console.log`, `console.warn`, and
`console.error` spies. Candidate hooks now restore spies, mock implementations,
call history, timers, system time, environment changes, and altered globals.

### 5. Fake timers and microtasks

Vitest's `advanceTimersByTimeAsync()` does not map perfectly to synchronous
Jest-compatible timer advancement. Candidate tests use Bun's documented fake
timer APIs, explicit microtask flushing where required, real-timer restoration,
and system-time reset.

### 6. DOM environment

Vitest retains jsdom. Bun Test uses `@happy-dom/global-registrator` only in
DOM-bearing files through an explicit `./happydom` import.

The scoped helper:

- registers `window` and `document`;
- preserves Bun-native `Request`, `Response`, and `Headers`;
- supplies the required `ResizeObserver` and `matchMedia` shims;
- calls React Testing Library cleanup;
- clears body, head, local/session storage, URL, and globals after tests.

A global preload is intentionally avoided because it changes server-side web
API semantics. The DOM cohort currently has 30 files and 556 passing tests.

### 7. Lifecycle and external resources

The parity/audit covers `beforeAll`, `beforeEach`, `afterEach`, and `afterAll`.
Tests that touch PGLite/PostgreSQL, filesystem, ports, Docker, subprocesses,
watchers, environment variables, or timers own deterministic cleanup.

### 8. Timeout semantics

Vitest distinguishes test and hook timeouts. A single Bun CLI timeout is not
treated as equivalent. Long candidate tests/hooks use scoped budgets; the
benchmark watchdog is a separate process-safety timeout.

### 9. Discovery

`bunfig.toml` points Bun Test at `app/tests-bun`, preventing accidental
discovery of the Vitest tree.

### 10. Controlled profiles

Package routes cover:

- Vitest on Bun with 1/2/4 workers;
- Bun Test isolated serial, `--parallel=2`, and `--parallel=4`;
- experimental Bun `--parallel --no-isolate`;
- memory-oriented Bun `--smol`.

All controlled routes fix `TZ=UTC` and report runtime provenance.

### 11. `--no-isolate` safety result

| Cohort | Result |
| --- | --- |
| Pure | passed normal/reversed/randomized probes |
| DOM | failed due to leaked document body/state |
| Mocks/timers | failed due to shared module/global state |
| Integration/infra | failed due to contention/shared resources |

The full suite must not use `--no-isolate`.

### 12. Stronger parity

The gate compares:

- relative files;
- leaf test identities;
- assertion counts;
- fixture references;
- lifecycle hooks;
- mock modules/exports;
- residual Vitest APIs;
- DOM environment requirements;
- pass/fail/skip/todo outcomes;
- explicit Vitest-only dispositions.

Any mismatch invalidates performance conclusions.

### 13. Controlled benchmark

The harness:

- retains and discards warm-ups;
- interleaves/reverses arm order;
- requires at least five valid samples per arm;
- replenishes contaminated samples with a bounded attempt cap;
- records wall time and process-tree RSS at 100 ms intervals;
- records runtime, runner, versions, command, workers, isolation, commit, host,
  load, files, tests, skips, failures, and exclusion reasons;
- writes non-overwriting JSON and Markdown;
- preserves invalid/contaminated runs;
- uses shared locks for CRM Playwright and Antclips tests.

## Cohort screening

Current static classification:

| Cohort | Files |
| --- | ---: |
| Pure | 9 |
| DOM | 11 |
| Mocks/timers | 22 |
| Integration/infra | 71 |

See `docs/benchmarks/bun-test-revalidation/cohort-screening.md` and its linked
JSON artifacts.

## Independent verifier findings

The first Sol-medium verifier returned FAIL. Blockers were:

1. T7 promoted isolated-1/2/4 and `--smol`, but T8 measured isolated-1 only.
2. The first T8 command excluded `auth-integ`, `indexer-integ`, and
   `sync-integ` instead of preserving all 113 product files.
3. `.specs/STATE.md` and `.agents/rules/testing.md` still described the old
   retired state.
4. The full Vitest gate inherited an unavailable PostgreSQL URL.

Remediation commits `ed5f26d`, `ac12830`, `3d66dcc`, `9d022e7`, and `be377cb`
closed these blockers. Validation iteration 2 in commit `1b027d5` returned PASS.

## Important commits

| Commit | Purpose |
| --- | --- |
| `615da7d` | TLC spec, context, design, and tasks |
| `03552da` | Restore Bun-first suite |
| `beaf546` | Scope Happy DOM environment |
| `4988f00` | Align candidate Bun semantics |
| `eb5b7e7` | Outcome-aware parity gate |
| `6f5351b` | Controlled runner profiles |
| `6d6863e` | Benchmark harness |
| `0ba6130` | Cohort screening |
| `26b1c54` | Replenish contaminated samples |
| `be8cc9f` | Ignore idle lock waiters in contamination sensor |
| `22c0ab7` | First isolated-1 valid evidence |
| `94595ef` | Narrow conservative decision |
| `f88613a` | Preserve first verifier FAIL |
| `ed5f26d` | Normalize full matrix and database skips |
| `ac12830` | Aggregate parallel worker memory |
| `3d66dcc` | Record complete finalist matrix |
| `9d022e7` | Record final revalidation decision |
| `be377cb` | Sanitize local database gate environment |
| `1b027d5` | Independent validation iteration 2 PASS |

Read newer commits before assuming this list is current.

## Next-agent execution

1. Read `.specs/features/bun-test-revalidation/{spec,context,design,tasks,validation}.md`.
2. Read this handoff, then inspect newer commits and raw run artifacts.
3. Treat the complete matrix and validation PASS as the current evidence.
4. Keep `test`, CI, Playwright, and Bun.WebView defaults unchanged until the
   maintainer explicitly approves a separate cutover.
5. The next approved experiment is Playwright Node/Bun workers 1/2 followed by
   a local-only equivalent Bun.WebView smoke revalidation.

Completion criterion for any cutover: make a separate explicit decision that
accounts for the maintenance cost of the second suite and the profile-dependent
time/peak-RSS trade-off.
