# Bun 1.4 Benchmark — Validation Report

**Result**: PASS for the delivered scope (P1 stories plus the P2 report). The harness is
built, tested and committed. Two P2 stories — the version pins and the post —
remain deliberately unstarted because both depend on measurements that have not
been taken yet.

**Diff range**: `bfcc088..HEAD` on `feat/bun-1-4-benchmark` (19 commits, T1–T16,
T19–T20).

**Independence note**: this validation was run as a standalone fresh-eyes pass
rather than by a separate Verifier agent, because agent delegation is disabled
in this session. That is the documented fallback, and it is a genuine weakening
of the author-≠-verifier separation: the coverage judgement below comes from the
same author who wrote the code. The discrimination sensor is the part that does
not depend on that judgement, which is why its result carries the most weight
here.

---

## Scope delivered

| Story | Requirement IDs | State |
| ----- | --------------- | ----- |
| P1: Version-matrix harness | BENCH-01..05 | Verified |
| P1: Toolchain workload coverage | BENCH-06..08 | Verified |
| P1: Real-blog runtime measurement | BENCH-09..11 | Verified |
| P2: Human-readable comparison report | BENCH-12 | Verified |
| P2: Migrate the repository to 1.4.0 | BENCH-13 | Not started — blocked on the run |
| P2: Performance case study post | BENCH-14 | Not started — blocked on the run |
| P3: Re-run reproducibility | BENCH-15 | Verified |

BENCH-13 and BENCH-14 are blocked by design, not by omission. The user chose to
defer the measurement run because the machine hosts several active worktrees.

---

## Discrimination sensor

18 behaviour-level mutations injected one at a time into the real modules, each
followed by the tests that should catch it, each restored afterwards. The
working tree was verified clean (`git status --porcelain` empty) after the run.

**Result: 18/18 mutants killed.**

The sensor itself had to be fixed twice before its result could be trusted:

1. The first version used single-line string replacements against source that
   Biome had wrapped across several lines. Non-matching patterns silently
   applied nothing, and a passing suite was reported as a surviving mutant. The
   rewrite aborts when a mutation does not change the file, so a sensor bug can
   no longer be misread as a coverage gap.
2. On the first honest run, one mutant survived: removing the wait-for-exit
   escalation in `measureRuntime`. See the findings below.

Mutations covered: the delta verdict, median vs min, percentile rank direction,
the noise band direction, warm-up discarding, finding suppression, prepare-path
redirection to the global cache, RSS tree summing, cache-dir redirection, PATH
prepending, the load-average gate, the toolchain version match, the conditional
DB check, findings rendering, non-2xx discarding, runtime selection, result-file
date stamping, and server shutdown escalation.

---

## Findings raised and resolved during validation

### 1. A stale server could answer the next version's boot probe — fixed (T19)

Two consecutive `measureRuntime` calls reported a boot-time gap of 178 ms where
the stub's own configured delay was 800 ms. The second probe was answered by the
first call's server, still listening.

Root cause: `portOwner` caught every `lsof` failure and returned `null`, which
the caller read as "the port is free". `measureRuntime` sent `SIGTERM` and then
trusted that poll instead of waiting for the process to exit.

Consequence had it shipped: on a real run the second version's runtime numbers
could have described the first version's process. Boot time, memory and latency
would all have been wrong, and nothing in the output would have shown it.

Fix: `measureRuntime` awaits the child's `close` event, escalating to `SIGKILL`
after a 5-second grace period; `portOwner` treats only `lsof` exit code 1 as "no
listener" and throws on any other failure.

### 2. The fix for finding 1 was not deterministically tested — fixed (T20)

The sensor proved it: removing the escalation left the whole suite green on an
idle machine, because `lsof` polling happens to report the port free in time.
The guard was real but unprotected.

Fix: the stub server now honours `STUB_IGNORE_SIGTERM=1` by installing a no-op
`SIGTERM` handler. A test asserts the port has no owner after `measureRuntime`
returns against that stub, which fails deterministically whenever the escalation
is removed.

### 3. Vitest's 5-second default timeout was too small for spawn-driven tests

A boot–settle–load–cooldown cycle exceeds five seconds. Explicit per-test
timeouts (30 s, 60 s for the two-boot comparison, 45 s for the never-boots case)
replaced the default. No assertion was weakened; only the time budget changed.

---

## Environmental note, not a code finding

The full suite was observed failing non-deterministically during this work — 5
test files in one run, 3 in another, always the PGLite-backed ones
(`drizzle-schema`, `pglite-extended-query`, `tz-migration-integ`,
`e2e-harness`). Every one of them passed when run in isolation. The machine sat
at a 1-minute load average of 28.01 at the time, with several worktrees active.

This is contention, not a regression introduced here, and it is exactly the
condition the harness's `LOAD_AVG_LIMIT = 2.0` preflight gate exists to refuse.
It is recorded in the run playbook as a warning to the operator.

---

## Spec-anchored coverage

