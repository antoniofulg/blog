---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/content-audit/reporter.server.ts
line: 39
severity: medium
author: claude-code
provider_ref:
---

# Issue 004: Unescaped triggerLabel in markdown report and SUMMARY row

## Review Comment

`writeReport` renders `triggerLabel` directly into two markdown destinations: the per-run report header (`reporter.server.ts:39`) and a SUMMARY.md table row (`reporter.server.ts:63`). The label is sourced from CLI argv (`audit-content.ts:21`) or from a GitHub Actions environment expression (`content-audit.yml:54`). The CI path is constrained to `ci-pr-<number>` or `manual`, but the manual path can carry anything a developer passes via `--trigger=…`.

If a label contains a `|`, the SUMMARY table row's column boundaries break and downstream parsers (including the abort-condition tracker in ADR-002) misread the data. A literal newline (`\n`) ends the row mid-table, producing invalid markdown. A backtick can interrupt code spans in tools that re-render the file. None of these are exploitable in the CI workflow as it stands, but the manual entry point is the surface that "ad-hoc before promoting a draft" (PRD-007 user story) explicitly invokes — making this a real-world failure mode for the primary local use case.

**Suggested fix:** add a small `escapeMarkdownCell(s: string): string` helper that replaces `|`, `\n`, and `\r` with safe sentinels (e.g., `\|`, `<br>`, removed) before rendering into table cells, and strip newlines from the report header line. Apply it everywhere `triggerLabel` is interpolated. Add a unit test that passes labels containing pipes and newlines and asserts the rendered SUMMARY row still parses as a single valid table row.

## Triage

- Decision: `valid`
- Notes: Confirmed at `reporter.server.ts:39,63`. `triggerLabel` is interpolated raw into the report header and SUMMARY table cell. A pipe character breaks the table row; a newline produces invalid markdown. The manual `--trigger=` path is the primary exposure. Fix: add `escapeMarkdownCell(s)` helper that replaces `|` with `\|` and `\n`/`\r` with space, and apply it to `triggerLabel` in both interpolation sites. Add unit tests for pipe and newline labels.
