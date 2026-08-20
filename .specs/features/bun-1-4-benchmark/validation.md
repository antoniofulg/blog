# Bun 1.4 Benchmark — Validation Report

**Result**: PASS for the delivered scope (P1 stories plus the P2 report). The harness is
built, tested and committed. Two P2 stories — the version pins and the post —
remain deliberately unstarted because both depend on measurements that have not
been taken yet.

**Diff range**: `bfcc088..HEAD` on `feat/bun-1-4-benchmark` (26 commits, T1–T16,
T19–T25).

**Full suite**: 121 files passed, 3 skipped, 2176 tests passed, 0 failed. The
PGLite files that failed intermittently earlier in this work passed here too;
their failures were `Hook timed out in 10000ms` inside `createTestDb()` under
machine load, they pass in isolation, and they failed the same way on the
baseline before any code here was written.

**This report was revised.** Its first version credited the runtime-test
failures to machine contention and filed that as an environmental note rather
than a finding. That was wrong, and the correction is recorded as finding 4.

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

**Result: 18/18 mutants killed**, plus five later guards (T21, T23-T25) verified
by separate mutation runs. Two of those five survived their first attempt and
were killed only after the corresponding test was strengthened.

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

### 4. The harness measured a server it did not start — fixed (T21)

Six `bench-runtime` tests failed in the full suite while passing in isolation.
The first version of this report attributed that to machine contention. The
actual cause was concrete and worse.

An orphaned stub server held port 4187 — left behind by the sensor run whose
mutation removed the very SIGKILL escalation added in T19. `measureRuntime`
booted, received an instant 200 from that stranger, and reported it as its own:
`bootMs` came out 45 ms *lower* than a zero-delay boot, and `idleRssBytes` was 0
because the sampled process group was not the server's.

`portOwner` returning the squatter's PID is what made the diagnosis possible:

```
AssertionError: expected 58072 to be null
```

Consequence had it shipped: any listener on the runtime port — including the
previous version's server, or an unrelated dev server — would have been measured
and published as this repository's runtime numbers. Preflight checks the port
once before the matrix; the matrix boots one server per version, so a single
up-front check was never sufficient.

Fix: `measureRuntime` calls `portOwner` immediately before spawning and throws
naming the port and the PID. Verified by mutation — removing the guard fails
`app/tests/bench-runtime.test.ts:83`.

**Correction to the earlier reasoning:** contention was real and was happening
at the same time, which is exactly why it was a convenient explanation. It was
not the cause. Two separate observations had been merged into one story.

### 5. A same-day re-run destroyed the earlier run's data — fixed (T22)

The operator asked whether repeated runs accumulate. They did not. `--only=lint`
followed by `--only=check` on the same day left only the `check` result on disk.
The original criterion said "not overwrite a file from a different date", which
the implementation satisfied literally while still destroying same-day data. The
criterion was corrected and result files are now timestamped to the second.

### 6. Both required ports are now movable — added (T23, T24)

`docker compose up db -d` failed on this machine because another project already
published on 5432. The Postgres host port is now `${POSTGRES_PORT:-5432}`, and
the runtime measurement binds a free ephemeral port per boot rather than a fixed
4174, with `--runtime-port` to pin one.

The first version of the free-port test asserted only that the chosen port was
above 1024 and unoccupied — which a hardcoded idle port also satisfies, and a
mutation returning a constant survived. The test now occupies a port and asserts
the chooser avoids it, which kills that mutant in 149 ms. This is the second
time in this feature that a test appeared to cover a behaviour and did not; both
were caught by mutation rather than by review.

### 7. A wrong DATABASE_URL would have been published as a Bun finding — added (T25)

Making the Postgres port movable creates a way for `POSTGRES_PORT` and
`DATABASE_URL` to disagree. Without a check, the mismatch surfaces partway
through the matrix as a failing `sync` workload, which the harness records as a
`compat` finding against a Bun version. Preflight now verifies the connection
reaches a database containing a `posts` table, and names both variables in the
abort message.

---

## Environmental note, separate from the findings above

The PGLite-backed test files fail non-deterministically on this machine under
load, with `Hook timed out in 10000ms` inside `createTestDb()`. They failed the
same way before any code here existed and they pass in isolation. The machine
reached a 1-minute load average of 28.01 during this work.

This is contention and it is not introduced here. It is also the condition the
harness's `LOAD_AVG_LIMIT = 2.0` preflight gate exists to refuse, and it is
recorded in the run playbook as a warning to the operator.

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
| P1.3 AC7 — port free before the next version | `app/tests/bench-runtime.test.ts:67`, `:72` | `portOwner(PORT)` null after return, including against a SIGTERM-ignoring server |
| P1.3 AC7 — refuse a port the harness does not own | `app/tests/bench-runtime.test.ts:83` | `rejects.toThrow(/already bound by PID/)` against a live squatter |
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
