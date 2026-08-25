# Bun Test Cutover Specification

## Problem Statement

The repository currently maintains a canonical Vitest tree and a validated
native Bun Test twin. The duplicate runners and parity harness increase
maintenance cost even though the controlled Bun 1.4 matrix showed the native
runner is the better operational fit for the two-worker local queue.

## Goals

- [ ] Make native Bun Test the default unit, component, and integration runner.
- [ ] Preserve every product test and every still-useful infrastructure test.
- [ ] Remove Vitest, jsdom, and runner-comparison machinery that has no purpose after cutover.
- [ ] Keep Playwright as the complete E2E suite and Bun.WebView as a local five-route diagnostic.

## Out of Scope

| Feature | Reason |
| --- | --- |
| Replace Playwright with Bun.WebView | WebView does not cover the full E2E contract. |
| Redesign GitHub Actions topology | The user requested runner cutover; CI structure comes later. |
| Delete historical benchmark evidence | Published numbers must remain reproducible and auditable. |
| Change product behavior | This is test infrastructure only. |

## Assumptions & Open Questions

| Assumption / decision | Chosen default | Rationale | Confirmed? |
| --- | --- | --- | --- |
| Canonical worker profile | `--parallel=2` with isolation | Best validated balance for speed, peak memory, and multiple worktrees. | yes |
| DOM implementation | HappyDOM preload | The Bun-first suite already passed with it; jsdom is Vitest-only here. | yes |
| Runtime version | Bun 1.4.0 | Matches the measured matrix and CI pin. | yes |
| Browser test boundary | Playwright full suite; WebView five-route diagnostic | Preserves coverage and the direct benchmark contract. | yes |
| Historical artifacts | Keep all versioned raw reports | Required by AD-001 and the planned blog post. | yes |

**Open questions:** none - the user explicitly approved the cutover.

## User Stories

### P1: Canonical Bun Test runner

**User Story**: As the maintainer, I want the default test command to use
native Bun Test so that local and CI queues use the validated faster profile.

**Why P1**: This is the requested cutover.

**Acceptance Criteria**:

1. WHEN `bun run test` executes THEN the system SHALL run native Bun Test 1.4.0 against `app/tests` with two isolated workers.
2. WHEN the canonical suite completes THEN the system SHALL discover 133 test files with zero failures.
3. The system SHALL preserve all 113 validated product-test files and all 20 active infrastructure-test files.
4. IF a test is specific only to Vitest parity or runner revalidation THEN the system SHALL remove it with its obsolete harness while preserving historical evidence.

**Independent Test**: Run `bun run test` and verify file count, outcomes, and command provenance.

### P1: Remove obsolete Vitest surface

**User Story**: As the maintainer, I want one unit/component/integration runner
so that tests do not drift across duplicate trees.

**Why P1**: A default cutover is incomplete while Vitest remains installed and executable.

**Acceptance Criteria**:

1. WHEN dependencies are installed THEN the system SHALL require neither `vitest` nor `jsdom`.
2. The system SHALL contain no `vitest.config.ts`, Vitest package script, or product test importing from `vitest`.
3. WHEN Bun Test needs a DOM THEN the system SHALL load the existing HappyDOM setup.
4. IF a runtime provenance check executes THEN the system SHALL accept only Bun with the native `bun:test` runner.

**Independent Test**: Inspect the lockfile/config and run repository tests that assert the canonical script contract.

### P1: Preserve browser testing boundaries

**User Story**: As the maintainer, I want browser coverage unchanged so that a
faster smoke harness is not mistaken for complete E2E coverage.

**Why P1**: The runner decision must not weaken quality strategy.

**Acceptance Criteria**:

1. WHEN `bun run test:e2e` executes THEN the system SHALL run the existing Chromium Playwright suite through Bun.
2. WHEN `bun run test:e2e:all` executes THEN the system SHALL retain Chromium, Firefox, and WebKit Playwright projects.
3. WHILE Bun.WebView remains available the system SHALL limit it to the five anonymous public-route diagnostics and keep it out of blocking CI.
4. The system SHALL document that the five-route benchmark is route-equivalent but not lifecycle-equivalent between warm WebView and Playwright.

**Independent Test**: Run the script/CI contract tests and the Chromium Playwright gate.

## Edge Cases

- IF PostgreSQL is unavailable THEN the system SHALL retain the existing environment-gated integration skips rather than fail unrelated tests.
- IF tests run from multiple worktrees THEN the system SHALL keep file isolation and the validated two-worker bound.
- IF historical reports mention Vitest as the former default THEN the system SHALL preserve the old result and append the new cutover decision.
- IF WebView is compared with Playwright THEN the system SHALL identify the exact five common routes and disclose warm-versus-cold lifecycle differences.

## Implicit-Requirement Dimensions

| Dimension | Resolution |
| --- | --- |
| Input validation & bounds | Runtime provenance pins Bun 1.4.0 and Bun Test. |
| Failure / partial-failure states | Any failing local gate blocks completion. |
| Idempotency / retry / duplicate handling | Install and test commands remain repeatable; no duplicate test tree remains. |
| Auth boundaries & rate limits | N/A because no application authorization changes. |
| Concurrency / ordering | Canonical unit suite uses two isolated workers; Playwright remains one worker. |
| Data lifecycle / expiry | N/A because no product data changes. |
| Observability | Test counts, skips, timing, and validation evidence are recorded. |
| External-dependency failure | Existing PostgreSQL availability skips remain explicit. |
| State-transition integrity | Cutover supersedes AD-003/AD-004 and becomes the sole canonical runner decision. |

## Requirement Traceability

| Requirement ID | Story | Phase | Status |
| --- | --- | --- | --- |
| BTC-01 | Canonical Bun Test runner | Execute | Implementing |
| BTC-02 | Preserve test inventory | Execute | Implementing |
| BTC-03 | Remove obsolete Vitest surface | Execute | Implementing |
| BTC-04 | Preserve DOM behavior | Execute | Implementing |
| BTC-05 | Preserve browser boundary | Execute | Pending |
| BTC-06 | Document direct comparison | Execute | Pending |

**Coverage:** 6 total, 6 mapped to tasks, 0 unmapped.

## Success Criteria

- [ ] `bun run test` passes 133 files with zero failures.
- [ ] `bun run lint`, `bunx tsc --noEmit`, `bun run build`, and Chromium Playwright pass.
- [ ] No Vitest or jsdom runtime/config/dependency remains.
- [ ] Documentation names Bun Test as canonical and retains benchmark evidence.
