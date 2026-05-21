---
provider: manual
pr:
round: 1
round_created_at: 2026-05-19T14:14:47Z
status: resolved
file: app/lib/content-audit/checks.server.ts
line: 212
severity: high
author: claude-code
provider_ref:
---

# Issue 001: checkSeriesGaps stops at first gap, hides downstream gaps

## Review Comment

`checkSeriesGaps` (`app/lib/content-audit/checks.server.ts:202-214`) iterates the sorted parts of a series and emits a finding the first time `parts[i] !== i + 1`, then `break`s out of the loop. As a result, a series with parts `[1, 3, 5]` only reports part 2 as missing — part 4 is never flagged. The same is true for any series with two or more non-contiguous gaps; only the lowest is surfaced.

This is a functional gap in F9 (`content-audit` series-gap check) defined by PRD-007 and ADR-002. The audit's job is to surface every actionable finding so the developer can fix them in one pass; suppressing later gaps forces multiple audit cycles to fully repair a series and makes "consecutive zero-finding runs" (the abort condition in ADR-002) effectively unreachable until each fix re-runs the audit.

**Suggested fix:** remove the `break` and continue scanning. Track the expected next part as a counter and emit a finding for every missing `expected` value not present in `parts`. Each finding's `detail.expectedPart` already identifies the specific gap. Add a unit test fixture with a series like `[1, 3, 5]` and assert two findings (parts 2 and 4) instead of one.

## Triage

- Decision: `valid`
- Notes: Confirmed at `checks.server.ts:212`. The `break` exits the loop after the first gap, so parts [1,3,5] only surfaces the missing part 2. Fix: replace position-based loop with a Set-based scan from 1..maxPart-1, emitting a finding for every absent expected part. Existing test for [1,3] expects 1 finding — still correct. Need new test for [1,3,5] asserting 2 findings (parts 2 and 4). Also update `filePath` attribution to use `sorted[0].filePath` since a missing part has no associated file.
