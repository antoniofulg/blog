---
provider: manual
pr:
round: 5
round_created_at: 2026-05-20T04:06:44Z
status: pending
file: scripts/audit-fe.ts
line: 36
severity: high
author: claude-code
provider_ref:
---

# Issue 001: --routes CLI flag parsed but never passed to runAppAudit (dead feature)

## Review Comment

`scripts/audit-fe.ts:9-13` defines `parseRoutes(args)` that extracts the `--routes=<csv>` flag into `string[] | undefined`. `runAppAuditCli` at L31-49 calls `parseRoutes()` is NOT called, and even if it were, `runAppAudit()` in `app/lib/app-audit/checks.server.ts:36-39` does NOT accept a `routes` parameter — only `{ lighthouse, baseUrl? }`. The flag is documented in TechSpec "API Endpoints → CLI flag conventions" and in PRD-007 user stories ("invoke `/app-audit` interactively for a targeted route subset via the `--routes` flag (e.g. `make audit-fe ROUTES=/login,/admin`)") but the implementation silently ignores it.

User-visible failure: developer invokes `bun run audit:fe --routes=/login` expecting a 1-route audit. Instead, the orchestrator iterates the full 28-inspection matrix (~5 min wall-clock with Lighthouse on), wastes CI minutes, and the developer cannot diagnose why scope filtering doesn't work without reading the source. PRD-007's "interactively for a targeted route subset" user story is unmet.

This is a high-severity correctness gap: the spec promises route filtering, the CLI advertises it, and the orchestrator does not implement it.

**Suggested fix:** extend `runAppAudit({ lighthouse, baseUrl?, routes? })` signature to accept an optional `routes?: string[]` array. When provided, `runAppAudit` filters `getRouteInventory()` results to entries whose `.path` matches one of the supplied paths. Update `runAppAuditCli` (audit-fe.ts:31) to call `parseRoutes(args)` and pass the result into `runAppAudit({ ..., routes })`. Add a Vitest test that asserts `--routes=/login` produces inspections only for `/login` × locales × auth-states (4 inspections, not 28). Update SKILL.md and `.agents/rules/fe-audit.md` to document the routes filter behavior.

## Triage

- Decision: `UNREVIEWED`
- Notes:
