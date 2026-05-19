---
status: completed
title: e2e-coverage SKILL + slash alias + testing.md + AGENTS updates
type: docs
complexity: low
dependencies:
  - task_05
feature: testing/e2e-skill-docs
---

# Task 08: e2e-coverage SKILL + slash alias + testing.md + AGENTS updates

## Overview

Ship the `e2e-coverage` agent skill as the canonical entrypoint for bootstrap/generation/run operations. Add the matching `.claude/skills/e2e-coverage` symlink, the `/e2e-coverage` slash-command alias, the new `.agents/rules/testing.md` rule file documenting conventions (selector hierarchy, wait strategy, naming, tags), the anti-pattern entry in `.agents/rules/auth.md` (e2e MUST use seeded user, never commit storageState), and `AGENTS.md` updates (File Structure, Skill Map, Rules list).

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `.agents/skills/e2e-coverage/SKILL.md` with YAML frontmatter (name, description, allowed-tools) and a body covering: bootstrap detection, route inventory diff, spec generation, run modes, tag taxonomy, hydration marker convention, fixture usage.
- MUST create the symlink `.claude/skills/e2e-coverage -> ../../.agents/skills/e2e-coverage`.
- MUST create the slash-command file `.claude/commands/e2e-coverage.md` (or the project-specific slash-command location) as a thin wrapper invoking the SKILL.md.
- MUST create `.agents/rules/testing.md` covering: Vitest vs. Playwright boundary, layout (`app/tests/` vs `tests/e2e/`), selector hierarchy (`getByRole > getByLabel > getByText > data-testid`; ban CSS selectors), wait strategy (ban `waitForTimeout`), tag taxonomy (`@smoke @admin @auth @flaky`), the 48h SLA rule.
- MUST update `.agents/rules/auth.md` with the anti-pattern entry — e2e MUST use the seeded test user from `E2E_ADMIN_EMAIL`/`E2E_ADMIN_PASSWORD`; never commit `storageState.json` or `.auth/` directory.
- MUST update `AGENTS.md`: File Structure block (add `tests/e2e/`), Skill Map (new row: "E2E test write/run" → e2e-coverage), Rules list (add testing pointer).
- MUST NOT touch `CLAUDE.md` (per project rules — it is a symlink to AGENTS.md).
- SHOULD keep SKILL.md body under 200 lines (Caveman-mode prompts are terse per user preference).
</requirements>

## Subtasks

- [x] 8.1 Create `.agents/skills/e2e-coverage/SKILL.md` with frontmatter + body.
- [x] 8.2 Create symlink `.claude/skills/e2e-coverage -> ../../.agents/skills/e2e-coverage`.
- [x] 8.3 Create `.claude/commands/e2e-coverage.md` slash-command file.
- [x] 8.4 Create `.agents/rules/testing.md`.
- [x] 8.5 Append anti-pattern entry to `.agents/rules/auth.md`.
- [x] 8.6 Update `AGENTS.md` File Structure + Skill Map + Rules list blocks.

## Implementation Details

See TechSpec "Build Order steps 18-23" and PRD-007 User Stories ("I want to invoke `/e2e-coverage` to bootstrap Playwright from scratch", "I want the e2e skill to generate specs for routes I haven't covered yet"). The SKILL.md description must be specific enough that auto-trigger fires on phrases like "generate e2e spec" / "playwright test" / "browser regression test" but NOT on conversational mentions of "testing".

### Relevant Files

- `.agents/skills/a11y-testing/SKILL.md` — frontmatter shape reference (existing skill in the same skills dir).
- `.agents/rules/auth.md` — current anti-patterns block; new entry appended at the bottom.
- `.agents/rules/git-workflow.md`, `.agents/rules/cicd.md`, `.agents/rules/db.md`, `.agents/rules/components.md`, `.agents/rules/routes.md` — reference for tone, structure, and length of rule files.
- `AGENTS.md` — File Structure block + Skill Map block + Rules list block; one-line addition to each.
- `tests/e2e/auth-flow.spec.ts` (task_05) — referenced in SKILL.md as the canonical pattern.

### Dependent Files

- `tests/e2e/admin-write.spec.ts` (task_09) — adheres to `.agents/rules/testing.md` conventions.
- `tests/e2e/public-read.spec.ts` (task_10) — adheres to `.agents/rules/testing.md` conventions.
- `.agents/skills/content-audit/SKILL.md` (task_15) — references this skill in delegation language ("e2e-coverage handles spec generation").

### Related ADRs

- [ADR-001: V1 scope and architecture](../adrs/adr-001.md) — SKILL packaging + slash alias.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — 48h SLA rule documented here.
- [ADR-004: TechSpec implementation primitives](../adrs/adr-004.md) — hydration marker, fixture pattern, selector hierarchy.

## Acceptance Criteria

1. **AC-1**: `.agents/skills/e2e-coverage/SKILL.md` exists with valid YAML frontmatter (`name: e2e-coverage`, descriptive `description`, `allowed-tools` list).
2. **AC-2**: `.claude/skills/e2e-coverage` is a symlink pointing to `../../.agents/skills/e2e-coverage` (resolved by `ls -l`).
3. **AC-3**: `.claude/commands/e2e-coverage.md` exists and invokes the SKILL.md.
4. **AC-4**: `.agents/rules/testing.md` documents the selector hierarchy, wait strategy ban, tag taxonomy, and 48h SLA.
5. **AC-5**: `.agents/rules/auth.md` contains a new line under Anti-Patterns mentioning "seeded test user" and "storageState.json".
6. **AC-6**: `AGENTS.md` File Structure block lists `tests/e2e/`; Skill Map has a row for `e2e-coverage`; Rules list links to `.agents/rules/testing.md`.

## Deliverables

- New files: `.agents/skills/e2e-coverage/SKILL.md`, `.agents/rules/testing.md`, `.claude/commands/e2e-coverage.md`.
- New symlink: `.claude/skills/e2e-coverage`.
- Modified files: `.agents/rules/auth.md`, `AGENTS.md`.
- Unit tests with 80%+ coverage **(REQUIRED)** — docs-only task; coverage is satisfied vacuously.
- Integration tests for skill invocation **(REQUIRED)** — verified by manual `/e2e-coverage` invocation on a fixture branch.

## Tests

- Unit tests:
  - [ ] Vitest test reads `.agents/skills/e2e-coverage/SKILL.md`, parses YAML frontmatter, asserts required fields are present.
  - [ ] Vitest test asserts `.claude/skills/e2e-coverage` exists and is a symbolic link to `../../.agents/skills/e2e-coverage` (use `fs.lstat`).
  - [ ] Vitest test asserts `.agents/rules/testing.md` contains the exact strings "getByRole", "waitForTimeout", "@smoke", "48".
  - [ ] Vitest test asserts `.agents/rules/auth.md` contains the strings "seeded test user" and "storageState.json".
  - [ ] Vitest test asserts `AGENTS.md` contains the strings "tests/e2e/", "e2e-coverage", and ".agents/rules/testing.md".
- Integration tests:
  - [ ] Manual `/e2e-coverage` invocation on a clean conversation triggers the skill (verified once before merging Phase 1).
- Test coverage target: >=80% (vacuously satisfied; no source code).
- All tests must pass.

## Success Criteria

- All tests passing.
- `/e2e-coverage` slash command auto-invokes the SKILL on test trigger phrases.
- Symlink resolves correctly from both `.claude/skills/e2e-coverage` paths.
- New rules + AGENTS updates merge cleanly with no Biome/format errors.
