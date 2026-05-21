---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/content-audit/reporter.server.ts
line: 57
severity: medium
author: claude-code
provider_ref:
---

# Issue 005: formatSummaryRow top finding uses insertion order, not severity

## Review Comment

`formatSummaryRow` (`reporter.server.ts:57-60`) picks the "top finding" as `findings[0]`. The findings array is built by `runContentAudit` (`checks.server.ts:232-238`) in fixed insertion order: frontmatter → translation-gap → broken-link → missing-alt-text → series-gap. The result is that "top finding" reflects the order of check functions, not the most severe finding for the run.

Consider an audit that produces 0 `frontmatter-invalid`, 0 `translation-gap`, 1 `broken-link` (blocker, since post is published), and 5 `missing-alt-text` (major). `findings[0]` is the broken-link blocker only because `checkBrokenLinks` runs before `checkMissingAltText` in the orchestrator — which is correct in this case. But swap the order: 0 frontmatter, 3 translation-gap (major), 1 broken-link blocker (later in the array), and "top finding" becomes a translation-gap. The SUMMARY.md row thus underreports severity at a glance, defeating the paper-trail purpose of the committed summary (PRD-007 Goals: "Surface ≥80% of `blocker`-severity findings within 7 days").

**Suggested fix:** sort findings by severity-rank before taking the first: `const sevRank = { blocker: 0, major: 1, minor: 2 }; const top = [...findings].sort((a, b) => sevRank[a.severity] - sevRank[b.severity])[0]`. Add a unit test that runs the formatter on a fixture with severities in unsorted order and asserts the SUMMARY row's top finding column reflects the highest-severity entry.

## Triage

- Decision: `valid`
- Notes: Confirmed at `reporter.server.ts:57-60`. `findings[0]` is insertion-order-dependent, not severity-ordered. With the fixed insertion order (frontmatter → translation-gap → broken-link → alt-text → series-gap), a blocker broken-link finding would show correctly only if no earlier-checked category has findings, which is coincidental. Fix: sort a copy of the findings array by severity rank (`blocker=0, major=1, minor=2`) before picking index 0. Add a unit test with unsorted input asserting the top-finding column reflects the highest severity.
