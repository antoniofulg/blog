---
provider: manual
pr:
round: 2
round_created_at: 2026-05-19T15:08:24Z
status: resolved
file: .agents/rules/audit.md
line: 34
severity: low
author: claude-code
provider_ref:
---

# Issue 004: Documented broken-link severity disagrees with implementation

## Review Comment

`.agents/rules/audit.md:34` documents the broken-link finding as severity `major`:

```
| `broken-link` | major | Internal link target (`[text](path)` or JSX `<Link ...>`) does not resolve. |
```

The implementation in `app/lib/content-audit/checks.server.ts:144` assigns severity based on publish state:

```ts
severity: post.isPublished ? "blocker" : "minor",
```

— blocker when the broken link is in a published post, minor when it is in a draft. Neither matches the doc's stated `major`. Tooling, abort-condition tracking (ADR-002), and developer expectations all depend on the rule file matching the code; the SUMMARY.md committed audit trail records `major` counts that include nothing from broken-link, while developers reading the rule file expect them to count broken links.

The same row also implies a single severity for the category, but `checks.server.ts` uses a conditional. The rules file should explicitly document the two-tier severity to match.

**Suggested fix:** update `.agents/rules/audit.md:34` to state `blocker (published) / minor (draft)` or split the row in two:

```
| `broken-link` (published) | blocker | Internal link target does not resolve in a published post. |
| `broken-link` (draft)     | minor   | Internal link target does not resolve in a draft post. |
```

Also revisit any aggregation table that totals counts per severity (e.g., L45-46 abort-condition table) to confirm the abort condition phrasing still reflects the actual emitted severities. No code change required; this is doc-only.

## Triage

- Decision: `valid`
- Root cause: `audit.md:34` lists `broken-link` severity as `major`. Implementation at `checks.server.ts:156` uses `post.isPublished ? "blocker" : "minor"` — two tiers, neither `major`. Doc and code are inconsistent; developers reading the rule file form wrong expectations.
- Fix applied (doc-only): Replaced the single `broken-link | major` row in the Category Definitions table with two rows: `broken-link (published) | blocker` and `broken-link (draft) | minor`. Abort-condition text unchanged — it correctly tracks `blocker + major = 0`; published broken links now count as blockers and still satisfy the condition.
