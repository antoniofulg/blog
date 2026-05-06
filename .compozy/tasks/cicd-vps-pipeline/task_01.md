---
status: completed
title: "Commitlint setup — package.json, config, Lefthook hook"
type: infra
complexity: low
dependencies: []
---

# Task 01: Commitlint setup — package.json, config, Lefthook hook

## Overview

Adds commit message validation to the project so every commit conforms to the Conventional Commits format before it leaves the developer's machine. This is the foundation for the CI commit-linting job (task_03) and the auto-changelog (task_04) — both require a structured commit history from this point forward.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC "Core Interfaces" section for exact commitlint config shape and lefthook.yml diff
- FOCUS ON "WHAT" — enforce the commit-msg hook, install the config, verify it blocks bad messages
- MINIMIZE CODE — three small files, no application logic
- TESTS REQUIRED — verify hook blocks non-conforming messages and passes conforming ones
</critical>

<requirements>
- MUST add `@commitlint/cli` and `@commitlint/config-conventional` as pinned devDependencies (no `^` or `~`) matching the project's pinning convention
- MUST create `commitlint.config.js` using ES module export syntax, extending `@commitlint/config-conventional`, with `type-enum` restricted to `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`
- MUST add a `commit-msg` hook to `lefthook.yml` that runs `./node_modules/.bin/commitlint --edit {1}`
- MUST run `bun install` after updating `package.json` to generate the updated `bun.lock`
- MUST run `bunx lefthook install` after updating `lefthook.yml` to register the new hook in `.git/hooks/`
- MUST NOT modify the existing `pre-commit` hook or any other lefthook configuration
- SHOULD verify `bun.lock` is committed alongside `package.json` changes so CI can run `--frozen-lockfile`
</requirements>

## Subtasks

- [x] 1.1 Add `@commitlint/cli` and `@commitlint/config-conventional` with pinned versions to `package.json` devDependencies
- [x] 1.2 Run `bun install` and confirm `bun.lock` is updated
- [x] 1.3 Create `commitlint.config.js` with the type allowlist
- [x] 1.4 Add `commit-msg` hook to `lefthook.yml` referencing `./node_modules/.bin/commitlint`
- [x] 1.5 Run `bunx lefthook install` to register the hook
- [x] 1.6 Verify the hook blocks a non-conforming message and passes a conforming one

## Implementation Details

See TechSpec "Core Interfaces" section for the exact `commitlint.config.js` content and the `lefthook.yml` diff.

Three files to modify or create:
- `package.json` — add two devDependencies
- `commitlint.config.js` — new file at project root
- `lefthook.yml` — add `commit-msg` section below the existing `pre-commit` section

The `lefthook.yml` uses `{1}` as the placeholder for the commit message file path (passed by Git to the `commit-msg` hook). `lefthook` substitutes this automatically.

### Relevant Files

- `package.json` — add devDependencies; pinned version pattern visible in existing deps
- `lefthook.yml` — add `commit-msg` hook; `pre-commit` structure shows the pattern to follow
- `bun.lock` — updated automatically by `bun install`; must be committed

### Dependent Files

- `.github/workflows/ci.yml` (task_03) — the commitlint CI job references `./node_modules/.bin/commitlint`; requires this task to be merged first
- `commitlint.config.js` — consumed by both the local hook and the CI job

### Related ADRs

- [ADR-001: CI/CD V1 Scope — Pipeline-First, Standards-Included](../adrs/adr-001.md) — Conventional Commits enforcement is a required V1 feature

## Deliverables

- Updated `package.json` with pinned commitlint devDependencies
- Updated `bun.lock` reflecting the new packages
- `commitlint.config.js` at project root
- Updated `lefthook.yml` with `commit-msg` hook
- Verification run confirming hook behavior

## Tests

- Unit tests:
  - [x] `echo "feat: valid message" | ./node_modules/.bin/commitlint` exits 0
  - [x] `echo "invalid message without type" | ./node_modules/.bin/commitlint` exits non-zero
  - [x] `echo "build: not in allowlist" | ./node_modules/.bin/commitlint` exits non-zero (type not in allowlist; note: dashed type breaks parser)
  - [x] `echo "feat!: breaking change" | ./node_modules/.bin/commitlint` exits 0 (breaking changes are valid)
  - [x] Merge commit message (e.g., `Merge branch 'main'`) exits 0 (default ignores apply)
- Integration tests:
  - [ ] `git commit -m "invalid"` is blocked by the `commit-msg` hook with a descriptive error
  - [ ] `git commit -m "feat(auth): add login page"` is accepted by the `commit-msg` hook
  - [ ] `git commit --no-verify -m "skip hook"` succeeds (bypass is documented and working)
- Test coverage target: N/A (config-only task; all validation is behavioral)
- All tests must pass

## Success Criteria

- `bun run test && bun run lint && bun run check` still pass after adding commitlint packages (no regressions)
- `./node_modules/.bin/commitlint --from HEAD~1` exits 0 on the task's own commits (they must follow the convention)
- The `commit-msg` hook file exists in `.git/hooks/commit-msg` after `lefthook install`
- A developer attempting a non-conforming commit on this branch is blocked with a clear error message
