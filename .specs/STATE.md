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

- **Feature**: bun-native-test-runner (`.specs/features/bun-native-test-runner/`)
- **Phase / Task**: Validate complete; independent verification iteration 2 PASS.
- **Completed**: T1-T26. Spec-anchored validation matched 34/34 acceptance criteria; parity is exact at 138 files, 2,289 static tests, and 3,761 assertions per tree; all build gates passed; Playwright passed 49/49; the discrimination sensor killed 3/3 mutations.
- **In-progress** (file:line): none.
- **Next step**: Run the Bun Test job in CI shadow mode until ten real consecutive green, matching, non-noisy artifacts exist. Then make a separate explicit cutover decision; do not infer it from local timings.
- **Blockers**: Cutover is intentionally gated. Current A/C outcomes differ by five Bun Test skips, so the comparison is invalid and has no performance winner. Vitest A/B also emit shutdown noise despite exit code 0; keep it visible in shadow evidence.
- **Uncommitted files**: final TLC validation/state/lesson artifacts pending the closeout commit.
- **Branch**: feat/bun-native-test-runner
