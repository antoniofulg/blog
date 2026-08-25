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
- **Status**: superseded by AD-006

### AD-004
- **Decision**: Keep Bun 1.4 + Vitest as the permanent unit, component, and integration test runner; retire Bun Test and its shadow/cutover workflow.
- **Reason**: The final matrix completed five valid interleaved samples for matched isolated 1/2/4 and Bun `--smol`-2 profiles with equivalent 113-file/2,057-pass/84-skip outcomes. Bun Test was faster at isolated-1 (31.10%), isolated-2 (21.64%), and `--smol`-2 (13.81%), while Vitest was faster at isolated-4 (4.33%); Bun peak RSS was lower only at isolated-4.
- **Trade-off**: Keep Vitest as the default and CI runner while retaining explicit Bun profiles as reversible local candidates. The complete raw matrix, parser fixes, sanitized environment, and skip normalization remain versioned for a future adoption decision.
- **Scope**: Unit/component/integration runner, test scripts, CI shadowing, and migration documentation.
- **Date**: 2026-08-24
- **Status**: superseded by AD-006

### AD-005
- **Decision**: Keep Playwright as the E2E reference and keep Bun.WebView as an opt-in local five-route diagnostic only.
- **Reason**: Fresh schema-2 screening and queued-lock confirmation preserved the five-route outcome contract and process-tree measurements. Node arms empirically ran on Node 24.19.0, Bun arms on Bun 1.4.0, and warm WebView samples used persistent sessions with an execution trace. Playwright remains the reference because WebView lacks the full suite capabilities; both warm profiles were confirmed, but only WebKit warm 1-view `--smol` is raw non-dominated, not a replacement.
- **Trade-off**: The WebView harness and raw profiles remain versioned for future local experiments, while no default, CI, or Playwright configuration changes are made.
- **Scope**: Browser runtime revalidation feature under `.specs/features/browser-runtime-revalidation/`.
- **Date**: 2026-08-24
- **Status**: active

### AD-006
- **Decision**: Use native Bun Test 1.4 as the canonical unit, component, integration, and infrastructure runner with two isolated workers; remove Vitest and its duplicate tree.
- **Reason**: The controlled isolated-2 matrix preserved identical 113-file product outcomes while Bun Test was 21.64% faster, used 3.24% more peak RSS, and reduced RSS×time by 19.10%. Shorter memory occupancy is the better operational fit for queued local worktrees, and the 20 active infrastructure files also pass natively.
- **Trade-off**: Peak RSS is slightly higher than Bun-hosted Vitest at two workers, and the executable Vitest fallback is removed. The one-/four-worker and `--smol` measurements, raw reports, and prior decisions remain versioned for audit and reversal through Git history.
- **Scope**: Default/local/CI unit, component, integration, and infrastructure tests. Playwright remains the full E2E runner; Bun.WebView remains a local five-route diagnostic.
- **Date**: 2026-08-25
- **Status**: active

## Handoff

- **Feature**: Bun Test cutover (`.specs/features/bun-test-cutover/`)
- **Phase / Task**: Phase 2 / T5 - documentation reconciliation.
- **Completed**: T1-T4. The canonical `app/tests/` tree contains 133 native Bun Test files; Vitest/jsdom, the duplicate tree, and comparison harness are removed. `bun run test` uses Bun 1.4 with two isolated workers. Chromium Playwright remains Bun-driven and passed 49/49.
- **In-progress** (file:line): living rules, benchmark amendments, and migration posts.
- **Next step**: Run the complete local CI gate, commit fresh evidence, then dispatch the independent verifier.
- **Blockers**: none.
- **Uncommitted files**: documentation reconciliation only; `docs/_reports/` remains intentionally local.
- **Branch**: test/bun-test-revalidation (merge target: main)

## Browser Runtime Revalidation Handoff

- **Feature**: `.specs/features/browser-runtime-revalidation/`
- **Phase / Task**: Execute iteration-5 common-subset coordinator/lock remediation complete.
- **Completed**: Browser schema-2 runner now executes three-sample screening, retains exact route identities, records setup/provenance/lifecycle/contamination/cleanup fields, restarts cold WebView server/browser per sample, and coordinates one global six-profile confirmation with persistent warm sessions, one warm-up per profile, append-only sequence/timestamp trace, and both-lock provenance. Focused tests cover boundaries, route parsing, contamination detection, cleanup, trace discrimination, and lock entrypoint controls.
- **Evidence**: Screening is `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T02-31-40-880Z.json` with one warmup + three samples per profile and programmatic Pareto selection. Historical operational confirmation is `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T04-16-32-724Z.json`. Clean iteration-5 common-subset confirmation is `docs/benchmarks/browser-runtime-revalidation/runs/run-2026-08-25T06-17-36-513Z.json`; Node 24/Bun 1/2 `--no-deps` Playwright plus both WebKit warm profiles each have one discarded warmup and five valid samples, exact five routes, trace 0..35, schedule identity, both-lock provenance, no contamination, and Pareto selects WebKit warm `--smol`.
- **Next step**: Independent verifier may update `validation.md`; defaults/CI remain unchanged.
- **Defaults / CI**: unchanged.
- **Commits**: `846303b`, `a4d2e2d`, `a4e6054`, `22b2754`, `c7f389e`, `4407594`, `1001bc2`, `0a69c95`, `261798d`, `4683923`.
