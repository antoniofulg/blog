# Bun Test revalidation — cohort screening

**Run date:** 2026-08-24  
**Commit under test:** `6d6863e`  
**Runtime:** Bun 1.4.0  
**Reference:** Bun-hosted Vitest 4.1.5  
**Host policy:** results from concurrent unrelated test processes are not valid
for the final decision.

## Inventory and per-file timing

The candidate parity gate passed with 133 canonical files, 113 Bun-first
product files, 2,057 passing tests, and 101 documented environment skips. The
candidate per-file isolated timing sweep ran all 113 files; every file exited
zero. Raw timings are in
[`per-file-timings.json`](./per-file-timings.json), with the deterministic
cohort classification in
[`per-file-timings-classified.json`](./per-file-timings-classified.json).

| Cohort | Files | Light | Medium | Heavy |
| --- | ---: | --- | --- | --- |
| pure | 9 | `analytics-referrer-bucketer.test.ts` — 8 ms | `lib-date.test.ts` — 19 ms | `strings.test.ts` — 63 ms |
| dom | 11 | `dom-setup.test.ts` — 144 ms | `tic-tac-toe.test.ts` — 359 ms | `embeds.test.ts` — 636 ms |
| mocks/timers | 22 | `not-found-page.test.ts` — 120 ms | `admin-sidebar.test.ts` — 303 ms | `theme-toggle.test.ts` — 876 ms |
| integration/infra | 71 | `dockerignore.test.ts` — 10 ms | `sync-integ.test.ts` — 159 ms | `pglite-extended-query.test.ts` — 9,624 ms |

Representative profile screening used the light/medium/heavy shape for every
cohort. The exact commands and raw process-tree measurements are in
[`profile-screening.json`](./profile-screening.json).

## Isolation probes

Each cohort ran twice in normal order, once reversed, and once with the fixed
random seed `20260824`, using `bun test --parallel=2 --no-isolate`.

| Cohort | Normal 1 | Normal 2 | Reverse | Random | Decision |
| --- | --- | --- | --- | --- | --- |
| pure (9 files) | pass | pass | pass | pass | eligible for a shared-state probe |
| dom (11 files) | fail | fail | fail | fail | reject: body state leaked (`DOM test setup`) |
| mocks/timers (22 files) | fail | fail | fail | fail | reject: module/DOM state leaked; 24 failures + 7 errors |
| integration/infra (71 files) | fail | fail | fail | fail | reject: resource/state contention; 219 failures + 3 errors |

The full raw probe output is in
[`cohort-probes.json`](./cohort-probes.json). Therefore no-isolate is not a
candidate for the complete suite. Only the pure cohort is eligible for a
separate future shared-state experiment; it is not promoted to a full-suite
profile.

## Matched isolated profiles

The 1/2/4-worker screen used the same representative file names in the Vitest
and Bun-first trees. Every representative profile passed except Bun Test
worker 1 for integration/infra, which failed in the PGLite representative.
That failure is retained as compatibility evidence, not treated as a speed
result.

The process-tree RSS sampler has a 100 ms interval. Very short Bun runs
occasionally report 0 or only the launcher RSS; those values are marked
measurement-limited and are not used to claim a memory win.

| Cohort | Workers | Vitest time / RSS | Bun Test time / RSS | Valid |
| --- | ---: | ---: | ---: | --- |
| pure | 1 | 4.00 s / 225.0 MiB | 0.10 s / sample-limited | yes |
| pure | 2 | 2.91 s / 218.8 MiB | 0.07 s / sample-limited | yes |
| pure | 4 | 2.30 s / 251.4 MiB | 0.09 s / sample-limited | yes |
| DOM | 1 | 8.12 s / 265.5 MiB | 0.80 s / 111.5 MiB | yes |
| DOM | 2 | 6.95 s / 382.2 MiB | 0.87 s / sample-limited | yes |
| DOM | 4 | 3.05 s / 534.9 MiB | 0.65 s / sample-limited | yes |
| mocks/timers | 1 | 5.35 s / 662.2 MiB | 1.68 s / 242.3 MiB | yes |
| mocks/timers | 2 | 6.95 s / 501.0 MiB | 1.67 s / sample-limited | yes |
| mocks/timers | 4 | 10.87 s / 380.2 MiB | 1.75 s / sample-limited | yes |
| integration/infra | 1 | 13.49 s / 1,157.3 MiB | 17.15 s / 937.8 MiB | **no — exit 1** |
| integration/infra | 2 | 20.01 s / 1,175.6 MiB | 12.23 s / sample-limited | yes |
| integration/infra | 4 | 10.85 s / 1,406.6 MiB | 9.42 s / sample-limited | yes |

These are screening signals, not finalist evidence: the runs were not the
required five interleaved full-suite repetitions, and the host had unrelated
worktrees active. They select isolated profiles for the long run but do not
establish a winner.

## `--smol` memory screen

`bun --smol test --parallel=2` passed the same representative pure, DOM,
mocks/timers, and integration sets. Times were 0.09 s, 0.39 s, 0.67 s, and
6.01 s respectively. Short-run RSS was sample-limited in all four profiles,
so `--smol` remains a memory candidate for the full benchmark rather than a
proven memory improvement. Raw output is in
[`smol-screening.json`](./smol-screening.json).

## Full-suite invalid sample

The first full-suite screening report is preserved as
[`run-2026-08-24T15-00-23-611Z.md`](./run-2026-08-24T15-00-23-611Z.md), with
complete JSON alongside it. Vitest completed 2,057 tests / 101 skips in
184.17 s with 1,882.3 MiB process-tree peak RSS. The Bun arm ran 2,050 tests /
101 skips and failed 8 PGLite hook cases after 277.49 s. Host load was about
16, and unrelated worktree suites were active, so the arm is excluded for both
compatibility and contamination. No winner is inferred.

## T7 decision

- **Promote:** isolated Bun profiles 1/2/4 for full-suite measurement; keep
  `--smol` as a separately labeled memory profile.
- **Do not promote:** Bun `--parallel --no-isolate` for DOM, mocks/timers, or
  integration/infra; the probes prove state leakage/contended resources.
- **Not yet decided:** full-suite speed or memory. That requires a quiet host,
  one discarded warm-up, and at least five interleaved measured samples per
  finalist in T8.
