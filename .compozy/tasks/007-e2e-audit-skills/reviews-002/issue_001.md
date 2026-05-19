---
provider: manual
pr:
round: 2
round_created_at: 2026-05-19T15:08:24Z
status: resolved
file: Makefile
line: 95
severity: critical
author: claude-code
provider_ref:
---

# Issue 001: CI matrix references missing Makefile target 'e2e'

## Review Comment

`.github/workflows/ci.yml:15` declares the quality matrix as `check: [test, lint, check, build-js, e2e, lint-tests]` and L20 executes each entry via `make ${{ matrix.check }}`. The Makefile, however, only defines `test-e2e:` (L95) and `lint-tests:` (L91) — there is no `e2e:` target.

Running `make e2e` produces `make: *** No rule to make target 'e2e'.  Stop.` and exits non-zero. The `e2e` matrix entry therefore fails on every PR run, including the PR that merges this branch to `main`. PRD-007 (Goals: "Establish a working PR-blocking browser e2e gate") and ADR-003 (CI failure policy: strict block + auto-retry-once + @flaky SLA) both require the e2e gate to work end-to-end on day one. As-shipped, the gate is unreachable: CI is permanently red on the `e2e` job regardless of spec quality.

This is also visible locally: a developer running `make` with no arguments after merge will hit the same error if `e2e` is added to any aggregated target list.

**Suggested fix:** add an `e2e: ## Run Playwright e2e test suite` target in `Makefile` that aliases `test-e2e` (single line: `e2e: test-e2e` or a duplicate body). Alternatively, change the matrix entry in `.github/workflows/ci.yml:15` from `e2e` to `test-e2e` so the matrix call resolves to the existing target. Pick whichever is more consistent with the matrix naming convention elsewhere in the file. Confirm the fix by running `make e2e` locally and observing the same behavior as `make test-e2e`.

## Triage

- Decision: `valid`
- Root cause: CI matrix entry `e2e` calls `make e2e` but Makefile only defines `test-e2e`. `make e2e` fails with "No rule to make target 'e2e'", permanently breaking the e2e CI gate.
- Fix applied: Added `e2e: test-e2e` prerequisite alias before the `test-e2e` target in `Makefile:95`. No recipe needed; Make chains to `test-e2e` automatically. Help comment format preserved.
