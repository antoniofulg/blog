# Bun Test revalidation

This experiment compares Bun-hosted Vitest 4.1.5 with native Bun Test 1.4.0
without changing the default runner, CI, Playwright, or production behavior.

## Final decision

The complete finalist matrix is in
[`matrix-2026-08-24.md`](./matrix-2026-08-24.md). All four pairs have one
discarded warm-up and five valid interleaved samples, process-tree RSS, and
equivalent 113-file outcomes. The three DB integration files run in both arms;
when local PostgreSQL is unavailable they produce intentional equal skips.

Keep Bun-hosted Vitest as `test` and as the blocking CI runner. The evidence is
profile-dependent: native Bun Test is materially faster at isolated-1,
isolated-2, and `--smol`-2, while Vitest is 4.33% faster at isolated-4. Bun's
isolated-4 profile uses 10.71% less peak RSS, but its lower speed and the
maintenance cost of a second suite do not justify a default or CI cutover.

The smallest reversible next step is to retain the explicit Bun routes as
opt-in local candidates, with isolated-2 as the throughput candidate and
`--smol`-2 as the memory-oriented candidate. Any future adoption must be a
separate explicit decision; this run does not supersede AD-004.

## Matrix summary

| Profile | Vitest median / peak RSS | Bun median / peak RSS | Bun result |
| --- | ---: | ---: | --- |
| isolated-1 | 55.549 s / 2,278.6 MiB | 38.271 s / 2,777.5 MiB | 31.10% faster, 21.90% more RSS |
| isolated-2 | 33.080 s / 2,751.9 MiB | 25.922 s / 2,841.1 MiB | 21.64% faster, 3.24% more RSS |
| isolated-4 | 20.433 s / 3,394.8 MiB | 21.318 s / 3,031.2 MiB | 4.33% slower, 10.71% less RSS |
| `--smol`-2 | 38.190 s / 2,631.5 MiB | 32.916 s / 2,728.3 MiB | 13.81% faster, 3.68% more RSS |

All valid samples: 2,057 passed, 84 skipped, 0 failed, 0 todo, 113 files.
The three fully skipped files are `auth-integ.test.ts`,
`indexer-integ.test.ts`, and `sync-integ.test.ts`; their leaf identities remain
in the parity manifest and both arms use the same sanitized local DB
environment. Excluded contamination attempts are retained in the raw files:
12 for isolated-4 and 6 for `--smol`-2.

## Raw evidence

- [`isolated-1 JSON`](./runs/run-2026-08-24T21-12-52-666Z.json) · [`Markdown`](./runs/run-2026-08-24T21-12-52-666Z.md)
- [`isolated-2 JSON`](./runs/run-2026-08-24T21-37-17-650Z.json) · [`Markdown`](./runs/run-2026-08-24T21-37-17-650Z.md)
- [`isolated-4 JSON`](./runs/run-2026-08-24T21-45-50-205Z.json) · [`Markdown`](./runs/run-2026-08-24T21-45-50-205Z.md)
- [`--smol`-2 JSON`](./runs/run-2026-08-24T22-04-15-738Z.json) · [`Markdown`](./runs/run-2026-08-24T22-04-15-738Z.md)

The earlier invalid and contaminated runs remain versioned as historical
evidence and are not used for the decision.

## Operational interpretation

Peak instantaneous RSS is the primary multi-worktree metric. RSS·time is
reported as a secondary queue-occupancy approximation: Bun is 16.02%, 19.10%,
6.84%, and 10.64% lower for isolated-1, isolated-2, isolated-4, and `--smol`-2
respectively. This does not mean a worktree can always start earlier: peak RSS,
resource contention, and profile stability still govern safe concurrency.

The no-isolate probes remain rejected for DOM, mocks/timers, and integration
cohorts because those suites leak state or contend for resources. No CI or
default-script change is authorized by this artifact.
