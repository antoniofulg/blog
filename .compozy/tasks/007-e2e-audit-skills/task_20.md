---
status: completed
title: App-audit SKILL + slash alias + fe-audit.md + AGENTS + cicd updates
type: docs
complexity: low
dependencies:
    - task_19
feature: audit/app-audit-skill-docs
---

# Task 20: App-audit SKILL + slash alias + fe-audit.md + AGENTS + cicd updates

## Overview

Ship the `app-audit` agent skill as the canonical entrypoint for FE-runtime audit operations. Add the `.claude/skills/app-audit` symlink, `/app-audit` slash-command alias, new `.agents/rules/fe-audit.md` rule file documenting the 12 categories (11 from ADR-005 + `sweep-error` from ADR-006) + severities + abort condition + triage workflow, and AGENTS.md + cicd.md updates. Closes Phase 4.

<critical>
- ALWAYS READ the PRD and TechSpec before starting
- REFERENCE TECHSPEC for implementation details — do not duplicate here
- FOCUS ON "WHAT" — describe what needs to be accomplished, not how
- MINIMIZE CODE — show code only to illustrate current structure or problem areas
- TESTS REQUIRED — every task MUST include tests in deliverables
</critical>

<requirements>
- MUST create `.agents/skills/app-audit/SKILL.md` with YAML frontmatter (`name: app-audit`, descriptive `description` with anti-trigger phrases per Skills 2.0, `allowed-tools`) and a body covering: scope (fuzzer pattern; site-model as classifier), 12 categories, severity scheme (blocker / major / minor), output paths, Lighthouse default behavior (ON locally / OFF in CI), `--lighthouse` flag opt-out, invocation surfaces (`/app-audit`, `bun run audit:fe`, `make audit-fe`, composite `make audit`), abort condition (3 consecutive zero-actionable runs).
- MUST create the symlink `.claude/skills/app-audit -> ../../.agents/skills/app-audit`.
- MUST create the slash-command file `.claude/commands/app-audit.md` as a thin wrapper invoking the SKILL.md.
- MUST create `.agents/rules/fe-audit.md` covering: output location (`docs/_reports/app-audit-YYYY-MM-DD.md` + `docs/audits/SUMMARY.md` Type column), severity scheme + thresholds, all 12 category definitions, finding row format, abort condition (3-run threshold per ADR-005), triage workflow (every blocker fixed within 7 days OR escalated OR retire-or-suppress), Lighthouse variance management notes (link to future follow-up PRD entry criteria).
- MUST update `AGENTS.md`: Skill Map adds new row `App-audit | app-audit (fuzzer; browser sweep + a11y + Lighthouse)`; Rules list adds `Audit (FE runtime): .agents/rules/fe-audit.md`. File Structure block already lists `docs/_reports/` + `docs/audits/` from Phase 3 (no change).
- MUST update `.agents/rules/cicd.md` to document the app-audit workflow trigger paths + `lighthouse` input + that no new GitHub Secrets are required (reuses Phase 1 secrets if admin routes are walked).
- MUST NOT touch `CLAUDE.md` (symlink to AGENTS.md).
- SHOULD reference `e2e-coverage` and `content-audit` skills explicitly as non-overlapping companions in the SKILL.md "Related" section.
- SHOULD keep SKILL.md body under 200 lines (Caveman-mode terseness preference per user CLAUDE.md).
</requirements>

## Subtasks

- [x] 20.1 Create `.agents/skills/app-audit/SKILL.md` with frontmatter + body.
- [x] 20.2 Create symlink `.claude/skills/app-audit -> ../../.agents/skills/app-audit`.
- [x] 20.3 Create `.claude/commands/app-audit.md` slash-command thin wrapper.
- [x] 20.4 Create `.agents/rules/fe-audit.md` covering all required sections per requirements block.
- [x] 20.5 Update `AGENTS.md` Skill Map + Rules list rows.
- [x] 20.6 Update `.agents/rules/cicd.md` with app-audit workflow documentation.
- [ ] 20.7 Run final Phase 4 checkpoint per TechSpec step 59: `make audit` locally; verify report + SUMMARY migration + 12 categories in report shape.

## Implementation Details

See TechSpec "Build Order Phase 4 — steps 54-59". The skill packaging mirrors content-audit (canonical at `.agents/skills/<name>/`, symlinked at `.claude/skills/<name>`, slash command at `.claude/commands/<name>.md`). The SKILL.md description's auto-trigger lexicon should be narrow ("audit FE", "browser sweep", "find runtime bugs", "check meta tags", "find hydration mismatches", "run app-audit") with explicit anti-triggers ("general review", "audit code", "audit security") matching the e2e-coverage and content-audit SKILL.md patterns.

### Relevant Files

