---
name: task-19-memory
description: Task-local execution context for task_19 — app-audit CLI + workflow + Makefile + gitignore
metadata:
  type: project
---

# Task Memory: task_19 — COMMITTED

## Objective Snapshot

Created `scripts/audit-fe.ts` CLI entry point, `.github/workflows/app-audit.yml`, updated `package.json` + `Makefile` + `.gitignore`, and 2 test files (66 tests total).

## Important Decisions

- `parseLighthouse(args, ciEnv = process.env.CI)` accepts optional `ciEnv` parameter for direct testability — avoids env mutation in tests.
- `runAppAuditCli(args, env = process.env)` accepts optional `env` object for same reason.
- `--routes` flag parsed but not forwarded to `runAppAudit` (future-proofing; API doesn't support it yet).
- `app-audit` Makefile target is alias of `audit-fe` (delegates: `app-audit: audit-fe`).
- `body-includes: "<!-- audit-fingerprint:app:"` — uses app-specific type segment to avoid collisions with content-audit fingerprint.
- Workflow: explicit `--no-lighthouse` flag when `github.event.inputs.lighthouse != "true"` (not relying on CI env default).
- Preview server starts on port 4173 (vite preview default); AUDIT_BASE_URL set accordingly.
- Postgres service included in workflow (app needs DB for route responses).

## Files / Surfaces

- NEW: `scripts/audit-fe.ts`
- NEW: `.github/workflows/app-audit.yml`
- MODIFIED: `package.json` (2 new scripts: `audit:fe`, `audit`)
- MODIFIED: `Makefile` (3 new targets: `audit-fe`, `app-audit`, `audit`)
- MODIFIED: `.gitignore` (1 new pattern: `docs/_reports/app-audit-*.md`)
- NEW: `app/tests/audit-fe-cli.test.ts` (44 tests)
- NEW: `app/tests/app-audit-workflow.test.ts` (29 tests — incl. biome format fix applied)

## Learnings

- biome excludes `scripts/` — audit-fe.ts not checked by biome (same as audit-content.ts).
- `biome check` complained about `readFileSync(...)` multi-line format in workflow test — collapsed to single line.
- `biome check` complained about long `not.toContain(...)` line — wrapped to 2 lines.

## Errors / Corrections

- First biome run found 1 formatter error in `app-audit-workflow.test.ts` — fixed immediately.

## Ready for Next Run

task_19 DONE and committed. task_20 (SKILL.md + cicd.md update + AGENTS.md) is next.
