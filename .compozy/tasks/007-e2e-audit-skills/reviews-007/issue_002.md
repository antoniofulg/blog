---
provider: manual
pr:
round: 7
round_created_at: 2026-05-20T04:43:24Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 41
severity: high
author: claude-code
provider_ref:
---

# Issue 002: Default baseUrl http://localhost:3000 mismatches Playwright preview port (4173)

## Review Comment

`app/lib/app-audit/checks.server.ts:40-41`:

```ts
const baseUrl =
  opts.baseUrl ?? process.env.AUDIT_BASE_URL ?? "http://localhost:3000";
```

The default falls back to port `3000` — the Vite dev server port. However, `playwright.config.ts` configures the e2e suite to run against `http://localhost:4173` (the Nitro preview port, started via `bun run scripts/e2e-server.ts`). PRD-007 user story for the pre-publish audit flow assumes `bun preview` is running, which uses **port 4173**.

The first real `make audit` execution (`docs/_reports/app-audit-2026-05-20.md`) shows 24 instances of:

```
goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/
```

— one per route × auth-state. The developer ran `make audit` against a preview server on 4173 (or no server at all), and every route failed silently with sweep-errors. The cascading axe failures (24 additional `sweep-error` findings for `about:blank` Execution-context-destroyed) follow directly from this misconfiguration (see issue_003 — axe should short-circuit when goto fails).

Three problems combine:

1. **Default port mismatch**: dev=3000, preview=4173. App-audit defaults to dev port; the user's primary use case (per PRD-007: "Optionally invokes /content-audit locally before pushing… invokes /app-audit interactively") matches preview-server context, not dev.
2. **Silent failure when no server reachable**: `chromium.launch()` succeeds; `page.goto()` fails per route with sweep-error. The developer sees a 60-finding report, not "no server reachable — start `bun preview` first."
3. **No `--baseUrl` autodiscovery**: round 6 issue 005 added the `--baseUrl` flag and `AUDIT_BASE_URL` env var. Neither is set by default; the documented helper path is still 5+ keystrokes for every run.

**Suggested fix** — three layers:

1. **Change default to `http://localhost:4173`** (preview port) matching the Playwright + Phase 4 user-story assumption. Update `runAppAudit` default + `scripts/audit-fe.ts` + `.agents/skills/app-audit/SKILL.md` + `.agents/rules/fe-audit.md`.
2. **Add a pre-flight reachability check**: before iterating the route matrix, `fetch(baseUrl)` (or `page.goto(baseUrl, { timeout: 3000 })` on a throwaway page). If unreachable, fail fast with an actionable error: `[app-audit] baseUrl ${baseUrl} unreachable — start preview server first (bun preview) or pass --baseUrl=<url>`.
3. **Document the port in `make audit-fe` help comment** so `make help` shows the assumption.

Add Vitest test that asserts `runAppAudit({ baseUrl: "http://localhost:99999" })` exits early with a clear preflight error, not 60 sweep-errors.

## Triage

- Decision: `valid`
- Root cause: default baseUrl hardcoded to 3000 (dev server), but preview/e2e runs on 4173. No pre-flight check before iterating routes → 60 sweep-error cascade when server unreachable.
- Fix: (1) change default to `http://localhost:4173`; (2) add preflight `fetch(baseUrl)` before route loop, fail fast with actionable error message on connection refused.