- `.agents/skills/e2e-coverage/SKILL.md` (task_08) — sibling skill; reference for structure, tone, frontmatter shape.
- `.agents/skills/content-audit/SKILL.md` (task_15) — sibling skill; reference for the audit-shaped SKILL.md pattern (categories table, severity table, output paths, abort condition).
- `.agents/rules/testing.md` (task_08), `.agents/rules/audit.md` (task_15) — sibling rule files; reference for length, tone, and structure.
- `.agents/rules/git-workflow.md`, `.agents/rules/cicd.md`, `.agents/rules/db.md`, `.agents/rules/components.md` — additional tone/structure references.
- `AGENTS.md` — Skill Map + Rules list blocks; one-line addition to each.
- `scripts/audit-fe.ts` (task_19) — referenced in SKILL.md as the CLI surface.
- `.github/workflows/app-audit.yml` (task_19) — referenced in cicd.md update.

### Dependent Files

- None — this task closes Phase 4. Subsequent work (post-merge to main) consumes the published skill via slash command or by name in conversation.

### Related ADRs

- [ADR-005: Revive app-audit as Phase 4](../adrs/adr-005.md) — defines the entire scope this skill documents (categories, severities, abort condition).
- [ADR-006: TechSpec implementation primitives for Phase 4](../adrs/adr-006.md) — defines Lighthouse default behavior + sweep-error category + fingerprint scheme to document in `.agents/rules/fe-audit.md`.

## Acceptance Criteria

1. **AC-1**: `.agents/skills/app-audit/SKILL.md` exists with valid YAML frontmatter (parseable by `gray-matter`); `name`, `description`, `allowed-tools` fields populated.
2. **AC-2**: `.claude/skills/app-audit` is a symbolic link (verified via `fs.lstat().isSymbolicLink() === true`) pointing to `../../.agents/skills/app-audit`.
3. **AC-3**: `.claude/commands/app-audit.md` exists and contains a directive invoking the SKILL.md.
4. **AC-4**: `.agents/rules/fe-audit.md` documents all 12 categories (11 from ADR-005 + `sweep-error`), the severity scheme, output paths, abort condition (3 runs), and triage workflow.
5. **AC-5**: `AGENTS.md` contains a row in the Skill Map block referencing `app-audit` and a pointer in the Rules list referencing `.agents/rules/fe-audit.md`.
6. **AC-6**: `.agents/rules/cicd.md` documents the app-audit workflow trigger paths + `lighthouse` input.
7. **AC-7**: Phase 4 checkpoint runs locally: `make audit` produces both content-audit + app-audit reports; SUMMARY.md has the migrated `Type` column with both `content` and `app` rows present.

## Deliverables

- New files: `.agents/skills/app-audit/SKILL.md`, `.agents/rules/fe-audit.md`, `.claude/commands/app-audit.md`.
- New symlink: `.claude/skills/app-audit`.
- Modified files: `AGENTS.md`, `.agents/rules/cicd.md`.
- Unit tests with 80%+ coverage **(REQUIRED)** — docs-only task; coverage satisfied vacuously.
- Integration tests for skill invocation **(REQUIRED)** — verified by manual `/app-audit` invocation + Phase 4 checkpoint run.

## Tests

- Unit tests:
  - [x] Vitest test reads `.agents/skills/app-audit/SKILL.md`, parses YAML frontmatter via `gray-matter`, asserts `name === "app-audit"` + non-empty `description` + non-empty `allowed-tools` array.
  - [x] Vitest test asserts `.claude/skills/app-audit` exists and is a symbolic link (`fs.lstat`).
  - [x] Vitest test asserts `.agents/rules/fe-audit.md` contains required strings: each of the 12 category names, "blocker", "major", "minor", "3 consecutive", "Triage Workflow", "Lighthouse".
  - [x] Vitest test asserts `AGENTS.md` contains strings: `app-audit`, `.agents/rules/fe-audit.md`.
  - [x] Vitest test asserts `.agents/rules/cicd.md` contains strings: `app-audit.yml`, `lighthouse`, `pull_request.paths`.
- Integration tests:
  - [ ] Manual `/app-audit` invocation on a clean conversation triggers the SKILL.md (verified once before declaring Phase 4 done).
  - [ ] Phase 4 checkpoint: `make audit` runs against current main, produces `docs/_reports/content-audit-*.md` + `docs/_reports/app-audit-*.md` + 2 SUMMARY.md rows (one `content`, one `app`).
- Test coverage target: >=80% (vacuously satisfied; docs-only task).
- All tests must pass.

## Success Criteria

- All tests passing.
- `/app-audit` slash command auto-invokes the SKILL.md on documented trigger phrases.
- Symlink resolves correctly from both `.claude/skills/app-audit` paths.
- New rules + AGENTS updates merge cleanly with no format errors.
- Phase 4 checkpoint produces a complete report set and SUMMARY.md migration is byte-stable.
- Branch ready for final PR to `main` covering Phases 1-4.