Every acceptance criterion for the delivered stories maps to at least one
assertion. Selected evidence, one row per criterion group:

| Spec AC | Evidence (`file:line`) | Spec outcome asserted |
| ------- | ---------------------- | --------------------- |
| P1.1 AC2 — toolchain version match, install hint | `app/tests/bench-preflight.test.ts:59`, `:69` | reason contains `bash -s "bun-v1.3.14"`; `reports 1.3.9, expected 1.3.14` |
| P1.1 AC3 — wall time and peak RSS of the process tree | `app/tests/bench-runner.test.ts:12`, `:20`, `:37` | duration > 350 ms for a 0.4 s sleep; heavy > 150 MB; descendant counted |
| P1.1 AC4 — median/min/max over timed reps, warm-up excluded | `app/tests/bench-matrix.test.ts:88`, `:95` | 4 spawns for 3 reps; median 20 from `[9999,10,20,30]` |
| P1.1 AC5 — load-average abort | `app/tests/bench-preflight.test.ts:78`, `:85`, `:93` | reason contains `28.01` and `--allow-noisy`; limit value itself passes |
| P1.1 AC6 — DB abort only when needed | `app/tests/bench-preflight.test.ts:101`, `:109` | no Docker check without `needsDb`; two distinct messages |
| P1.1 AC7 — compat finding, matrix continues | `app/tests/bench-matrix.test.ts:103`, `:188` | `kind: "compat"`, `exitCode: 2`, `stderrTail: "boom"`; next workload still yields 3 samples |
| P1.1 AC8 — host provenance in the result | `app/tests/bench-host.test.ts:5`, `:13`, `:19`, `:32` | non-empty host and CPU model; load average numeric; ISO timestamp parses; power source in the union |
| P1.1 AC9 — `--only` / `--versions` | `app/tests/bench-cli.test.ts:20`, `:34` | lists split and trimmed |
| P1.2 AC1..AC8 — workload registry shape | `app/tests/bench-workloads.test.ts:15` onward | exact id list; prepare lists; `--frozen-lockfile`; `needsDb`/`needsBundle` sets; Playwright counts |
| P1.2 AC8 — preparatory build excluded from samples | `app/tests/bench-matrix.test.ts:122` | first spawn is `bun run build`; 5 spawns total; 3 samples |
| P1.3 AC1 — boot time from spawn to first response | `app/tests/bench-runtime.test.ts:24` | delayed boot exceeds the fast one by > 500 ms and itself exceeds 700 ms |
| P1.3 AC2, AC5 — the three RSS phases | `app/tests/bench-runtime.test.ts:41`, `:48` | idle > 0; peak ≥ idle; peak > idle under allocating load |
| P1.3 AC3, AC4 — load shape and percentiles | `app/tests/bench-load.test.ts:36`, `:47`, `:60` | all four routes hit; duration-bounded; p50 ≤ p95 ≤ p99 |
| P1.3 AC6 — non-2xx recorded, not discarded | `app/tests/bench-load.test.ts:80`, `:94` | `/boom` recorded with status 500; failures counted inside the total |
| P1.3 AC7 — port free before the next version | `app/tests/bench-runtime.test.ts:67`, `:72`, `:83` | `portOwner(PORT)` null after return, including against a SIGTERM-ignoring server and a never-booting one |
| P2.1 AC1..AC4 — report rendering | `app/tests/bench-reporter.test.ts:56`, `:74`, `:97`, `:121`, `:139` | exact row string; `within noise`; `no comparison is available`; finding rows |
| P3 AC1, AC2 — reproducibility | `app/tests/bench-versions.test.ts:14`, `app/tests/bench-cli.test.ts:86` | single declared version list; date-stamped, non-colliding result path |
| Edge — prepare never reaches `~/.bun` | `app/tests/bench-matrix.test.ts:58`, `:71` | no prepare path contains the global bun dir; each resolves to a named repo or `.bench` path |
| Edge — interrupted run keeps data | `app/tests/bench-matrix.test.ts:173`, `:206` | sink called after each workload; restore uses the passed default binary |

Two criteria are covered by construction rather than by a unit assertion, and
are named here rather than claimed as tested:

- **The 15-minute per-repetition timeout** is exercised at 700 ms in
  `app/tests/bench-runner.test.ts:51`; the production constant itself is not
  asserted.
- **The `SIGINT` handler in `scripts/bench.ts`** is not unit-tested. The entry
  point is a thin wrapper by design, and the behaviour it delegates to
  (`restoreNodeModules`, the partial-result sink) is tested at
  `app/tests/bench-matrix.test.ts:173` and `:206`.

---

## What this validation does not cover

The harness has never produced a real measurement. Everything above proves it
behaves correctly against stubs and short-lived real processes; nothing proves
that a full two-version matrix over the actual pipeline completes, nor how long
it takes, nor whether any workload is incompatible with either Bun version.

That is the operator's run, and it is the entry condition for T17 and T18.
