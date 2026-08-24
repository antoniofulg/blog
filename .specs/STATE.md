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

### AD-004
- **Decision**: Keep Bun 1.4 + Vitest as the permanent unit, component, and integration test runner; retire Bun Test and its shadow/cutover workflow.
- **Reason**: The controlled isolated-1 revalidation completed five valid interleaved samples with equivalent 110-file/2,057-pass/67-skip outcomes. Bun Test was 26.8% faster and improved nominal serialized release throughput by 36.6%, but peak process-tree RSS was 27.6% higher. Its RSS×duration approximation was 6.6% lower, yet only isolated-1 was run to the final gate; the 2/4-worker and `--smol` profiles still need a complete matrix before a default cutover.
- **Trade-off**: Keep the lower-peak-RSS Vitest default for multi-worktree safety while retaining Bun Test isolated-1 as a promising local candidate. The valid and invalid raw reports, parser fixes, and follow-up criteria remain versioned for a future decision.
- **Scope**: Unit/component/integration runner, test scripts, CI shadowing, and migration documentation.
- **Date**: 2026-08-24
- **Status**: active

## Handoff

- **Feature**: Bun Test retirement (`docs/plans/2026-08-24-retire-bun-test-design.md`)
- **Phase / Task**: Retirement complete; historical evidence and completed migration specs retained.
- **Completed**: Bun 1.4 + Vitest is permanent for unit, component, and integration tests. The Bun Test duplicate tree, shadow CI job, parity/cutover tooling, and live candidate commands were retired. `test:e2e` delegates to Bun-driven Playwright and `test:e2e:node` remains the fallback. The WebView harness and routes were removed after raw reports were archived. Historical benchmark reports and migration validation remain linked for traceability.
- **In-progress** (file:line): none.
- **Next step**: none for Bun Test migration. Maintain Bun 1.4 + Vitest and preserve historical benchmark evidence.
- **Blockers**: none.
- **Repository state**: Current operational state is the post-retirement runner configuration; historical specs and benchmark reports are not executable guidance.
- **Branch**: chore/retire-bun-test (merge target: main)
