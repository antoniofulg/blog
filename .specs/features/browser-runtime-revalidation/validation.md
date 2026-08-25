# Browser Runtime Revalidation Validation — Iteration 6

<!-- verdict: PASS -->

**Verdict**: PASS
**Date**: 2026-08-25
**Spec**: `.specs/features/browser-runtime-revalidation/spec.md`
**Diff range**: `68138dd^..7c13c9f`
**Iteration-6 commit**: `7c13c9f`
**Verifier**: independent sub-agent (author != verifier)

Iteration 6 closes the only iteration-5 blocker. The six README comparison rows now match the canonical JSON-derived values and generated Markdown exactly. Commit `7c13c9f` changes only `docs/benchmarks/browser-runtime-revalidation/README.md`; no implementation, evidence, default, CI or configuration behavior changed. Prior passing implementation, raw-evidence, gate and discrimination-sensor results remain valid.

## Final Verdict

| Requirement | Result | Final evidence |
| --- | --- | --- |
| BRR-01 | PASS | The fair Playwright common subset uses `--no-deps` and the canonical grep at `scripts/bench-browser-runtimes.ts:136`; README explicitly distinguishes setup-zero common-subset evidence at `docs/benchmarks/browser-runtime-revalidation/README.md:25`. |
| BRR-02 | PASS | Clean evidence records Node 24.19.0 and Bun 1.4.0 workers 1/2, one warm-up and 5/5 samples; the report links and summarizes that run at `docs/benchmarks/browser-runtime-revalidation/README.md:33`. |
| BRR-03 | PASS | Full WebKit/Chrome screening evidence remains linked at `docs/benchmarks/browser-runtime-revalidation/README.md:37`; warm lifecycle/cleanup controls remain implemented at `scripts/bench-browser-runtimes.ts:557`. |
| BRR-04 | PASS | Screening retains the full matrix and programmatic finalists; the clean run confirms both warm WebKit profiles and raw Pareto selects only `--smol`, summarized at `docs/benchmarks/browser-runtime-revalidation/README.md:33`. |
| BRR-05 | PASS | Global trace validation enforces exact length, unique monotonic sequence, timestamps, warm-ups and rotated rounds at `scripts/bench-browser-runtimes.ts:348`; execution and cleanup are coordinated at `scripts/bench-browser-runtimes.ts:557`; both locks are self-acquired at `scripts/bench-browser-runtimes.ts:704`. |
| BRR-06 | PASS | Operational versus common-subset evidence is separated at `docs/benchmarks/browser-runtime-revalidation/README.md:25`; corrected time/RSS/GiB·s/throughput rows are at `docs/benchmarks/browser-runtime-revalidation/README.md:69`; local-only unchanged-default decision is at `docs/benchmarks/browser-runtime-revalidation/README.md:78`. |

All tasks T1–T6 and remediation tasks R1–R10 are closed.

## Focused Iteration-6 Reconciliation

The verifier recomputed every displayed cell from `run-2026-08-25T06-17-36-513Z.json` using:

- time: `medianMs.toFixed(2)`;
- peak RSS: `(medianPeakRssBytes / 1024²).toFixed(1)`;
- RSS×time: `((medianMs / 1000) × (medianPeakRssBytes / 1024³)).toFixed(2)`;
- throughput: `(60000 / medianMs).toFixed(2)`.

| Profile | README row | Generated canonical row | Result |
| --- | --- | --- | --- |
| Playwright Node w1 | 4064.96 ms / 1747.7 MiB / 6.94 GiB·s / 14.76/min | `run-2026-08-25T06-17-36-513Z.md:12` | MATCH |
| Playwright Bun w1 | 2971.42 ms / 1332.1 MiB / 3.87 GiB·s / 20.19/min | `run-2026-08-25T06-17-36-513Z.md:13` | MATCH |
| Playwright Node w2 | 3700.97 ms / 1460.0 MiB / 5.28 GiB·s / 16.21/min | `run-2026-08-25T06-17-36-513Z.md:14` | MATCH |
| Playwright Bun w2 | 2857.40 ms / 1301.1 MiB / 3.63 GiB·s / 21.00/min | `run-2026-08-25T06-17-36-513Z.md:15` | MATCH |
| WebKit warm 1-view | 331.31 ms / 97.5 MiB / 0.03 GiB·s / 181.10/min | `run-2026-08-25T06-17-36-513Z.md:16` | MATCH |
| WebKit warm 1-view `--smol` | 308.41 ms / 97.0 MiB / 0.03 GiB·s / 194.55/min | `run-2026-08-25T06-17-36-513Z.md:17` | MATCH |

The same six values appear in the README at `docs/benchmarks/browser-runtime-revalidation/README.md:71`. A programmatic exact-row check returned six matches and zero mismatches. All 36 relative README links still resolve.

## Reused Fresh Evidence

Iteration 5 established, with no code/raw change in iteration 6:

- clean schema-2 common-subset run with six profiles, one warm-up/profile and 5/5 valid samples;
- exact five route identities, Playwright setup zero, Node 24.19.0/Bun 1.4.0 provenance;
- 36-entry global trace with unique sequence 0..35, real non-overlapping timestamps and schedule identity;
- persistent WebKit normal/`--smol` warm sessions on isolated port 49173, deterministic cleanup and no contamination;
- both CRM and Antclips locks self-acquired and recorded;
- process-tree RSS, RSS×time, throughput and raw Pareto math independently recomputed;
- focused Vitest: 5 files / 44 tests passed;
- full Bun Vitest: 133 files passed + 3 skipped, 2,292 tests passed + 84 skipped, 0 failed;
- Biome, TypeScript, production build and test-annotation lint passed;
- fresh locked `--no-deps` Chromium smoke passed exactly 5/5;
- discrimination sensor killed 6/6 mutations covering `--no-deps`, trace, locks, lifecycle, Node version and GiB·s units;
- `package.json`, `playwright.config.ts` and `.github/**` unchanged from the pre-feature baseline.

Because `7c13c9f` is documentation-only and touches only the five previously mismatched RSS cells, rerunning browser benchmarks or the full suite would add no relevant discrimination. The focused canonical-row/link checks are sufficient for this iteration.

## Final Summary

**Overall**: READY

**Requirements**: BRR-01 through BRR-06 PASS.
**Tasks**: T1 through T6 PASS; remediation R1 through R10 closed.
**Consistency**: canonical JSON, generated Markdown and README comparison now agree exactly.
**Gates and sensor**: prior fresh evidence remains applicable; focused iteration-6 reconciliation PASS.
**Defaults/CI/config**: unchanged.

No blockers remain.
