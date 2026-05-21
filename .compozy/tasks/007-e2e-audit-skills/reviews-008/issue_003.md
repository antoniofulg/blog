---
provider: manual
pr:
round: 8
round_created_at: 2026-05-20T04:53:28Z
status: resolved
file: app/lib/app-audit/checks.server.ts
line: 1
severity: low
author: claude-code
provider_ref:
---

# Issue 003: sweep-error category overloaded — preflight failure mixed with per-route probe failures

## Review Comment

The latest report shows a preflight failure emitted under the `sweep-error` category with `filePath: "preflight"`:

```
## sweep-error
- **sweep-error** (`preflight`)
  - [app-audit] baseUrl http://localhost:4173 unreachable
```

ADR-006 introduced `sweep-error` for per-route probe failures (Playwright timeout, browser crash, fixture failure). The category was scoped to "per-inspection probe-infrastructure failure" and explicitly excluded from the abort-condition count (rationale: probe-infra, not site quality).

The preflight failure has a different shape:

- **Scope**: global (whole audit), not per-route.
- **Cause**: external precondition (server not running), not probe-infrastructure.
- **Triage path**: user fixes their environment (start preview), not the site or the probe code.
- **Severity intent**: should be `blocker` (per round 8 issue 001) — currently emitted as `major` matching per-route convention.

Mixing both shapes in one category creates triage confusion:

- A report with 5 `sweep-error` findings — were they all probe-infra failures on real routes (one cause), or one preflight failure repeated × N (a different cause)? Today the developer must inspect `filePath` to disambiguate.
- The abort-condition rule in `.agents/rules/fe-audit.md` excludes `sweep-error` from the actionable count. A preflight failure should ALSO not count, but for different reasons (it didn't represent a site issue, just an env issue). The current `sweep-error` blanket exclusion happens to handle this correctly by accident, but the semantic overload could break in a future revision (e.g. someone decides probe-infra sweep-errors should count after all).

**Suggested fix:** introduce a dedicated `preflight-error` category in `AppAuditCategory` union (per TechSpec Core Interfaces). Update:

1. `app/lib/app-audit/checks.server.ts` — preflight emits `category: "preflight-error", severity: "blocker"` (per round 8 issue 001).
2. `app/lib/app-audit/reporter.server.ts` — adds `## preflight-error` section to the 12-category layout; updates SUMMARY row "top finding" logic to surface preflight failures distinctly.
3. `.agents/rules/fe-audit.md` — documents the new category, severity, and that it (a) is a blocker (audit unusable), (b) is excluded from abort-condition count for the same reason as `sweep-error`, but for distinct semantic reasons (env issue, not site issue).
4. ADR-007 (or amendment to ADR-006) — documents the category split for the historical record.

Alternative: keep the single `sweep-error` category but add a `subtype: "preflight" | "probe"` field on the finding for downstream triage tools to differentiate. Lighter touch; less explicit.

This is a LOW severity because the current behavior is technically correct (signal is delivered, exit code surfaces — assuming issue 001 fix), just less clean than it could be.

## Triage

- Decision: `valid`
- Notes: Implemented as suggested. Added `"preflight-error"` to `AppAuditCategory` union in `browser-sweep.server.ts`. Changed emission in `checks.server.ts` to `category: "preflight-error", severity: "blocker"`. Updated `reporter.server.ts` to render `## preflight-error` section before the 12 route-inspection categories. Updated `.agents/rules/fe-audit.md` category table (added `preflight-error` row) and abort-condition exclusion (now excludes both `sweep-error` and `preflight-error` with distinct rationale). ADR entry deferred — no ADR directory found in this project; the fe-audit.md rule update serves as the canonical documentation.
