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
- **Reason**: The final matrix completed five valid interleaved samples for matched isolated 1/2/4 and Bun `--smol`-2 profiles with equivalent 113-file/2,057-pass/84-skip outcomes. Bun Test was faster at isolated-1 (31.10%), isolated-2 (21.64%), and `--smol`-2 (13.81%), while Vitest was faster at isolated-4 (4.33%); Bun peak RSS was lower only at isolated-4.
- **Trade-off**: Keep Vitest as the default and CI runner while retaining explicit Bun profiles as reversible local candidates. The complete raw matrix, parser fixes, sanitized environment, and skip normalization remain versioned for a future adoption decision.
- **Scope**: Unit/component/integration runner, test scripts, CI shadowing, and migration documentation.
- **Date**: 2026-08-24
- **Status**: active

### AD-005
- **Decision**: Keep Playwright as the E2E reference and keep Bun.WebView as an opt-in local five-route diagnostic only.
- **Reason**: The controlled browser revalidation preserved the five-route outcome contract and process-tree measurements, but WebView remains experimental and lacks Playwright's full suite capabilities. Only Node Playwright worker-1 completed five uncontaminated finalist samples; external browser activity invalidated the remaining confirmation attempt.
- **Trade-off**: The WebView harness and raw profiles remain versioned for future local experiments, while no default, CI, or Playwright configuration changes are made.
- **Scope**: Browser runtime revalidation feature under `.specs/features/browser-runtime-revalidation/`.
- **Date**: 2026-08-24
- **Status**: active

## Handoff

- **Feature**: Bun Test revalidation (`.specs/features/bun-test-revalidation/`)
- **Phase / Task**: T9 complete; final matrix and decision artifacts are committed.
- **Completed**: Bun 1.4 + Vitest remains the permanent `test` and blocking CI
  runner under AD-004. The independent Bun-first product tree, parity gate,
  matched `test:vitest:bun:1|2|4`, isolated Bun `test:bun:parallel:2|4`,
  `test:bun:smol:2`, and final benchmark routes remain available as explicit
  opt-in revalidation candidates. `test:e2e` remains Bun-driven Playwright and
  `test:e2e:node` remains the fallback.
- **In-progress** (file:line): none.
- **Next step**: Any default or CI Bun Test adoption requires a separate,
  explicit decision using the versioned matrix evidence; no automatic cutover.
- **Blockers**: none for the approved revalidation scope.
- **Repository state**: Operational defaults are unchanged; experimental parity,
  profile, and benchmark routes are executable but opt-in only.
- **Branch**: test/bun-test-revalidation (merge target: main)

## Browser Runtime Revalidation Handoff

- **Feature**: `.specs/features/browser-runtime-revalidation/`
- **Phase / Task**: Execute remediation harness fixes complete; evidence rerun pending a quiet machine window.
- **Completed**: Browser schema-2 runner now executes three-sample screening, retains exact route identities, records setup/provenance/lifecycle/contamination/cleanup fields, restarts cold WebView server/browser per sample, and reuses warm WebView sessions across passes. Process-group cleanup is verified and external browser activity is checked before, during and after samples. Focused tests cover boundaries, route parsing, contamination detection, and cleanup.
- **Evidence**: Schema-2 full runs `run-2026-08-25T00-26-03-716Z`, `run-2026-08-25T00-56-23-164Z`, and targeted `run-2026-08-25T01-01-36-548Z` are committed as audit evidence. Screening produced valid worker-2 and several WebView arms, but external browser trees repeatedly reappeared during confirmation; no finalist is promoted.
- **Next step**: Obtain a genuinely quiet machine window. Require one warm-up + three valid screening samples for every arm, then five valid interleaved confirmation samples for each non-dominated finalist. Update `validation.md` only after fresh verifier pass.
- **Defaults / CI**: unchanged.
- **Commits**: `846303b`, `a4d2e2d`, `a4e6054`, `22b2754`, `c7f389e`, `4407594`.
