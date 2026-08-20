# STATE

## Decisions

### AD-001
- **Decision**: Measurement results that a published post cites are committed under `docs/benchmarks/<topic>/`, never under the gitignored `docs/_reports/`.
- **Reason**: `docs/_reports/` is gitignored because audit runs are transient and per-developer. Benchmark numbers quoted in public writing are the opposite: they must stay in git so a reader can open the source data and a future run can be diffed against them.
- **Trade-off**: Result JSON grows the repository over time, and a careless re-run can produce a noisy commit. Mitigated by date-stamped filenames that never overwrite a prior run.
- **Scope**: Any feature that produces numbers cited in `app/content/posts/`.
- **Date**: 2026-08-20
- **Status**: active

## Handoff

- **Feature**: bun-1-4-benchmark (`.specs/features/bun-1-4-benchmark/`)
- **Phase / Task**: Phases 1-4 and 6 complete (T1-T16, T19). Phase 5 (T17, T18) blocked on the operator's benchmark run.
- **Completed**: T1-T16, T19 — each with its own atomic commit
- **In-progress** (file:line): none
- **Next step**: The operator runs `make bench-setup && docker compose up db -d && make bench` on a quiet machine. When `docs/benchmarks/bun-1-4/<date>.json` exists and shows no unresolved compat finding under 1.4.0, unblock T17 (version pins) then T18 (the post).
- **Blockers**: T17 and T18 need real measurements. The harness is built, tested and committed; the measurement run is deliberately deferred.
- **Uncommitted files**: none
- **Branch**: feat/bun-1-4-benchmark
