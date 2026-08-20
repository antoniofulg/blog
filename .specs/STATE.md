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
- **Phase / Task**: Design complete, awaiting approval before Tasks
- **Completed**: spec.md (validated clean), design.md
- **In-progress** (file:line): none
- **Next step**: On design approval, write `tasks.md` and run `validate_tasks.py`.
- **Blockers**: none
- **Uncommitted files**: `.specs/STATE.md`, `.specs/features/bun-1-4-benchmark/spec.md`, `.specs/features/bun-1-4-benchmark/design.md`
- **Branch**: fix/auth-origin-behind-proxy
