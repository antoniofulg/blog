---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: .github/workflows/content-audit.yml
line: 62
severity: high
author: claude-code
provider_ref:
---

# Issue 003: Severity counts parsed from CLI stdout via regex are fragile

## Review Comment

`.github/workflows/content-audit.yml:62-64` parses blocker/major/minor counts from `bun run audit:content`'s stdout using `grep -oP '\d+(?= blocker)'`. The script emits a single line via `console.log(summaryLine)` (`scripts/audit-content.ts:31,38`) with the literal format `[audit] N blocker / N major / N minor → docs/_reports/...`. Any change to the script's summary line — e.g., pluralizing to "blockers", swapping to JSON output, or adding a prefix — silently breaks the workflow's count extraction. The downstream PR comment (L120-122) then displays `0 / 0 / 0` regardless of actual findings, and the delta-suppression check (L97-103) compares the wrong values, causing suppression to misfire (either over- or under-commenting).

Workflow-to-script communication via free-text regex is the brittleness that PRD-007 F10's "delta-only" semantics depend on; the AC for task 14 explicitly cites delta suppression as a correctness target.

**Suggested fix:** emit a machine-readable line from `audit-content.ts` — for example, write `${{ github.workspace }}/audit-counts.env` containing `blockers=N\nmajors=N\nminors=N` and source it from the workflow via `cat audit-counts.env >> "$GITHUB_OUTPUT"`. Alternatively, have the script append a `<!-- audit-counts: {"blocker":N,"major":N,"minor":N} -->` marker to the report file and parse with `jq` in the workflow. Either path eliminates the stdout-format coupling.

## Triage

- Decision: `valid`
- Notes: Confirmed at `.github/workflows/content-audit.yml:62-64`. The workflow greps the human-readable summary line `[audit] N blocker / N major / N minor → ...` with `\d+(?= blocker)` etc. Any text change to `scripts/audit-content.ts`'s summary format silently produces `0/0/0` in the PR comment and breaks delta suppression. Fix: emit a dedicated `[audit-counts] blockers=N majors=N minors=N` line from the script (alongside the existing summary line so backward compat is preserved) and parse that specific line in the workflow with `grep '^[audit-counts]'` + `grep -oP 'key=\K\d+'`. Add `countsLine` field to `AuditResult` type and test it.
