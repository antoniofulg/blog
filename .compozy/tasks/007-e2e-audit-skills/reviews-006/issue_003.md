---
provider: manual
pr:
round: 6
round_created_at: 2026-05-20T04:22:01Z
status: resolved
file: .github/workflows/app-audit.yml
line: 23
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: Workflow pull-requests:write permission unguarded on fork PRs

## Review Comment

`.github/workflows/app-audit.yml` declares `permissions: pull-requests: write` (around L23-25) to enable the delta-only PR comment via `peter-evans/create-or-update-comment@v4`. On fork PRs, this permission combined with the trigger `pull_request: paths: [...]` allows the workflow to post comments to the PR even though the fork author did not approve the audit. While the fingerprint dedup prevents comment spam, the security boundary is wider than necessary.

Concrete risks on a fork PR:
- A malicious fork PR could craft commits that trigger app-audit and observe whether comments mention internal route names or auth-state details (information leak via comment content).
- The `peter-evans/create-or-update-comment@v4` step runs in the fork-PR context but with the *upstream* permissions, which is the standard GitHub Actions fork-PR trust boundary. Solo-dev personal blog risk is low, but the principle of least privilege still applies.

Note that this branch uses `pull_request` (not `pull_request_target`), so fork PRs run *without secrets* and the auth fixture's admin walks would fail at the seed step. So the practical impact is limited to public-route audit findings being commented. Still worth tightening.

**Suggested fix:** add a fork-PR guard before the PR-comment step:

```yaml
- name: Post or update PR comment
  if: |
    github.event_name == 'pull_request' &&
    github.event.pull_request.head.repo.full_name == github.repository &&
    steps.delta.outputs.suppress != 'true'
  uses: peter-evans/create-or-update-comment@v4
  ...
```

This blocks the comment step on fork PRs while keeping the audit run itself useful (artifact + report still generated; just no PR comment for forks). Document the fork-PR behavior in `.agents/rules/cicd.md`.

## Triage

- Decision: `VALID`
- Notes: Confirmed in `app-audit.yml:149-150` — the PR comment step's `if:` condition checks only `github.event_name == 'pull_request' && steps.delta.outputs.suppress != 'true'`. No fork-PR guard is present. On a fork PR, the workflow runs with `pull_request` (not `pull_request_target`) so secrets are NOT available, but the `GITHUB_TOKEN` from the runner still has the declared `pull-requests: write` permission, which allows the comment step to post. Fix: add `github.event.pull_request.head.repo.full_name == github.repository` guard to the PR comment step. Audit run, artifact upload, and delta check are unaffected — only the comment step is gated. Also document fork-PR behavior in `.agents/rules/cicd.md`.
