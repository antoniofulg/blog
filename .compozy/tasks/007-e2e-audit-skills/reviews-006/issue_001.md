---
provider: manual
pr:
round: 6
round_created_at: 2026-05-20T04:22:01Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 45
severity: medium
author: claude-code
provider_ref:
---

# Issue 001: Routes filter uses exact string match, no path normalization

## Review Comment

Round 5 issue 001 wired the `--routes` flag end-to-end. The filter at `app/lib/app-audit/checks.server.ts:45-49` uses `routeFilter.includes(r.path)` — exact string match against `RouteEntry.path` values from the inventory. The implementation does not normalize paths before comparison:

- User passes `--routes=/about/` (trailing slash); inventory has `/about` (no trailing slash) → filter matches zero entries → empty audit, no diagnostic.
- User passes `--routes=/About` (case); inventory has `/about` → filter matches zero entries silently.
- User passes `--routes=about` (missing leading slash) → filter matches zero entries silently.
- Empty filter result is treated as a successful no-op run rather than a misconfiguration signal.

Test coverage at `app/tests/app-audit-checks.test.ts:226-240` only exercises matching paths; no test for trailing-slash or empty-result cases. PRD-007's `--routes` user story expects intuitive route filtering; current behavior fails silently on benign input mistakes.

**Suggested fix:** add a normalizer before the comparison:

```ts
function normalizeRoutePath(p: string): string {
  let s = p.trim();
  if (!s.startsWith("/")) s = "/" + s;
  if (s.length > 1 && s.endsWith("/")) s = s.slice(0, -1);
  return s.toLowerCase(); // optional; depends on whether routes are case-sensitive
}
```

Apply on both sides of the comparison. After filtering, if `filteredRoutes.length === 0` AND `routeFilter` was non-empty, log a clear warning (`[app-audit] No routes matched filter: ${routeFilter.join(", ")}`) and exit with a non-zero code (or `sweep-error` finding) so the user sees the misconfiguration. Add Vitest tests for trailing-slash, missing-leading-slash, case mismatch, and zero-match cases.

## Triage

- Decision: `VALID`
- Notes: Confirmed at `checks.server.ts:48` — `routeFilter.includes(r.path)` is a raw exact-string comparison. No path normalization applied on either side. A trailing slash, missing leading slash, or case difference silently produces zero matches with no diagnostic. Fix: add `normalizeRoutePath()`, apply on both sides, and emit a `sweep-error` finding (not process exit) when the filter matches zero routes. Test coverage needed for trailing slash, missing leading slash, case mismatch, and zero-match scenarios.
