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

## Handoff

- **Feature**: Bun Playwright and WebView evaluation (`docs/plans/2026-08-22-bun-playwright-webview-design.md`)
- **Phase / Task**: Evaluation complete; WebView experiment retired.
- **Completed**: `test:e2e` delegates to Bun-driven Playwright and `test:e2e:node` remains the fallback. The WebView harness and routes were removed after raw reports were archived. Cold measured WebView 70.84% slower with 24.41% higher browser RSS; warm-session measured WebView 187.38% slower with 14.30% higher browser RSS. Including warm-ups, WebView consumed 42.69% more total cold time and 221.55% more total warm-pass time. Full Bun Playwright passed 49/49; Node/Vitest and Bun Test each passed 2,355 tests.
- **In-progress** (file:line): none.
- **Next step**: Collect ten real consecutive green Bun Test shadow runs before deciding whether to cut over the blocking unit/integration test command.
- **Blockers**: none. One Node fallback E2E run hit the known PGLite lock timeout; the required subsequent full retry passed 49/49.
- **Uncommitted files**: none after the benchmark results commit.
- **Branch**: feat/bun-native-test-runner
