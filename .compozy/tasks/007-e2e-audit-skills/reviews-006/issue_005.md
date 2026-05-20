---
provider: manual
pr:
round: 6
round_created_at: 2026-05-20T04:22:01Z
status: resolved
file: scripts/audit-fe.ts
line: 30
severity: low
author: claude-code
provider_ref:
---

# Issue 005: --baseUrl CLI flag missing; AUDIT_BASE_URL env var undocumented

## Review Comment

`runAppAudit` in `app/lib/app-audit/checks.server.ts:36-41` accepts an optional `baseUrl?` parameter, falling back to `process.env.AUDIT_BASE_URL ?? "http://localhost:3000"`. The CLI parser in `scripts/audit-fe.ts` exposes `--trigger`, `--routes`, `--lighthouse`, `--no-lighthouse` flags but NOT `--baseUrl`. Users wanting to audit a non-default URL (staging, production, custom port) must:

1. Discover the `AUDIT_BASE_URL` env var by reading the source (it is not documented in `.agents/skills/app-audit/SKILL.md` or `.agents/rules/fe-audit.md`).
2. Export it before invoking `bun run audit:fe`.

This is a CLI surface inconsistency: the function accepts the param, but the CLI does not expose it. A `--baseUrl=` flag is the standard ergonomic.

**Suggested fix:**

1. Add `parseBaseUrl(args)` helper mirroring `parseRoutes`:
   ```ts
   export function parseBaseUrl(args: string[]): string | undefined {
     const flag = args.find((a) => a.startsWith("--baseUrl="));
     return flag ? flag.slice("--baseUrl=".length) : undefined;
   }
   ```
2. Wire into `runAppAuditCli`: `const baseUrl = parseBaseUrl(args); await runAppAudit({ lighthouse, routes, baseUrl });`
3. Document both `--baseUrl` flag and `AUDIT_BASE_URL` env var in:
   - `.agents/skills/app-audit/SKILL.md` invocation section
   - `.agents/rules/fe-audit.md` configuration section
   - `make audit-fe` Makefile target help comment
4. Add a Vitest test for `parseBaseUrl()` covering normal, missing, and equals-in-URL (`--baseUrl=http://localhost:4173?debug=1`) cases.

## Triage

- Decision: `VALID`
- Notes: Confirmed in `scripts/audit-fe.ts` — `runAppAudit` at `checks.server.ts:36-41` accepts `baseUrl?` but `runAppAuditCli` at `audit-fe.ts:43` calls `runAppAudit({ lighthouse, routes })` without passing `baseUrl`. The env var `AUDIT_BASE_URL` is not documented anywhere in agent rules or SKILL.md. Fix: add `parseBaseUrl()` helper mirroring `parseRoutes`, wire it into `runAppAuditCli`, and document both `--baseUrl` flag and `AUDIT_BASE_URL` env var in SKILL.md invocation section and fe-audit.md. Add Vitest tests for `parseBaseUrl()` including equals-in-URL case.
