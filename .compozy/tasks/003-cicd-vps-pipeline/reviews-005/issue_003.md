---
provider: manual
pr:
round: 5
round_created_at: 2026-05-06T19:52:54Z
status: resolved
file: scripts/deploy.sh
line: 8
severity: medium
author: claude-code
provider_ref:
---

# Issue 003: deploy.sh always pulls :latest; concurrent CD runs can deploy stale image

## Review Comment

The deploy script hardcodes the `:latest` tag:

```bash
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:latest"
```

The `build-push` job in `cd.yml` produces two tags per build: `:latest` and `:<sha_short>`. The SHA tag is immutable and traceable. The `:latest` tag is mutable and always overwritten.

For back-to-back pushes to main, two CD runs fire. If their `build-push` jobs finish out of order:

1. Run A (older commit abc) finishes `build-push` last → `:latest` now points to abc
2. Run B (newer commit def) already pushed its `:latest` first, now overwritten
3. Run B's `deploy` job then runs `docker pull :latest` → pulls abc's image
4. VPS is now running the older commit despite merging a newer one

The short SHA exists in `steps.meta.outputs.sha_short` in `build-push` but is never threaded to the `deploy` job or `deploy.sh`.

**Fix**: Pass the SHA from `build-push` to `deploy` via job outputs, then deploy the immutable SHA tag:

In `cd.yml`, add a job output from `build-push`:
```yaml
  build-push:
    outputs:
      sha_short: ${{ steps.meta.outputs.sha_short }}
```

In `deploy` job, consume it:
```yaml
  deploy:
    needs: build-push
    steps:
      - env:
          IMAGE_TAG: ${{ needs.build-push.outputs.sha_short }}
        run: bash scripts/deploy.sh
```

In `deploy.sh`, use the specific tag:
```bash
TAG="${IMAGE_TAG:-latest}"
IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:${TAG}"
```

This makes each CD run deploy exactly the image it built, regardless of what other concurrent runs do to `:latest`.

## Triage

- Decision: `valid`
- Notes: Confirmed. `IMAGE="ghcr.io/${GHCR_OWNER:?}/${GHCR_REPO:?}:latest"` always uses `:latest`. Concurrent CD runs with out-of-order `build-push` completions can cause the `deploy` job of the newer run to pull the older image. Fix: thread `sha_short` from `build-push` as a job output, pass it to `deploy` job as `IMAGE_TAG`, and use `TAG="${IMAGE_TAG:-latest}"` in `deploy.sh`. Also pass `IMAGE_TAG=$TAG` to the `docker-compose.prod.yml` invocation on the VPS so compose uses the same SHA tag.
