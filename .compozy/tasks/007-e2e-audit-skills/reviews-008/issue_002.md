---
provider: manual
pr:
round: 8
round_created_at: 2026-05-20T04:53:28Z
status: resolved
file: app/lib/app-audit/reporter.server.ts
line: 1
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Report shows "(none)" for 11 category sections when audit aborted at preflight

## Review Comment

The latest run aborted at preflight (issue_002 round 7 fix worked correctly). The generated `docs/_reports/app-audit-2026-05-20.md` still emits 11 category headers, each followed by `(none)`:

```markdown
## console-error
(none)

## hydration-mismatch
(none)

## network-fail
(none)

## broken-image
(none)
...
```

A reader scanning the report sees 11 "no findings" labels and reasonably infers "all 11 checks ran and passed." The truth is the opposite: zero checks ran. The only signal is the lone `sweep-error` in the `sweep-error` section at the bottom.

This is a signal-clarity issue. The single most important fact about this run — "no actual coverage was performed" — is buried under 11 misleading category placeholders. PRD-007 success metric "App-audit findings actioned: ≥70% within 7 days" depends on the developer reading reports and acting; misleading "all clean" headers undermine the actionability promise.

The reporter (`app/lib/app-audit/reporter.server.ts`) currently formats sections unconditionally. It doesn't distinguish between "audit ran the category, found no findings" and "audit aborted before this category ran."

**Suggested fix:** add a "Coverage" or "Audit Status" header to the report when preflight failed or when the orchestrator short-circuited. Concrete options:

1. **Top-of-report banner** when at least one `sweep-error` has `filePath: "preflight"`:
   ```markdown
   # App Audit — 2026-05-20

   **Trigger**: manual
   **Status**: ABORTED AT PREFLIGHT — no route inspections performed
   **Findings**: 1 (1 blocker / 0 major / 0 minor)  <!-- after issue 001 fix -->
   ```
   Then conditionally suppress the 11 category sections (or render them with an explicit `(audit aborted; not checked)` instead of `(none)`).

2. **Replace `(none)` with `(not checked — audit aborted)`** only when a preflight sweep-error was emitted; keep `(none)` when the category genuinely ran with zero findings.

3. **Skip empty sections entirely** when audit aborted. Trade-off: the report becomes shorter and the developer immediately sees the preflight error, but breaks the consistent "all 12 categories represented" shape from PRD-007 Phase 4 success criteria.

Option 1 is the most informative and preserves the 12-category-shape invariant. Add a Vitest test that asserts the report header contains "ABORTED AT PREFLIGHT" when findings include a preflight sweep-error.

## Triage

- Decision: `valid`
- Notes: Implemented option 1 + option 2 combined. In `reporter.server.ts`, `formatReport` now detects presence of a `preflight-error` finding (`isAborted` flag). When true: (1) status line becomes "**Status**: ABORTED AT PREFLIGHT — no route inspections performed"; (2) route-inspection category sections replace `(none)` with `(not checked — audit aborted)` via new `aborted` param in `formatCategorySection`; (3) `preflight-error` section is rendered first, showing the actual error. Detection now uses `category === "preflight-error"` (after issue 003 fix). Added 4 new Vitest tests: ABORTED banner present, `(not checked — audit aborted)` text, `(none)` absent when aborted, `preflight-error` section present.
