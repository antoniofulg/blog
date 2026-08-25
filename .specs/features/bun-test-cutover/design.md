# Bun Test Cutover Design

**Spec**: `.specs/features/bun-test-cutover/spec.md`
**Status**: Approved

## Architecture Overview

Promote the already validated Bun-first tree instead of translating the
canonical Vitest tree again. Port the 20 infrastructure tests that were
intentionally outside the 113-file product candidate, delete only the
runner-comparison harness, then move the candidate to the canonical path.

```text
113 Bun product tests + 20 ported infrastructure tests
                         |
                         v
                  app/tests (133 files)
                         |
                         v
        bun test --parallel=2 (isolated workers)

tests/e2e (49 Playwright tests) ----> Bun-driven Playwright
five public-route diagnostics ------> Bun.WebView (local only)
```

## Code Reuse Analysis

| Existing component | Location | How it is used |
| --- | --- | --- |
| Bun-first product suite | `app/tests-bun/` | Becomes the canonical test tree. |
| HappyDOM preload | `app/tests-bun/happydom.ts` | Supplies DOM globals for component tests. |
| Runtime provenance | `scripts/check-test-runtime.ts` | Simplified to Bun/Bun Test only. |
| Browser route contract | `app/lib/browser-bench/contract.ts` | Defines the exact five-route common subset. |
| Playwright config | `playwright.config.ts` | Preserved unchanged as the full E2E boundary. |

## Components

### Canonical Bun test tree

- **Purpose**: Own unit, component, integration, and infrastructure tests.
- **Location**: `app/tests/`
- **Interface**: `bun run test`
- **Dependencies**: `bun:test`, HappyDOM, Testing Library, existing fixtures.
- **Reuses**: The validated 113-file candidate and 20 ported tests.

### Runtime and package contract

- **Purpose**: Pin the runtime/runner and expose the measured worker profile.
- **Location**: `package.json`, `bunfig.toml`, `scripts/check-test-runtime.ts`
- **Interface**: `test`, `test:local`, `test:bun`.
- **Dependencies**: Bun 1.4.0.
- **Reuses**: Existing provenance assertions and benchmark findings.

### CI contract

- **Purpose**: Make the existing `make test` matrix entry execute Bun Test.
- **Location**: `.github/workflows/ci.yml`, `Makefile`.
- **Interface**: `make test`.
- **Dependencies**: Existing Bun setup and environment provisioning.
- **Reuses**: Current workflow topology; no new jobs.

## Error Handling Strategy

| Error scenario | Handling | Impact |
| --- | --- | --- |
| Bun version/runner mismatch | Provenance check exits non-zero before tests. | Prevents invalid CI/local evidence. |
| PostgreSQL unavailable | Existing guarded integration tests skip with justification. | Product-independent tests still run. |
| Ported infrastructure test fails | Cutover stops; no deletion to force green. | Coverage is preserved. |
| Browser regression | Existing Chromium Playwright gate blocks completion. | E2E boundary remains intact. |

## Risks & Concerns

| Concern | Location | Impact | Mitigation |
| --- | --- | --- | --- |
| Duplicate trees can drift during the cutover | `app/tests/`, `app/tests-bun/` | Missing product coverage | Promote the validated tree atomically and assert 133 files. |
| Infra tests mix live behavior and revalidation-only behavior | `app/tests/bench-runner.test.ts` | Accidental loss or obsolete imports | Keep the nine process-measurement tests; remove only the revalidation block. |
| Warm WebView looks dramatically faster than Playwright | browser benchmark reports | Misleading replacement claim | Document exact route parity and lifecycle mismatch. |
| Historical docs state Vitest is permanent | rules, posts, benchmark README | Contradictory guidance | Append dated cutover amendments; preserve raw numbers. |

## Tech Decisions

| Decision | Choice | Rationale |
| --- | --- | --- |
| Migration source | Promote `app/tests-bun` | This exact product inventory has controlled parity and performance evidence. |
| Worker profile | `--parallel=2` | 21.64% faster than matched Bun+Vitest with only 3.24% higher peak RSS and 19.10% lower RSS×time. |
| Isolation | Keep Bun Test worker isolation | Shared-state profiles were not approved and multi-worktree reliability is critical. |
| Browser strategy | Keep Playwright canonical | WebView covers only five public smokes and lacks full E2E features. |

