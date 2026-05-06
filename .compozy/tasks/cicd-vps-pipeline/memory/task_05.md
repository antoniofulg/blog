# Task Memory: task_05.md

Keep only task-local execution context here. Do not duplicate facts that are obvious from the repository, task file, PRD documents, or git history.

## Objective Snapshot

Configure GitHub repo settings and VPS environment to activate the CI/CD pipeline end-to-end. No code changes — all work is GitHub Settings UI and VPS terminal.

Deliverables:
- Five GitHub Secrets configured
- GitHub Ruleset active (branch naming regex)
- GHCR package set to public
- VPS deploy user in docker group
- First end-to-end CD run green + CHANGELOG.md created

## Important Decisions

- No code to write — task is purely manual config. Deliverable is a runbook + local validation evidence.
- Pre-existing `public-routes.test.ts` failure is known and unrelated.

## Learnings

- `scripts/deploy.sh` bash syntax is valid (`bash -n` passes).
- GitHub Ruleset regex validated locally: all 5 PASS cases and 6 BLOCK cases correct.
- All 9 `deploy-sh.test.ts` tests pass.
- `make lint` and `make check` (TypeScript) both clean.
- Code artifacts from tasks 01-04 are uncommitted on main — user must commit before first CD run.

## Pre-Commit Prerequisite

All code from tasks 01-04 is staged/untracked but NOT committed:
- staged: `scripts/deploy.sh`
- unstaged: `bun.lock`, `lefthook.yml`, `package.json`
- untracked: `.github/`, `app/tests/deploy-sh.test.ts`, `commitlint.config.js`

User must commit these to main before the CI/CD pipeline activates.

## Files / Surfaces

- `scripts/deploy.sh` — validated syntax only; no changes.
- `.github/workflows/cd.yml` — consumes the 5 secrets; no changes.
- `.github/workflows/ci.yml` — branch-check job; no changes.
- `app/tests/deploy-sh.test.ts` — all 9 tests green.

## Errors / Corrections

- None.

## Ready for Next Run

- All code artifacts verified correct (lint clean, types valid, deploy-sh tests 9/9).
- Runbook provided. Manual GitHub UI + VPS steps remain.
- Auto-commit disabled; diff left for manual review.
