---
status: pending
title: content-audit SKILL + slash alias + audit.md + AGENTS updates
type: docs
complexity: low
dependencies:
  - task_13
  - task_14
feature: audit/skill-docs
---

# Task 15: content-audit SKILL + slash alias + audit.md + AGENTS updates

## Overview

Ship the `content-audit` agent skill as the canonical entrypoint for content sweep operations. Add the matching `.claude/skills/content-audit` symlink, the `/content-audit` slash-command alias, the new `.agents/rules/audit.md` rule file documenting the categories + severities + abort condition + output paths, and `AGENTS.md` updates (File Structure, Skill Map, Rules list). Closes Phase 3.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `.agents/skills/content-audit/SKILL.md` with YAML frontmatter (name, description, allowed-tools) and a body covering: scope (MDX walker, no browser session), categories, severities, output paths (`docs/_reports/content-audit-YYYY-MM-DD.md` + `docs/audits/SUMMARY.md`), `noTranslation: true` opt-out, invocation (`/content-audit` or `bun run audit:content`), abort condition (two consecutive zero-actionable-finding runs → evaluate retirement).
- MUST create the symlink `.claude/skills/content-audit -> ../../.agents/skills/content-audit`.
- MUST create the slash-command file `.claude/commands/content-audit.md` as a thin wrapper invoking the SKILL.md.
- MUST create `.agents/rules/audit.md` covering: output location, severity scheme, coverage matrix (anonymous × admin × locale × route group is OBSOLETE — content-audit is filesystem-only; rules file documents content-audit's actual matrix), category definitions, abort condition, finding-row format.
- MUST update `AGENTS.md`: File Structure block (add `docs/_reports/`, `docs/audits/`), Skill Map (new row: "App audit" → content-audit with note on scope), Rules list (add audit pointer).
- MUST NOT touch `CLAUDE.md` (symlink to AGENTS.md).
- SHOULD reference the existing `a11y-testing` skill explicitly as a non-overlapping companion (audit ≠ a11y).
</requirements>

## Subtasks

- [ ] 15.1 Create `.agents/skills/content-audit/SKILL.md` with frontmatter + body.
- [ ] 15.2 Create symlink `.claude/skills/content-audit -> ../../.agents/skills/content-audit`.
- [ ] 15.3 Create `.claude/commands/content-audit.md` slash-command file.
- [ ] 15.4 Create `.agents/rules/audit.md`.
- [ ] 15.5 Update `AGENTS.md` File Structure + Skill Map + Rules list blocks.

## Implementation Details

See TechSpec "Build Order steps 35-38" and PRD-007 User Stories ("As the developer, I want to invoke `/content-audit` ad-hoc before promoting a draft post"). The SKILL.md description must auto-trigger on phrases like "audit content" / "check translations" / "find broken links" but NOT on generic "review" or "audit code" phrases.

### Relevant Files

- `.agents/skills/e2e-coverage/SKILL.md` (task_08) — sibling skill; reference for structure + tone.
- `.agents/skills/a11y-testing/SKILL.md` — existing skill; reference for frontmatter shape.
- `.agents/rules/testing.md` (task_08) — sibling rule file; reference for length + tone.
- `.agents/rules/git-workflow.md`, `cicd.md`, `db.md` — additional tone/structure references.
- `AGENTS.md` — File Structure block + Skill Map block + Rules list block; one-line addition to each.
- `scripts/audit-content.ts` (task_13) — referenced in SKILL.md as the CLI surface.

### Dependent Files

- None — this task closes Phase 3.

### Related ADRs

- [ADR-002: Pivot audit skill from browser-sweep to content-audit](../adrs/adr-002.md) — defines the entire scope this skill documents.
- [ADR-003: PRD scope and phased delivery model](../adrs/adr-003.md) — Phase 3 final task.

## Acceptance Criteria

1. **AC-1**: `.agents/skills/content-audit/SKILL.md` exists with valid YAML frontmatter (`name: content-audit`, descriptive `description`, `allowed-tools` list).
2. **AC-2**: `.claude/skills/content-audit` is a symlink resolving to `../../.agents/skills/content-audit`.
3. **AC-3**: `.claude/commands/content-audit.md` exists and invokes the SKILL.md.
4. **AC-4**: `.agents/rules/audit.md` documents the 5 categories, severity mapping, output paths, abort condition, and explicitly clarifies that content-audit does NOT replace `a11y-testing`.
5. **AC-5**: `AGENTS.md` File Structure block lists `docs/_reports/` and `docs/audits/`; Skill Map has a row for `content-audit`; Rules list links to `.agents/rules/audit.md`.
6. **AC-6**: The SKILL.md body explicitly notes that `app-audit` (browser-sweep) is the V2 pivot if `content-audit` hits the abort condition.

## Deliverables

- New files: `.agents/skills/content-audit/SKILL.md`, `.agents/rules/audit.md`, `.claude/commands/content-audit.md`.
- New symlink: `.claude/skills/content-audit`.
- Modified `AGENTS.md`.
- Unit tests with 80%+ coverage **(REQUIRED)** — docs-only task; vacuously satisfied.
- Integration tests for skill invocation **(REQUIRED)** — verified by manual `/content-audit` invocation.

## Tests

- Unit tests:
  - [ ] Vitest test reads `.agents/skills/content-audit/SKILL.md`, parses frontmatter, asserts required fields.
  - [ ] Vitest test asserts `.claude/skills/content-audit` is a symbolic link to `../../.agents/skills/content-audit`.
  - [ ] Vitest test asserts `.agents/rules/audit.md` contains strings: "translation-gap", "broken-link", "missing-alt-text", "series-gap", "frontmatter-invalid", "abort condition".
  - [ ] Vitest test asserts `AGENTS.md` contains "docs/_reports/", "docs/audits/", "content-audit", ".agents/rules/audit.md".
- Integration tests:
  - [ ] Manual `/content-audit` invocation on a clean conversation triggers the SKILL.md (verified once before merging Phase 3).
  - [ ] Slash-command alias resolves to the same SKILL.md content.
- Test coverage target: >=80% (vacuously satisfied; docs-only).
- All tests must pass.

## Success Criteria

- All tests passing.
- `/content-audit` slash command auto-invokes the SKILL on content-audit trigger phrases.
- Symlink resolves correctly.
- Rules + AGENTS updates merge cleanly with no format errors.
- Phase 3 closes with the first audit run producing a valid baseline SUMMARY row.
