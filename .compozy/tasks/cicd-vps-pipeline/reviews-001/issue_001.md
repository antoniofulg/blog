---
provider: manual
pr:
round: 1
round_created_at: 2026-05-06T17:20:28Z
status: resolved
file: .github/workflows/cd.yml
line: 1
severity: high
author: claude-code
provider_ref:
---

# Issue 001: CD fires in parallel with CI on direct push to main

## Review Comment

`cd.yml` triggers on `push: branches: [main]` independently. When a commit lands on `main` (whether via PR merge or direct push), both `ci.yml` and `cd.yml` fire simultaneously. There is no dependency between them, so the deploy can start — and potentially complete — before CI finishes or even before CI has a chance to fail.

The TechSpec explicitly requires: *"The CD workflow must not start until ci.yml has successfully completed for the same commit."* The current implementation violates this.

For PR merges where branch protection enforces CI, the practical risk is lower because CI passed on the PR branch. However, the merge commit itself is a new SHA; CI runs on it in parallel with CD, not before. For any direct push to `main`, there is no guard at all.

**Fix**: Use a `workflow_run` trigger in `cd.yml` that waits for the CI workflow to complete successfully:

```yaml
on:
  workflow_run:
    workflows: ["CI"]
    types: [completed]
    branches: [main]

jobs:
  build-push:
    if: github.event.workflow_run.conclusion == 'success'
    ...
```

The `if:` guard on each job prevents the deploy from running when CI failed or was cancelled.

## Triage

- Decision: `valid`
- Notes: Root cause confirmed. `cd.yml` line 3–5 triggers on `push: branches: [main]`, firing simultaneously with `ci.yml`. The PRD constraint ("CD must not start until ci.yml has successfully completed") is violated. Fix: replace trigger with `workflow_run` on CI completion + add `if: github.event.workflow_run.conclusion == 'success'` on `build-push` job. Downstream jobs cascade-skip via `needs:`.
