# Bun Test revalidation

This directory records the controlled Bun 1.4 revalidation requested after the
initial Bun Test comparison. The experiment compares the existing Vitest suite
running on Bun with the Bun-first suite; it does not change the default runner,
CI, Playwright, or WebView decisions.

## Valid full-suite evidence

The decision-quality artifact is
[`run-2026-08-24T20-36-29-794Z.md`](./runs/run-2026-08-24T20-36-29-794Z.md), with
the complete machine-readable data in
[`run-2026-08-24T20-36-29-794Z.json`](./runs/run-2026-08-24T20-36-29-794Z.json).

It used Bun 1.4.0 on an Apple M3 Pro with 11 cores, isolated execution and one
worker per arm. Each arm received one discarded warmup and five interleaved
measured samples. Both arms represented 110 files, 2,057 passing tests and 67
environment-skipped tests; the outcome gate passed. Eight measured attempts
were contaminated by unrelated external validation processes and retained as
excluded evidence. The two warmups are also retained and excluded.

| Arm | Median time | Measured spread | Median process-tree RSS | Nominal serialized throughput |
| --- | ---: | ---: | ---: | ---: |
| Vitest on Bun | 55.671 s | 54.792–60.663 s | 2,006.8 MiB | 64.7 suites/hour |
| Bun Test on Bun | 40.762 s | 39.274–41.549 s | 2,559.7 MiB | 88.3 suites/hour |

For this matched isolated-1 profile, Bun Test releases the machine 26.8% sooner
and has a nominal serialized throughput gain of 36.6%, but its peak process-tree
RSS is 27.6% higher. As a queue/occupancy approximation, median RSS multiplied
by median duration is 111,717 MiB·s for Vitest and 104,339 MiB·s for Bun Test;
Bun is 6.6% lower on this measure. This is not a true integral because RSS was
sampled at 100 ms and the report stores peak RSS, so peak memory remains the
primary multi-worktree safety metric.

## Conservative decision

The matched-profile result is materially better for elapsed time and machine
release, but it is not sufficient to replace the project default yet:

- only isolated-1 has a decision-quality full-suite run in T8; the 2/4-worker
  and `--smol` profiles were screened in T7 but were not promoted to a final
  winner;
- the faster arm uses substantially more peak RSS, which matters when several
  worktrees share the machine;
- the result does not establish a CI-wide gain or a safe no-isolate profile;
- the benchmark remains a local comparison and does not authorize changing
  `test`, CI, or the Playwright runtime.

Therefore AD-004 remains active: keep Bun 1.4 + Vitest as the permanent
unit/component/integration runner for now. Bun Test isolated-1 is a promising
local candidate for a separately scoped follow-up, provided a complete
2/4-worker and `--smol` final matrix confirms that the memory trade-off is
acceptable. No CI or default-script cutover is made by this revalidation.

## Invalid and historical evidence

These artifacts remain versioned for auditability but must not be used as
performance winners:

- [`run-2026-08-24T19-35-07-029Z.md`](./runs/run-2026-08-24T19-35-07-029Z.md)
  reached five samples but used the pre-fix stderr parser and reported a false
  skip mismatch (`67` vs `75`).
- [`run-2026-08-24T20-16-29-696Z.md`](./runs/run-2026-08-24T20-16-29-696Z.md)
  used full stderr after the first parser fix but double-counted Bun's repeated
  skip summary (`67` vs `56`).
- [`run-2026-08-24T15-00-23-611Z.md`](./runs/run-2026-08-24T15-00-23-611Z.md)
  is the earlier contaminated/failed full-suite screen documented by T7.

The parser and measurement fixes are covered by commits `4f1d012` and
`e197636`; the valid T8 artifact and traceability update are commit `22c0ab7`.
The cohort, isolation and `--smol` screening evidence is in
[`cohort-screening.md`](./cohort-screening.md).

## Follow-up

If the project chooses to revisit the cutover, run the same controlled matrix
for isolated-2, isolated-4 and `--smol`, with the same quiet-host and external
process coordination. Record peak RSS, memory-time approximation, release
time, outcome parity and CI-equivalent runs before superseding AD-004.
