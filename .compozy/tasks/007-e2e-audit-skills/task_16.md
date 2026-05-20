---
status: completed
title: Phase 4 deps + shared fingerprint module + content-audit reporter refactor
type: infra
complexity: medium
dependencies:
    - task_12
feature: audit/fingerprint-shared
---

# Task 16: Phase 4 deps + shared fingerprint module + content-audit reporter refactor

## Overview

Install Phase 4 dev dependencies (`@axe-core/playwright`, `@lhci/cli`), create the shared `tests/e2e/audit-fingerprint.ts` module exporting the `AuditType` union and `formatFingerprint()` helper consumed by both audit reporters, and refactor `app/lib/content-audit/reporter.server.ts` + `.github/workflows/content-audit.yml` to import from the shared helper without behavior change. This is the prerequisite hardening step before app-audit's renderer modules land in task_17.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST install `@axe-core/playwright` and `@lhci/cli` as devDependencies pinned to known-good versions; Lighthouse arrives transitively via `@lhci/cli`.
- MUST create `tests/e2e/audit-fingerprint.ts` exporting `AuditType = "content" | "app"`, `formatFingerprint(type, counts): string`, and `FINGERPRINT_GREP_LITERAL` constant per TechSpec "Core Interfaces" section.
- MUST refactor `app/lib/content-audit/reporter.server.ts` to import `formatFingerprint` from the shared module and use it where the fingerprint marker was previously inline. No behavior change visible in the generated SUMMARY.md or PR-comment output.
- MUST update `.github/workflows/content-audit.yml` to use the literal-string constant for `body-includes` matching (use `grep -F` semantics; no regex).
- MUST verify content-audit's existing Vitest suite continues to pass unchanged after the refactor.
- MUST NOT modify the existing `SUMMARY.md` rows (Type column comes in task_18).
- SHOULD pin `@lhci/cli` to a version compatible with the Playwright Chromium version pinned in task_01.
</requirements>

## Subtasks

- [x] 16.1 Run `bun add -D @axe-core/playwright @lhci/cli` and commit the updated `package.json` + `bun.lock`.
- [x] 16.2 Create `tests/e2e/audit-fingerprint.ts` with the three exports per TechSpec "Core Interfaces → audit-fingerprint.ts".
- [x] 16.3 Refactor `app/lib/content-audit/reporter.server.ts` to import `formatFingerprint` from the new module; remove inline fingerprint construction.
- [x] 16.4 Update `.github/workflows/content-audit.yml`'s PR-comment step to use `body-includes` with the literal `<!-- audit-fingerprint:` substring (matches both `:content:` and future `:app:`).
- [x] 16.5 Add `app/tests/audit-fingerprint.test.ts` covering `formatFingerprint("content", {...})`, `formatFingerprint("app", {...})`, and `FINGERPRINT_GREP_LITERAL` value.
- [x] 16.6 Run `make test lint check lint-tests` locally; assert all green.

## Implementation Details

See TechSpec "Build Order Phase 4 — steps 40-43" and "Core Interfaces → tests/e2e/audit-fingerprint.ts". The fingerprint module is the single source of truth referenced by ADR-006 for centralized fingerprint generation; the content-audit refactor is co-located to verify backward compatibility before task_17's app-audit code lands.

### Relevant Files

- `package.json` — devDependency block; existing audit-content + Playwright deps present from Phases 1-3.
- `bun.lock` — frozen lockfile; new entries for `@axe-core/playwright` + `@lhci/cli` + transitive `lighthouse`.
- `app/lib/content-audit/reporter.server.ts` — current inline fingerprint construction at the PR-comment output path (round 2 issue 004 fix); refactor target.
- `.github/workflows/content-audit.yml` — current `body-includes` value uses an inline literal; refactor to import-via-comment for human readability.
- `tests/e2e/audit-fingerprint.ts` — NEW file; lives in `tests/e2e/` per TechSpec "Component Overview" (shared by both audit reporters).
- `app/tests/audit-fingerprint.test.ts` — NEW Vitest file.

### Dependent Files

- `app/lib/app-audit/reporter.server.ts` (task_18) — will import `formatFingerprint("app", ...)` from the same module.
- `.github/workflows/app-audit.yml` (task_19) — will use the same `FINGERPRINT_GREP_LITERAL` substring matching pattern.

### Related ADRs

- [ADR-005: Revive app-audit as Phase 4](../adrs/adr-005.md) — establishes Phase 4 scope including shared fingerprint surface.
- [ADR-006: TechSpec implementation primitives for Phase 4](../adrs/adr-006.md) — locks the counts-only fingerprint shape + literal-string grep semantics.

## Acceptance Criteria

1. **AC-1**: `bun install --frozen-lockfile` exits 0 after the new lockfile is committed; `bunx lhci --version` and `bunx @axe-core/playwright --version` (if applicable) both resolve.
2. **AC-2**: `tests/e2e/audit-fingerprint.ts` exists with the three exports declared in TechSpec "Core Interfaces"; TypeScript signatures match.
3. **AC-3**: Running content-audit produces a PR comment + SUMMARY.md row identical to the pre-refactor output (byte-for-byte except for any normalization the refactor introduces; verified by snapshot test).
4. **AC-4**: The `body-includes` value in `.github/workflows/content-audit.yml` is a literal substring matching the fingerprint prefix; manual review confirms no regex semantics.
5. **AC-5**: All existing content-audit Vitest tests pass without modification (no behavior change downstream of the refactor).

## Deliverables

- Modified `package.json` and `bun.lock` (2 new devDeps).
- New file `tests/e2e/audit-fingerprint.ts`.
- Modified `app/lib/content-audit/reporter.server.ts` (refactor — no behavior change).
- Modified `.github/workflows/content-audit.yml` (literal-string `body-includes`).
- New file `app/tests/audit-fingerprint.test.ts`.
- Unit tests with 80%+ coverage **(REQUIRED)**.
- Integration tests for content-audit reporter snapshot **(REQUIRED)** — verifies refactor introduced no behavior change.

## Tests

- Unit tests:
  - [ ] `formatFingerprint("content", { blocker: 0, major: 3 })` returns exact literal `<!-- audit-fingerprint:content:blocker=0 major=3 -->`.
  - [ ] `formatFingerprint("app", { blocker: 1, major: 5 })` returns exact literal `<!-- audit-fingerprint:app:blocker=1 major=5 -->`.
  - [ ] `FINGERPRINT_GREP_LITERAL` equals `<!-- audit-fingerprint:` exactly.
  - [ ] TypeScript: `AuditType` union accepts only `"content"` and `"app"` (compile-time check via `type Test = AuditType extends "content" | "app" ? true : false`).
- Integration tests:
  - [ ] Snapshot test: run content-audit on a fixture, assert PR-comment body matches the prior committed snapshot byte-for-byte (refactor is behavior-preserving).
  - [ ] Workflow YAML parse asserts `body-includes` value starts with `<!-- audit-fingerprint:`.
- Test coverage target: >=80%.
- All tests must pass.

## Success Criteria

- All tests passing.
- Test coverage >=80% over `tests/e2e/audit-fingerprint.ts`.
- Content-audit's existing Vitest tests pass unchanged.
- New `bun.lock` reproducible across local + CI environments.
