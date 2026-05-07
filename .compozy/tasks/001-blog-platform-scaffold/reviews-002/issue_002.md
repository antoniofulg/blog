---
provider: manual
pr:
round: 2
round_created_at: 2026-05-05T15:48:56Z
status: resolved
file: .gitignore
line: 10
severity: medium
author: claude-code
provider_ref:
---

# Issue 002: .env tracked by git despite .gitignore entry — credential leak risk

## Review Comment

`.gitignore` lists `.env` (line 10), signalling that `.env` should not be tracked. However, `.env` is already tracked in the repository (`git ls-files .env` returns it). Once a file is tracked, `.gitignore` has no effect on it — git will continue to stage and commit any changes to `.env`, regardless of the `.gitignore` entry.

Concrete risk for a scaffold: a developer clones this repo, edits `.env` to use real credentials (production `DATABASE_URL`, a real `ADMIN_PASSWORD`), then runs `git add -A && git commit`. Git will silently include the modified `.env` because it is a tracked file. The `.gitignore` entry provides false safety — it looks protected but is not.

**Fix (two steps):**

1. Remove `.env` from the index without deleting the file on disk:
   ```
   git rm --cached .env
   git commit -m "chore: untrack .env — use .env.example as template"
   ```
2. Verify that `.env.example` (which already exists with safe local defaults) is tracked and up to date.

After this change:
- New cloners run `cp .env.example .env` (or the dev setup script does it automatically)
- `.gitignore` correctly prevents their local `.env` from being committed
- The F1 zero-config goal is still achievable via a one-line setup step or a `postinstall` script

## Triage

- Decision: `invalid`
- Notes: `git ls-files .env` returns empty — `.env` is NOT tracked by git. The `.gitignore` entry at line 10 is functioning correctly. The premise of this issue (that `.env` is already tracked, making the `.gitignore` entry ineffective) is false for this repository. No code change needed.
