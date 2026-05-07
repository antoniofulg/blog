---
provider: manual
pr:
round: 1
round_created_at: 2026-05-06T17:20:28Z
status: resolved
file: .github/workflows/cd.yml
line: 26
severity: low
author: claude-code
provider_ref:
---

# Issue 004: Image tagged with full 40-char SHA; ADR-003 specifies 7-char short SHA

## Review Comment

ADR-003 documents the tagging strategy as "Git SHA tag — the full **7-character short SHA**." The implementation uses `${{ github.sha }}`, which is the full 40-character SHA:

```yaml
tags: |
  ghcr.io/${{ github.repository }}:latest
  ghcr.io/${{ github.repository }}:${{ github.sha }}   # 40-char SHA
```

The full SHA works and provides stronger uniqueness guarantees. The VPS always pulls `:latest`, so the SHA tag is used only for rollback and traceability — neither scenario breaks with 40 chars. But the implementation silently contradicts the ADR, which creates confusion when reading `docker images` output or GHCR.

**Fix** (align with ADR or update the ADR):

```yaml
# Short SHA — matches ADR-003
tags: |
  ghcr.io/${{ github.repository }}:latest
  ghcr.io/${{ github.repository }}:${{ github.sha[:7] }}
```

Note: GitHub Actions expression syntax does not support slice notation. Use a step to extract the short SHA:

```yaml
- id: meta
  run: echo "sha_short=${GITHUB_SHA::7}" >> "$GITHUB_OUTPUT"
- uses: docker/build-push-action@v6
  with:
    tags: |
      ghcr.io/${{ github.repository }}:latest
      ghcr.io/${{ github.repository }}:${{ steps.meta.outputs.sha_short }}
```

Alternatively, update ADR-003 to reflect that the full SHA is used.

## Triage

- Decision: `valid`
- Notes: ADR-003 confirmed at `.compozy/tasks/cicd-vps-pipeline/adrs/adr-003.md`: "Git SHA tag — the full 7-character short SHA". Implementation uses `${{ github.sha }}` (40-char). Fix: add a `meta` step before `docker/build-push-action` to extract short SHA via `git rev-parse --short HEAD`, then reference `steps.meta.outputs.sha_short` in the tag. Using `git rev-parse --short HEAD` is preferable over `${GITHUB_SHA::7}` after a `workflow_run` trigger change (issue 001), since GITHUB_SHA env var reflects the default branch HEAD while the checked-out ref is `workflow_run.head_sha`.
