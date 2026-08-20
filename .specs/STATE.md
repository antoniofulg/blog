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
- **Phase / Task**: Phases 1-4 and 6 complete (T1-T16, T19-T25). Phase 5 (T17, T18) blocked on the operator's benchmark run.
- **Completed**: T1-T16, T19-T25 — one atomic commit each. Full suite green: 121 files, 2176 tests, 0 failures.
- **In-progress** (file:line): none
- **Next step**: Operator sets POSTGRES_PORT in `.env` to a free port (5432 is taken by another project on this machine), mirrors it in DATABASE_URL, then runs `docker compose up db -d && make bench` on a quiet machine. When a result JSON exists with no unresolved compat finding under 1.4.0, unblock T17 (version pins), then T18 (the post).
- **Blockers**: T17 and T18 need real measurements, deferred by user decision.
- **Uncommitted files**: none
- **Branch**: feat/bun-1-4-benchmark (27 commits ahead of origin/main, not pushed)
