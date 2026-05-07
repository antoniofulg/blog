---
provider: manual
pr:
round: 3
round_created_at: 2026-05-06T17:46:11Z
status: resolved
file: .github/workflows/cd.yml
line: 40
severity: low
author: claude-code
provider_ref:
---

# Issue 001: deploy job checkout uses default branch HEAD, not workflow_run.head_sha

## Review Comment

The `build-push` job correctly pins its checkout to the triggering commit:

```yaml
  build-push:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}   # ← correct
```

The `deploy` job does not:

```yaml
  deploy:
    steps:
      - uses: actions/checkout@v4                          # ← no ref
```

For `workflow_run` triggers, `actions/checkout` without a `ref` uses `GITHUB_SHA`, which is the HEAD of the default branch (`main`) at the time the CD workflow fires — not the SHA that CI ran against. If a second commit lands on `main` after CI finishes but before the `deploy` job starts (a timing edge case), the deploy job checks out the newer `deploy.sh` while executing the image built from the older commit.

In practice this is extremely unlikely for a solo developer, but the inconsistency is architectural: `build-push` and `deploy` should operate against the same code snapshot.

**Fix**: Add the same `ref` to the deploy job's checkout:

```yaml
  deploy:
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ github.event.workflow_run.head_sha }}
```

## Triage

- Decision: `VALID`
- Notes: Confirmed at line 40 — `deploy` job's `actions/checkout@v4` has no `ref`. `build-push` at line 17 pins to `github.event.workflow_run.head_sha`. For `workflow_run` triggers, omitting `ref` resolves to `GITHUB_SHA` (HEAD of default branch at dispatch time), not the SHA that CI ran against. Added `ref: ${{ github.event.workflow_run.head_sha }}` to the deploy job checkout so both jobs operate on the same snapshot.
