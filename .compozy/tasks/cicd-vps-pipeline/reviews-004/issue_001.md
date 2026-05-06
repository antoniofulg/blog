---
provider: manual
pr:
round: 4
round_created_at: 2026-05-06T18:01:12Z
status: pending
file: .github/workflows/cd.yml
line: 73
severity: low
author: claude-code
provider_ref:
---

# Issue 001: changelog git push can fail on non-fast-forward; no pull before push

## Review Comment

The `changelog` job checks out main, generates the changelog, and pushes:

```yaml
git diff --staged --quiet || (git commit -m "chore: update changelog [skip ci]" && git push)
```

If a commit lands on `main` between the checkout (line 61) and the push (line 73), `git push` fails with `rejected: non-fast-forward`. Because `git push` is inside a `(... && git push)` group, the failure propagates to the `run:` step, marking the `changelog` job as failed.

The consequence: the deployment itself already succeeded (the `deploy` job completed before `changelog` runs). The developer sees a red CD run and may incorrectly believe the deploy failed. The changelog entry for this deploy is permanently lost unless manually re-run.

For a solo developer this race is extremely unlikely — it requires a second push to main during the seconds the changelog job is running. But it's a confusing failure mode when it does occur.

**Fix**: Pull latest `main` immediately before pushing:

```yaml
git diff --staged --quiet || (
  git commit -m "chore: update changelog [skip ci]" &&
  git pull --ff-only origin main &&
  git push
)
```

`--ff-only` ensures the pull aborts rather than creating a merge commit if the histories have diverged in a non-fast-forwardable way. In the extremely rare case of a true conflict, the job fails loudly rather than silently discarding the commit.

## Triage

- Decision: `UNREVIEWED`
- Notes:
