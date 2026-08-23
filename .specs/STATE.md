# STATE

## Decisions

### AD-001
- **Decision**: Measurement results that a published post cites are committed under `docs/benchmarks/<topic>/`, never under the gitignored `docs/_reports/`.
- **Reason**: `docs/_reports/` is gitignored because audit runs are transient and per-developer. Benchmark numbers quoted in public writing are the opposite: they must stay in git so a reader can open the source data and a future run can be diffed against them.
- **Trade-off**: Result JSON grows the repository over time, and a careless re-run can produce a noisy commit. Mitigated by date-stamped filenames that never overwrite a prior run.
- **Scope**: Any feature that produces numbers cited in `app/content/posts/`.
- **Date**: 2026-08-20
- **Status**: active

### AD-002
- **Decision**: Run the canonical Playwright E2E command through Bun, retain an explicit Node fallback, and retire the Bun.WebView harness after preserving its benchmark evidence.
- **Reason**: Bun-driven Playwright preserves the full 49-test coverage while WebView lacks the fixtures, locators, auth storage, traces, and reporters required to replace it.
- **Trade-off**: The raw WebView reports remain versioned, but their executable harness is removed; repeating the experiment would require restoring it from Git history.
- **Scope**: E2E runtime commands and local browser automation benchmarks.
- **Date**: 2026-08-22
- **Status**: active

### AD-003
- **Decision**: Keep `test:local` serialized at one Vitest worker.
- **Reason**: Profile `2` won memory by only 0.12% (2.0 MiB), while a fresh
  two-worker run failed two `bench-runtime` tests in a port/PID race. Profile
  `1` is the reliable operational choice; worker timing evidence is noisy.
- **Scope**: Local multi-worktree test command.
- **Date**: 2026-08-23
- **Status**: active

## Handoff

- **Feature**: Bun migration follow-up (`.specs/features/bun-migration-follow-up/`)
- **Phase / Task**: T1-T10 and implementation complete; independent verification follow-up.
- **Completed**: `test:e2e` delegates to Bun-driven Playwright and `test:e2e:node` remains the fallback. The WebView harness and routes were removed after raw reports were archived. Current persisted Chromium runtime evidence covers 49/49 with five measured samples per Node/Bun arm; Chromium, Firefox, and WebKit each pass 49/49. Current parity is 141/141 files, and the five synthetic Bun Test skips are normalized at leaf-outcome level while raw counts remain preserved. Previous independent verification failed only on a nondiscriminating changed-inventory test; both verifier twins now cover individually valid, zero-failure arms with different Playwright inventories and assert the exact invalidation reason and forced Bun command.
- **In-progress** (file:line): none.
- **Next step**: Independent reverification of the focused Vitest/Bun verifier tests, parity, and current-state handoff. Bun Test status remains 0/10 valid consecutive shadow runs; after reverification, continue collecting ten real consecutive green runs from distinct commits before deciding whether to replace Vitest itself. Use serialized `test:local` profile `1` for reliability.
- **Blockers**: none. One Node fallback E2E run hit the known PGLite lock timeout; the required subsequent full retry passed 49/49.
- **Uncommitted files**: verifier-gap twin tests and this handoff; pre-existing `validation.md` remains untouched.
- **Branch**: test/bun-migration-follow-up
