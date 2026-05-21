---
provider: manual
pr:
round: 14
round_created_at: 2026-05-20T22:56:13Z
status: resolved
file: docs/audits/SUMMARY.md
line: 36
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: Round-013 fix commit polluted `docs/audits/SUMMARY.md` with 8 test-pollution rows

## Review Comment

Commit `db179ae` (round-013 fix batch) inadvertently committed 8 new rows to `docs/audits/SUMMARY.md`:

```
@@ -36,3 +36,11 @@
+| 2026-05-20 | manual           | 0       | 0     | 0     | no findings                                  |
+| 2026-05-20 | app     | manual           | 0       | 0     | 10    | perf-budget-breach: Performance score 72 below threshold (80 |
+| 2026-05-20 | test-int-clean   | 0       | 0     | 0     | no findings                                  |
+| 2026-05-20 | test-int-blocker | 1       | 0     | 0     | frontmatter-invalid: Missing required frontmatter field: titl |
+| 2026-05-20 | test-int-clean   | 0       | 0     | 0     | no findings                                  |
+| 2026-05-20 | test-int-blocker | 1       | 0     | 0     | frontmatter-invalid: Missing required frontmatter field: titl |
+| 2026-05-20 | test-int-clean   | 0       | 0     | 0     | no findings                                  |
+| 2026-05-20 | test-int-blocker | 1       | 0     | 0     | frontmatter-invalid: Missing required frontmatter field: titl |
```

Three categories of pollution in those 8 rows:

1. **6 rows of integration-test pollution** (`test-int-clean`, `test-int-blocker`) — these are triggers from `app/tests/audit-content-cli.test.ts`'s subprocess integration suite. They should be isolated via the env-var override (`AUDIT_SUMMARY_PATH` to tmpdir) that landed in commit `67ada12`. Either the env-var isolation regressed, OR the integration test happened to run before the fix-reviews commit was captured.

2. **1 row of legacy-format pollution** (`| 2026-05-20 | manual | 0 | 0 | 0 | no findings`) — missing the `Type` column entirely. This violates the post-Phase-4 SUMMARY.md format that the `initSummary()` migration was supposed to enforce. Suggests a code path that writes to SUMMARY.md without going through the Phase-4-aware reporter.

3. **1 row of mis-aligned formatting** (`| 2026-05-20 | app | manual | 0 | 0 | 10 | perf-budget-breach: ...`) — extra space padding in the `Type` column (`app     |` instead of `app | `). Cosmetic inconsistency but contributes to drift.

The prior pattern established across commits `f6c9b8d`, `67ada12`, and the round-012 cleanup was to ALWAYS revert `docs/audits/SUMMARY.md` before committing fix-reviews batches, treating local audit runs as ephemeral and the committed file as a curated history. The round-013 commit broke that pattern.

## Why this matters

- **Audit history is the canonical operational record.** Per `.agents/rules/fe-audit.md`, `docs/audits/SUMMARY.md` is committed and serves as the multi-month abort-condition tracker (the rule for retiring `app-audit` once 3 consecutive runs find zero blockers). Test pollution rows inflate the row count without contributing real signal, making the abort condition unevaluable.
- **`test-int-*` rows are NOT real audit runs.** They're vitest fixtures meant to live in tmpdirs. Committing them implies the env-var isolation regressed silently — needs investigation.
- **The `app | manual | … 10 minor` row IS a real audit and IS useful** but it lives surrounded by garbage rows, making the canonical timeline unreadable at a glance.
- **Format drift compounds.** The legacy-format row (missing Type column) means any future grep / parse of SUMMARY.md must handle both shapes. Today simple regex; tomorrow it's a state machine.

## Suggested fix paths

### Path A — revert + investigate isolation regression (recommended)

```bash
# Restore SUMMARY.md to its pre-pollution state
git show 8a584d0:docs/audits/SUMMARY.md > docs/audits/SUMMARY.md   # or earlier known-clean commit
git add docs/audits/SUMMARY.md
git commit -m "fix(audit): revert SUMMARY.md pollution from round-013 batch"

# Then investigate why test-int-* rows got written despite AUDIT_SUMMARY_PATH override
grep -rn 'AUDIT_SUMMARY_PATH\|audit-rowcount\|test-int' app/tests/ tests/
```

### Path B — add a sentinel test that catches future pollution

Add a unit test that:
1. Runs `make test` in a subprocess (or imports the audit-content-cli test programmatically).
2. After test completion, asserts `docs/audits/SUMMARY.md` was NOT modified (compare git status before/after).

Would catch any future env-var isolation regression at PR-gate time.

### Path C — make SUMMARY.md path strictly required via env var (no default)

Currently `reporter.server.ts` defaults `SUMMARY_PATH` to `docs/audits/SUMMARY.md` when `AUDIT_SUMMARY_PATH` is unset. Removing the default forces every caller (test or production) to provide a path explicitly. Tests that forget will fail at write time with a clear error, rather than silently polluting the committed file.

Tradeoff: more friction for first-time setup but eliminates the silent-failure class.

## Recommendation

Path A first (clean the immediate damage), then Path C (prevent recurrence). Path B is a strong follow-up if the env-var isolation turns out to be flaky in other ways.

## Acceptance criteria

1. `git log --oneline docs/audits/SUMMARY.md` shows a revert commit removing the 8 polluted rows.
2. `grep -E 'test-int-(clean|blocker)' docs/audits/SUMMARY.md` returns zero matches.
3. `make test` in a fresh checkout does not modify `docs/audits/SUMMARY.md` (verified via `git diff --quiet docs/audits/SUMMARY.md` after the run).
4. Existing legitimate `app | manual | …` row(s) representing real audit history are preserved.
5. Optional (Path C): `reporter.server.ts` throws when `AUDIT_SUMMARY_PATH` is unset; production callers updated to pass `docs/audits/SUMMARY.md` explicitly.

## Triage

- Decision: `valid`
- Notes: `docs/audits/SUMMARY.md` (working tree) has 47 data rows — 40 are `test-int-*` or malformed 6-column rows missing the Type field. Root cause: `app/tests/audit-content-cli.test.ts` "exit 0" and "exit 1" integration tests call the audit subprocess without `AUDIT_SUMMARY_PATH`, so the content-audit reporter defaults to `docs/audits/SUMMARY.md` and appends rows. Fix: (A) rewrite SUMMARY.md to keep only properly-formatted, non-test rows; (C) pass `AUDIT_SUMMARY_PATH` pointing to a tmpdir in all subprocess test calls that currently omit it. Additional finding: the content-audit reporter format is 6-column (no Type) while app-audit is 7-column; the malformed rows are a second-order effect of this mismatch + missing AUDIT_SUMMARY_PATH isolation.
