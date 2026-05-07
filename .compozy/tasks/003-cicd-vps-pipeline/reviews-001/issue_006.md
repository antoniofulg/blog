---
provider: manual
pr:
round: 1
round_created_at: 2026-05-06T17:20:28Z
status: resolved
file: .github/workflows/cd.yml
line: 28
severity: low
author: claude-code
provider_ref:
---

# Issue 006: deploy job missing explicit permissions block

## Review Comment

The `build-push` and `changelog` jobs correctly declare `permissions:`. The `deploy` job does not:

```yaml
  deploy:
    runs-on: ubuntu-latest
    needs: build-push
    # no permissions: block
    steps:
      - uses: actions/checkout@v4
      - uses: webfactory/ssh-agent@v0.9.0
```

Without an explicit block, `deploy` inherits the repository's default token permissions (typically `contents: read` plus others). The deploy job only uses SSH via `webfactory/ssh-agent` and does not need any `GITHUB_TOKEN` scope. An explicit `permissions: {}` (or `contents: none`) communicates intent, limits blast radius if GitHub ever changes defaults, and makes the security posture of the workflow easier to audit at a glance.

**Fix**:

```yaml
  deploy:
    runs-on: ubuntu-latest
    needs: build-push
    permissions: {}
    steps:
```

## Triage

- Decision: `valid`
- Notes: Confirmed. `build-push` (line 10) and `changelog` (line 48) have explicit `permissions:` blocks. `deploy` job (line 28) has none, inheriting repo defaults. The job only uses SSH via `webfactory/ssh-agent` and needs no GITHUB_TOKEN scope. Fix: add `permissions: {}` to restrict to zero token permissions.
